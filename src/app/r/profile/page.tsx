"use client";

import { useRef, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  Mail,
  Phone,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/utils/compress-image";
import { RESIDENT_STATUS_LABELS, type ResidentStatus } from "@/types/user";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResidentProfile {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  rwaid: string | null;
  status: ResidentStatus;
  ownershipType: string | null;
  societyName: string | null;
  unit: string | null;
  designation: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: "border-yellow-300 bg-yellow-50 text-yellow-700",
  ACTIVE_PAID: "border-green-300 bg-green-50 text-green-700",
  ACTIVE_PENDING: "border-blue-300 bg-blue-50 text-blue-700",
  ACTIVE_OVERDUE: "border-red-300 bg-red-50 text-red-700",
  ACTIVE_PARTIAL: "border-orange-300 bg-orange-50 text-orange-700",
  ACTIVE_EXEMPTED: "border-purple-300 bg-purple-50 text-purple-700",
  REJECTED: "border-gray-300 bg-gray-50 text-gray-500",
};

const OWNERSHIP_LABELS: Record<string, string> = {
  OWNER: "Owner",
  TENANT: "Tenant",
  OTHER: "Other",
};

const OWNERSHIP_PROOF_LABELS: Record<string, string> = {
  OWNER: "Ownership Proof",
  TENANT: "Tenancy / Rental Agreement",
  OTHER: "Property Document",
};

const OWNERSHIP_PROOF_HINTS: Record<string, string> = {
  OWNER: "Sale deed, registry copy, property tax receipt, or mutation",
  TENANT: "Rental agreement or leave & licence deed",
  OTHER: "Any document proving your stay at this property",
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchProfile(): Promise<ResidentProfile> {
  const res = await fetch("/api/v1/residents/me");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<ResidentProfile>;
}

async function fetchDocUrl(endpoint: string): Promise<string | null> {
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = (await res.json()) as { url: string | null };
  return data.url;
}

// ---------------------------------------------------------------------------
// DocCard
// ---------------------------------------------------------------------------

interface DocCardProps {
  title: string;
  hint: string;
  endpoint: string;
  accept: string;
  icon: React.ReactNode;
  accentClass: string;
  /** Matches the home page doc-status key: "id-proof" | "ownership-proof" */
  docKey: string;
  /** Scope the cache to the active society so switching society fetches fresh docs */
  societyId: string | null;
}

function DocCard({
  title,
  hint,
  endpoint,
  accept,
  icon,
  accentClass,
  docKey,
  societyId,
}: DocCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: docUrl, refetch } = useQuery({
    queryKey: ["doc", endpoint, societyId],
    queryFn: () => fetchDocUrl(endpoint),
    staleTime: 10 * 60 * 1000,
    enabled: !!societyId,
  });

  const hasDoc = !!docUrl;

  function invalidateHomeCache() {
    // Invalidate the home page doc-status query so banner refreshes immediately
    void queryClient.invalidateQueries({ queryKey: ["doc-status", docKey, societyId] });
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(body.error?.message ?? "Upload failed");
        return;
      }
      toast.success(`${title} uploaded successfully`);
      void refetch();
      invalidateHomeCache();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        toast.error(`Failed to remove ${title}`);
        return;
      }
      toast.success(`${title} removed`);
      void refetch();
      invalidateHomeCache();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md`}
    >
      {/* Left accent strip */}
      <div className={`absolute top-0 left-0 h-full w-1 ${accentClass}`} />

      <div className="flex items-center justify-between gap-3 px-4 py-3 pl-5">
        {/* Icon + text */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${hasDoc ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"}`}
          >
            {hasDoc ? <CheckCircle2 className="h-5 w-5" /> : icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
            <p className="truncate text-xs text-slate-500">{hint}</p>
          </div>
        </div>

        {/* Right side: status + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex ${hasDoc ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-600"}`}
          >
            {hasDoc ? "Uploaded" : "Pending"}
          </span>

          {hasDoc ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-slate-800"
                title="View document"
                onClick={() => window.open(docUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-slate-800"
                title="Replace document"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-600"
                title="Remove document"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info row helper
// ---------------------------------------------------------------------------

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-700">
      <span className="text-slate-400">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResidentProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["resident-profile", user?.societyId],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  if (isLoading) return <PageSkeleton />;

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">Unable to load profile.</p>
      </div>
    );
  }

  const statusLabel = RESIDENT_STATUS_LABELS[profile.status] ?? profile.status;
  const statusStyle = STATUS_STYLES[profile.status] ?? "border-gray-300 bg-gray-50 text-gray-700";
  const ownershipKey = profile.ownershipType ?? "OTHER";
  const ownershipLabel = OWNERSHIP_LABELS[ownershipKey] ?? ownershipKey;
  const proofTitle = OWNERSHIP_PROOF_LABELS[ownershipKey] ?? "Property Document";
  const proofHint = OWNERSHIP_PROOF_HINTS[ownershipKey] ?? "Any document proving your stay";

  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-4">
      {/* ── Profile card ── */}
      <Card className="overflow-hidden border-0 shadow-md">
        {/* Hero gradient banner */}
        <div className="from-primary via-primary/90 h-14 bg-gradient-to-r to-emerald-600" />

        <CardContent className="pt-0 pb-5">
          {/* Avatar row — overlaps the banner */}
          <div className="-mt-7 mb-4 flex items-end justify-between gap-3">
            <div className="bg-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-4 border-white text-lg font-bold text-white shadow-md sm:h-16 sm:w-16 sm:text-xl">
              {initials}
            </div>
            <Badge variant="outline" className={`mb-1 ${statusStyle} font-medium`}>
              {statusLabel}
            </Badge>
          </div>

          {/* Name + RWAID + designation */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{profile.name}</h1>
            {profile.rwaid && <p className="font-mono text-xs text-slate-400">{profile.rwaid}</p>}
            {profile.designation && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-700">{profile.designation}</span>
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {profile.mobile && (
              <InfoRow icon={<Phone className="h-4 w-4" />} value={`+91 ${profile.mobile}`} />
            )}
            {profile.email && <InfoRow icon={<Mail className="h-4 w-4" />} value={profile.email} />}
            {(profile.unit ?? profile.societyName) && (
              <InfoRow
                icon={<Home className="h-4 w-4" />}
                value={[profile.unit, profile.societyName].filter(Boolean).join(" — ")}
              />
            )}
            <InfoRow icon={<Shield className="h-4 w-4" />} value={ownershipLabel} />
          </div>
        </CardContent>
      </Card>

      {/* ── Documents card ── */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <FileText className="text-primary h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">My Documents</CardTitle>
              <p className="text-xs text-slate-500">
                {profile.societyName
                  ? `For ${profile.societyName} · Each society requires separate documents`
                  : "Each society requires separate documents"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <DocCard
            title="ID Proof"
            hint="Aadhaar card, Voter ID, Passport, or Driving Licence"
            endpoint="/api/v1/residents/me/id-proof"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            icon={<FileText className="h-5 w-5" />}
            accentClass="bg-blue-400"
            docKey="id-proof"
            societyId={user?.societyId ?? null}
          />
          <DocCard
            title={proofTitle}
            hint={proofHint}
            endpoint="/api/v1/residents/me/ownership-proof"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            icon={<FileText className="h-5 w-5" />}
            accentClass="bg-emerald-400"
            docKey="ownership-proof"
            societyId={user?.societyId ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
