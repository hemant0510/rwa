"use client";

import Link from "next/link";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { UpiQrDisplay } from "@/components/features/payments/UpiQrDisplay";
import { SubscriptionPaymentClaimForm } from "@/components/features/subscription/SubscriptionPaymentClaimForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSocietyId } from "@/hooks/useSocietyId";
import { getMySubscriptionClaims } from "@/services/subscription-payment-claims";
import { getSubscription } from "@/services/subscriptions";
import type { PlatformUpiSettings, SubscriptionPaymentClaim } from "@/types/payment";

const CLAIM_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  VERIFIED: "border-green-200 bg-green-50 text-green-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

async function getPlatformPaymentInfo(societyId: string): Promise<PlatformUpiSettings> {
  const res = await fetch(`/api/v1/societies/${societyId}/platform-payment-info`);
  if (!res.ok) throw new Error("Failed to fetch platform payment info");
  return res.json() as Promise<PlatformUpiSettings>;
}

export default function AdminSubscriptionPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ["subscription", societyId],
    queryFn: () => getSubscription(societyId),
    enabled: !!societyId,
  });

  const { data: platformUpi, isLoading: upiLoading } = useQuery({
    queryKey: ["platform-payment-info", societyId],
    queryFn: () => getPlatformPaymentInfo(societyId),
    enabled: !!societyId,
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["subscription-claims", societyId],
    queryFn: () => getMySubscriptionClaims(societyId),
    enabled: !!societyId,
  });

  if (subLoading || upiLoading || claimsLoading) return <PageSkeleton />;

  const claims: SubscriptionPaymentClaim[] = claimsData?.claims ?? [];
  const amountDue = sub?.finalPrice ? Number(sub.finalPrice) : 0;

  const today = new Date();
  const periodStart = format(today, "yyyy-MM-dd");
  const periodEnd = sub?.currentPeriodEnd
    ? format(new Date(sub.currentPeriodEnd), "yyyy-MM-dd")
    : format(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()), "yyyy-MM-dd");

  const hasPendingClaim = claims.some((c) => c.status === "PENDING");

  function handleClaimSuccess() {
    queryClient.invalidateQueries({ queryKey: ["subscription-claims", societyId] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/settings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="Subscription Payment"
          description="Pay your society's platform subscription fee via UPI"
        />
      </div>

      {sub && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subscription Payment Due</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {sub.plan?.name && (
                <span>
                  <span className="text-muted-foreground">Plan: </span>
                  <span className="font-medium">{sub.plan.name}</span>
                </span>
              )}
              {sub.billingOption?.billingCycle && (
                <span>
                  <span className="text-muted-foreground">Billing: </span>
                  <span className="font-medium">{sub.billingOption.billingCycle}</span>
                </span>
              )}
              {amountDue > 0 && (
                <span>
                  <span className="text-muted-foreground">Amount: </span>
                  <span className="font-medium">₹{amountDue.toLocaleString("en-IN")}</span>
                </span>
              )}
              {sub.currentPeriodEnd && (
                <span>
                  <span className="text-muted-foreground">Due: </span>
                  <span className="font-medium">
                    {format(new Date(sub.currentPeriodEnd), "dd MMM yyyy")}
                  </span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {platformUpi?.platformUpiId ? (
        <>
          <UpiQrDisplay
            upiQrUrl={platformUpi.platformUpiQrUrl}
            upiId={platformUpi.platformUpiId}
            accountName={platformUpi.platformUpiAccountName}
            amount={amountDue}
          />

          <Card>
            <CardContent className="space-y-1 pt-4 text-sm">
              <p className="font-medium">How to pay:</p>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1">
                <li>Open GPay / PhonePe</li>
                <li>Scan QR and pay ₹{amountDue.toLocaleString("en-IN")}</li>
                <li>Come back and confirm below</li>
              </ol>
              <p className="text-muted-foreground pt-1 text-xs">
                No convenience fee — pay exactly ₹{amountDue.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>

          {!hasPendingClaim && (
            <div className="space-y-1">
              <SubscriptionPaymentClaimForm
                societyId={societyId}
                amountDue={amountDue}
                periodStart={periodStart}
                periodEnd={periodEnd}
                onSuccess={handleClaimSuccess}
              />
            </div>
          )}

          {hasPendingClaim && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-muted-foreground text-sm">
                  Your payment claim is pending review by the Super Admin.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">
              Platform UPI has not been configured yet. Please contact support.
            </p>
          </CardContent>
        </Card>
      )}

      {claims.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Previous Claims</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-muted/30 flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">₹{Number(claim.amount).toLocaleString("en-IN")}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(new Date(claim.createdAt), "MMM yyyy")} · UTR: {claim.utrNumber}
                  </p>
                  {claim.status === "REJECTED" && claim.rejectionReason && (
                    <p className="text-destructive text-xs">{claim.rejectionReason}</p>
                  )}
                </div>
                <Badge variant="outline" className={CLAIM_STATUS_COLORS[claim.status] ?? ""}>
                  {claim.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
