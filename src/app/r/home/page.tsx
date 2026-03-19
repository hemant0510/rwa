"use client";

import Link from "next/link";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  IndianRupee,
  Loader2,
  Receipt,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface ResidentProfile {
  id: string;
  name: string;
  rwaid: string | null;
  status: string;
  unit: string | null;
  societyName: string | null;
  designation: string | null;
  currentFee: {
    sessionYear: string;
    amountDue: number;
    amountPaid: number;
    status: string;
  } | null;
}

async function fetchDocStatus(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return false;
    const data = (await res.json()) as { url: string | null };
    return !!data.url;
  } catch {
    return false;
  }
}

export default function ResidentHomePage() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["resident", "me", user?.societyId],
    queryFn: async () => {
      const res = await fetch("/api/v1/residents/me");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json() as Promise<ResidentProfile>;
    },
    enabled: !!user,
  });

  const isActive = profile && profile.status.startsWith("ACTIVE_");

  const [idProofQuery, ownershipQuery] = useQueries({
    queries: [
      {
        queryKey: ["doc-status", "id-proof", user?.societyId],
        queryFn: () => fetchDocStatus("/api/v1/residents/me/id-proof"),
        enabled: !!isActive,
        staleTime: 0, // always refetch on mount so banner reflects latest upload
      },
      {
        queryKey: ["doc-status", "ownership-proof", user?.societyId],
        queryFn: () => fetchDocStatus("/api/v1/residents/me/ownership-proof"),
        enabled: !!isActive,
        staleTime: 0,
      },
    ],
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  // Pending approval state
  if (profile.status === "PENDING_APPROVAL") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.name}</h1>
          <p className="text-muted-foreground text-sm">{user?.societyName}</p>
        </div>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Registration Pending</p>
              <p className="mt-1 text-sm text-yellow-700">
                Your registration is awaiting approval from the society admin. You will be notified
                once it is approved.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected state
  if (profile.status === "REJECTED") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.name}</h1>
          <p className="text-muted-foreground text-sm">{user?.societyName}</p>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Registration Not Approved</p>
              <p className="mt-1 text-sm text-red-700">
                Your registration was not approved. Please contact the society admin for more
                details.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Document banner logic (only for active residents, once queries settle)
  const docsLoading = idProofQuery.isLoading || ownershipQuery.isLoading;
  const hasIdProof = idProofQuery.data ?? false;
  const hasOwnership = ownershipQuery.data ?? false;
  const missingDocs = [!hasIdProof && "ID Proof", !hasOwnership && "Ownership Proof"].filter(
    Boolean,
  ) as string[];
  const allDocsUploaded = hasIdProof && hasOwnership;

  // Active state (ACTIVE_PENDING, ACTIVE_PAID, ACTIVE_OVERDUE, etc.)
  const feeStatusColor =
    profile.currentFee?.status === "PAID"
      ? "border-green-200 bg-green-50 text-green-700"
      : profile.currentFee?.status === "PENDING"
        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Welcome, {profile.name}</h1>
          {profile.designation && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
              <Award className="mr-1 h-3 w-3" />
              {profile.designation}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{user?.societyName}</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Your RWAID</p>
              <p className="font-mono text-sm font-medium">{profile.rwaid || "Pending"}</p>
              {profile.unit && (
                <p className="text-muted-foreground mt-1 text-xs">Unit: {profile.unit}</p>
              )}
            </div>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Document status banner ── */}
      {!docsLoading &&
        (allDocsUploaded ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-green-800">Documents Verified</p>
              <p className="text-xs text-green-700">
                Your ID proof and ownership document are on file.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          </div>
        ) : missingDocs.length === 2 ? (
          <Link href="/r/profile">
            <div className="group flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 transition-colors hover:bg-red-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 group-hover:bg-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-800">
                  Action Required — Complete Your Profile
                </p>
                <p className="text-xs text-red-700">
                  Upload your ID proof and ownership document to complete verification.
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    <FileText className="h-3 w-3" /> ID Proof
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    <FileText className="h-3 w-3" /> Ownership Proof
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-red-400 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ) : (
          <Link href="/r/profile">
            <div className="group flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 group-hover:bg-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  Almost There — 1 Document Missing
                </p>
                <p className="text-xs text-amber-700">
                  Upload your {missingDocs[0]} to complete your profile.
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <FileText className="h-3 w-3" /> {missingDocs[0]} missing
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-amber-400 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}

      {profile.currentFee && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Current Session ({profile.currentFee.sessionYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {"\u20B9"}
                  {profile.currentFee.amountPaid.toLocaleString("en-IN")}
                  <span className="text-muted-foreground text-sm font-normal">
                    {" / \u20B9"}
                    {profile.currentFee.amountDue.toLocaleString("en-IN")}
                  </span>
                </p>
              </div>
              <Badge variant="outline" className={feeStatusColor}>
                {profile.currentFee.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/r/payments">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
              <IndianRupee className="text-primary h-8 w-8" />
              <p className="text-sm font-medium">Payment History</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/r/expenses">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
              <Receipt className="text-primary h-8 w-8" />
              <p className="text-sm font-medium">Society Expenses</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
