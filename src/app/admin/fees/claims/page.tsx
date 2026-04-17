"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PendingClaimCard } from "@/components/features/payments/PendingClaimCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSocietyId } from "@/hooks/useSocietyId";
import { getAdminPaymentClaims, rejectClaim, verifyClaim } from "@/services/admin-payment-claims";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

export default function AdminClaimsPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payment-claims", societyId, statusFilter],
    queryFn: () =>
      getAdminPaymentClaims(societyId, {
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
    enabled: !!societyId,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ claimId, adminNotes }: { claimId: string; adminNotes?: string }) =>
      verifyClaim(societyId, claimId, adminNotes),
    onSuccess: () => {
      toast.success("Payment claim verified");
      void queryClient.invalidateQueries({ queryKey: ["admin-payment-claims"] });
      void queryClient.invalidateQueries({ queryKey: ["fees-pending-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      rejectClaim(societyId, claimId, reason),
    onSuccess: () => {
      toast.success("Payment claim rejected");
      void queryClient.invalidateQueries({ queryKey: ["admin-payment-claims"] });
      void queryClient.invalidateQueries({ queryKey: ["fees-pending-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isPending = verifyMutation.isPending || rejectMutation.isPending;

  if (isLoading) return <PageSkeleton />;

  const claims = data?.claims ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Fee Management — Pending Claims${total > 0 ? ` [${total}]` : ""}`}
        description="Review and verify resident UPI payment claims"
      />

      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {claims.length === 0 ? (
        <EmptyState
          title="No claims found"
          description={
            statusFilter === "ALL"
              ? "No payment claims have been submitted yet."
              : `No ${statusFilter.toLowerCase()} claims.`
          }
        />
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <PendingClaimCard
              key={claim.id}
              claim={claim}
              onVerify={(id, adminNotes) => verifyMutation.mutate({ claimId: id, adminNotes })}
              onReject={(id, reason) => rejectMutation.mutate({ claimId: id, reason })}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
