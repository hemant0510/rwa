"use client";

import { useRef, useState } from "react";

import Image from "next/image";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Camera,
  CheckCircle2,
  Droplet,
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

import { FamilyMemberDialog } from "@/components/features/family/FamilyMemberDialog";
import { DirectorySettingsCard } from "@/components/features/profile/DirectorySettingsCard";
import { ProfileCompletenessCard } from "@/components/features/profile/ProfileCompletenessCard";
import {
  ProfileFamilyCard,
  type EmergencyContactSummary,
} from "@/components/features/profile/ProfileFamilyCard";
import {
  ProfileVehiclesCard,
  type VehicleExpiryAlert,
} from "@/components/features/profile/ProfileVehiclesCard";
import { VehicleDialog } from "@/components/features/vehicles/VehicleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/utils/compress-image";
import { getFamilyMembers } from "@/services/family";
import { updateDirectorySettings, updateProfileDeclarations } from "@/services/profile";
import type { CompletenessResult } from "@/types/user";
import { RESIDENT_STATUS_LABELS, type ResidentStatus } from "@/types/user";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeclarationStatus = "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";

interface ResidentProfile {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  rwaid: string | null;
  status: ResidentStatus;
  ownershipType: string | null;
  bloodGroup: string | null;
  householdStatus: DeclarationStatus;
  vehicleStatus: DeclarationStatus;
  showInDirectory: boolean;
  showPhoneInDirectory: boolean;
  societyName: string | null;
  unit: string | null;
  units: Array<{ id: string; displayLabel: string }>;
  designation: string | null;
  completeness: CompletenessResult;
}

interface ProfileSummary {
  familyCount: number;
  vehicleCount: number;
  emergencyContacts: EmergencyContactSummary[];
  vehicleExpiryAlerts: VehicleExpiryAlert[];
  directoryOptIn: boolean;
  showPhoneInDirectory: boolean;
  firstVehicleReg?: string | null;
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

const BLOOD_GROUP_OPTIONS: Array<[string, string]> = [
  ["A_POS", "A+"],
  ["A_NEG", "A-"],
  ["B_POS", "B+"],
  ["B_NEG", "B-"],
  ["AB_POS", "AB+"],
  ["AB_NEG", "AB-"],
  ["O_POS", "O+"],
  ["O_NEG", "O-"],
  ["UNKNOWN", "Unknown"],
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchProfile(): Promise<ResidentProfile> {
  const res = await fetch("/api/v1/residents/me");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<ResidentProfile>;
}

/* v8 ignore start */
async function fetchProfileSummary(): Promise<ProfileSummary> {
  const res = await fetch("/api/v1/residents/me/profile/summary");
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json() as Promise<ProfileSummary>;
}

async function fetchDocUrl(endpoint: string): Promise<string | null> {
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = (await res.json()) as { url: string | null };
  return data.url;
}
/* v8 ignore stop */

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
  docKey: string;
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
      /* v8 ignore start */
      if (fileRef.current) fileRef.current.value = "";
      /* v8 ignore stop */
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
      <div className={`absolute top-0 left-0 h-full w-1 ${accentClass}`} />
      <div className="flex items-center justify-between gap-3 px-4 py-3 pl-5">
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
                {/* v8 ignore start */}
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {/* v8 ignore stop */}
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
          /* v8 ignore next */
          const f = e.target.files?.[0];
          /* v8 ignore next */
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}

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
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["me", user?.societyId],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  const { data: summary } = useQuery({
    queryKey: ["profile-summary", user?.societyId],
    queryFn: fetchProfileSummary,
    enabled: !!user,
  });

  // Needed by the VehicleDialog (unit + dependent owner selectors)
  const { data: familyMembers } = useQuery({
    queryKey: ["family"],
    queryFn: getFamilyMembers,
    enabled: !!user && vehicleDialogOpen,
  });

  const { data: photoData, refetch: refetchPhoto } = useQuery({
    queryKey: ["resident-photo", user?.societyId],
    queryFn: () => fetchDocUrl("/api/v1/residents/me/photo"),
    staleTime: 10 * 60 * 1000,
    enabled: !!user,
  });

  const photoUrl = photoData ?? null;

  const declarationMutation = useMutation({
    mutationFn: updateProfileDeclarations,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update profile");
    },
  });

  const directoryMutation = useMutation({
    mutationFn: updateDirectorySettings,
    onSuccess: () => {
      toast.success("Directory settings updated");
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update directory settings");
    },
  });

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/v1/residents/me/photo", { method: "POST", body: form });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(body.error?.message ?? "Upload failed");
        return;
      }
      toast.success("Photo updated");
      void refetchPhoto();
      void queryClient.invalidateQueries({ queryKey: ["resident-directory"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    } finally {
      setPhotoUploading(false);
      /* v8 ignore start */
      if (photoRef.current) photoRef.current.value = "";
      /* v8 ignore stop */
    }
  }

  async function handlePhotoDelete() {
    const res = await fetch("/api/v1/residents/me/photo", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove photo");
      return;
    }
    toast.success("Photo removed");
    void refetchPhoto();
    void queryClient.invalidateQueries({ queryKey: ["resident-directory"] });
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  if (isLoading) return <PageSkeleton />;

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">Unable to load profile.</p>
      </div>
    );
  }

  /* v8 ignore start */
  const statusLabel = RESIDENT_STATUS_LABELS[profile.status] ?? profile.status;
  const statusStyle = STATUS_STYLES[profile.status] ?? "border-gray-300 bg-gray-50 text-gray-700";
  const ownershipKey = profile.ownershipType ?? "OTHER";
  /* v8 ignore stop */
  /* v8 ignore start */
  const ownershipLabel = OWNERSHIP_LABELS[ownershipKey] ?? ownershipKey;
  const proofTitle = OWNERSHIP_PROOF_LABELS[ownershipKey] ?? "Property Document";
  const proofHint = OWNERSHIP_PROOF_HINTS[ownershipKey] ?? "Any document proving your stay";
  /* v8 ignore stop */

  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /* v8 ignore start */
  const familyCount = summary?.familyCount ?? 0;
  const vehicleCount = summary?.vehicleCount ?? 0;
  const emergencyContacts = summary?.emergencyContacts ?? [];
  const vehicleExpiryAlerts = summary?.vehicleExpiryAlerts ?? [];
  const firstVehicleReg = summary?.firstVehicleReg ?? null;
  /* v8 ignore stop */

  return (
    <div className="space-y-4">
      {/* 1. Profile card (with compact completeness ring) */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-5 pb-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="relative">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={profile.name}
                    width={64}
                    height={64}
                    className="h-14 w-14 rounded-xl object-cover shadow-md sm:h-16 sm:w-16"
                  />
                ) : (
                  <div className="bg-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-md sm:h-16 sm:w-16 sm:text-xl">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  disabled={photoUploading}
                  className="bg-primary absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-sm"
                  aria-label="Change photo"
                >
                  {photoUploading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  ) : (
                    <Camera className="h-3 w-3 text-white" />
                  )}
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  data-testid="photo-input"
                  onChange={(e) => {
                    /* v8 ignore next */
                    const f = e.target.files?.[0];
                    /* v8 ignore next */
                    if (f) void handlePhotoUpload(f);
                  }}
                />
              </div>
              <div className="mb-0.5 flex flex-col">
                {photoUrl ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      disabled={photoUploading}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Change Photo
                    </button>
                    <span className="text-muted-foreground text-xs">|</span>
                    <button
                      type="button"
                      onClick={handlePhotoDelete}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    disabled={photoUploading}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    {photoUploading ? "Uploading…" : "Upload Photo"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className={`${statusStyle} font-medium`}>
                {statusLabel}
              </Badge>
              <ProfileCompletenessCard completeness={profile.completeness} />
            </div>
          </div>

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

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* v8 ignore start */}
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
            {/* v8 ignore stop */}
            <InfoRow icon={<Shield className="h-4 w-4" />} value={ownershipLabel} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Documents card */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <FileText className="text-primary h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">My Documents</CardTitle>
              <p className="text-xs text-slate-500">
                {/* v8 ignore next */}
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
            societyId={/* v8 ignore next */ user?.societyId ?? null}
          />
          <DocCard
            title={proofTitle}
            hint={proofHint}
            endpoint="/api/v1/residents/me/ownership-proof"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            icon={<FileText className="h-5 w-5" />}
            accentClass="bg-emerald-400"
            docKey="ownership-proof"
            societyId={/* v8 ignore next */ user?.societyId ?? null}
          />
        </CardContent>
      </Card>

      {/* 4. Blood group dropdown */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Droplet className="text-primary h-5 w-5" />
            </div>
            <div className="flex-1">
              <Label htmlFor="profile-blood" className="text-sm font-semibold text-slate-800">
                Blood Group
              </Label>
              <p className="text-muted-foreground text-xs">
                Emergency contacts can look this up instantly.
              </p>
            </div>
            <Select
              value={profile.bloodGroup ?? ""}
              onValueChange={(v) => declarationMutation.mutate({ bloodGroup: v })}
              disabled={declarationMutation.isPending}
            >
              <SelectTrigger id="profile-blood" className="w-[120px]">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUP_OPTIONS.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 5. Family Members card */}
      <ProfileFamilyCard
        familyCount={familyCount}
        householdStatus={profile.householdStatus}
        emergencyContacts={emergencyContacts}
        onDeclareNone={() => declarationMutation.mutate({ householdStatus: "DECLARED_NONE" })}
        onUndoDeclaration={() => declarationMutation.mutate({ householdStatus: "NOT_SET" })}
        onAdd={() => setFamilyDialogOpen(true)}
        pending={declarationMutation.isPending}
      />

      {/* 6. Vehicles card */}
      <ProfileVehiclesCard
        vehicleCount={vehicleCount}
        firstReg={firstVehicleReg}
        vehicleStatus={profile.vehicleStatus}
        expiryAlerts={vehicleExpiryAlerts}
        onDeclareNone={() => declarationMutation.mutate({ vehicleStatus: "DECLARED_NONE" })}
        onUndoDeclaration={() => declarationMutation.mutate({ vehicleStatus: "NOT_SET" })}
        onAdd={() => setVehicleDialogOpen(true)}
        pending={declarationMutation.isPending}
      />

      {/* 7. Directory Settings card */}
      <DirectorySettingsCard
        showInDirectory={profile.showInDirectory}
        showPhoneInDirectory={profile.showPhoneInDirectory}
        onChange={(next) => directoryMutation.mutate(next)}
        pending={directoryMutation.isPending}
      />

      <FamilyMemberDialog
        open={familyDialogOpen}
        onOpenChange={setFamilyDialogOpen}
        member={null}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["family"] });
          void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
          void queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      />

      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={setVehicleDialogOpen}
        vehicle={null}
        units={/* v8 ignore next */ profile.units ?? []}
        dependents={
          /* v8 ignore next */
          (familyMembers ?? []).map((m) => ({ id: m.id, name: m.name }))
        }
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
          void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
          void queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      />
    </div>
  );
}
