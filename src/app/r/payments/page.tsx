"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CreditCard, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { getMyPaymentClaims } from "@/services/payment-claims";
import type { PaymentClaim } from "@/types/payment";

type FeePayment = {
  id: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  receiptNo: string;
  receiptUrl: string | null;
  paymentDate: string;
};

type FeeRecord = {
  id: string;
  sessionYear: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  isProrata: boolean;
  joiningFeeIncluded: boolean;
  gracePeriodEnd: string | null;
  payments: FeePayment[];
};

const CLAIM_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  VERIFIED: "border-green-200 bg-green-50 text-green-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  PAID: "border-green-200 bg-green-50 text-green-700",
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  PARTIAL: "border-orange-200 bg-orange-50 text-orange-700",
  EXEMPTED: "border-purple-200 bg-purple-50 text-purple-700",
  NOT_YET_DUE: "border-gray-200 bg-gray-50 text-gray-600",
};

async function fetchFees(): Promise<{ fees: FeeRecord[] }> {
  const res = await fetch("/api/v1/residents/me/fees");
  if (!res.ok) throw new Error("Failed to fetch payment history");
  return res.json() as Promise<{ fees: FeeRecord[] }>;
}

export default function ResidentPaymentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["resident", "fees"],
    queryFn: fetchFees,
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["resident", "payment-claims"],
    queryFn: getMyPaymentClaims,
  });

  if (isLoading || claimsLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Payment History</h1>
        <p className="text-muted-foreground text-sm">Failed to load payment history.</p>
      </div>
    );
  }

  const fees = data?.fees ?? [];
  const claims = claimsData?.claims ?? [];

  const claimsByFeeId = claims.reduce<Record<string, PaymentClaim[]>>((acc, claim) => {
    if (!acc[claim.membershipFeeId]) acc[claim.membershipFeeId] = [];
    acc[claim.membershipFeeId].push(claim);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment History</h1>

      {fees.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="text-muted-foreground h-8 w-8" />}
          title="No payments yet"
          description="Your payment history will appear here once fees are recorded."
        />
      ) : (
        fees.map((fee) => {
          const feeClaims = claimsByFeeId[fee.id] ?? [];
          return (
            <Card key={fee.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Session {fee.sessionYear}</CardTitle>
                  <Badge variant="outline" className={STATUS_COLORS[fee.status] ?? ""}>
                    {fee.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount Due</span>
                  <span className="font-medium">
                    &#8377;{fee.amountDue.toLocaleString("en-IN")}
                    {fee.isProrata && (
                      <span className="text-muted-foreground ml-1 text-xs">(pro-rata)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-medium">
                    &#8377;{fee.amountPaid.toLocaleString("en-IN")}
                  </span>
                </div>
                {fee.gracePeriodEnd && fee.status !== "PAID" && fee.status !== "EXEMPTED" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Due By</span>
                    <span className="font-medium">
                      {format(new Date(fee.gracePeriodEnd), "dd MMM yyyy")}
                    </span>
                  </div>
                )}

                {feeClaims.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Payment Claims
                    </p>
                    {feeClaims.map((claim) => (
                      <div
                        key={claim.id}
                        className="bg-muted/30 flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={CLAIM_STATUS_COLORS[claim.status] ?? ""}
                          >
                            {claim.status}
                          </Badge>
                          {claim.status === "REJECTED" && claim.rejectionReason && (
                            <p className="text-muted-foreground text-xs">{claim.rejectionReason}</p>
                          )}
                        </div>
                        {claim.status === "REJECTED" && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/r/payments/confirm?feeId=${fee.id}`}>Re-submit</Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {fee.payments.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Payments
                    </p>
                    {fee.payments.map((p) => (
                      <div
                        key={p.id}
                        className="bg-muted/30 flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            &#8377;{p.amount.toLocaleString("en-IN")} via {p.paymentMode}
                          </p>
                          <p className="text-muted-foreground font-mono text-xs">
                            {p.receiptNo} &middot; {format(new Date(p.paymentDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        {p.receiptUrl ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
