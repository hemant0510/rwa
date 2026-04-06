"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getAllPayments } from "@/services/billing";
import {
  getSaSubscriptionClaims,
  getSaPendingSubClaimsCount,
  verifySubscriptionClaim,
  rejectSubscriptionClaim,
} from "@/services/subscription-payment-claims";
import type { SubscriptionPaymentClaim } from "@/types/payment";

interface PaymentRow {
  id: string;
  societyName: string;
  societyCode: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  invoiceNo: string;
  paymentDate: string;
  isReversal: boolean;
  isReversed: boolean;
  createdAt: string;
}

// ─── Pending Claim Card ──────────────────────────────────────────────────────

function PendingSubClaimCard({
  claim,
  onVerified,
  onRejected,
}: {
  claim: SubscriptionPaymentClaim;
  onVerified: () => void;
  onRejected: () => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const verifyMutation = useMutation({
    mutationFn: () => verifySubscriptionClaim(claim.id),
    onSuccess: () => {
      toast.success("Subscription payment verified");
      onVerified();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectSubscriptionClaim(claim.id, reason),
    onSuccess: () => {
      toast.success("Subscription payment claim rejected");
      onRejected();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isPending = verifyMutation.isPending || rejectMutation.isPending;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{claim.society?.name ?? "Unknown Society"}</p>
              <p className="text-muted-foreground text-sm">
                Amount: ₹{Number(claim.amount).toLocaleString("en-IN")} | Claimed:{" "}
                {new Date(claim.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <Badge
              variant={
                claim.status === "VERIFIED"
                  ? "default"
                  : claim.status === "REJECTED"
                    ? "destructive"
                    : "secondary"
              }
            >
              {claim.status}
            </Badge>
          </div>

          <div className="text-sm">
            <p>UTR: {claim.utrNumber}</p>
            {claim.periodStart && claim.periodEnd && (
              <p>
                Period: {new Date(claim.periodStart).toLocaleDateString()} —{" "}
                {new Date(claim.periodEnd).toLocaleDateString()}
              </p>
            )}
            {claim.screenshotUrl && (
              <a
                href={claim.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                View Screenshot
              </a>
            )}
          </div>

          {claim.status === "PENDING" && (
            <div className="flex gap-2">
              {!rejectMode ? (
                <>
                  <Button size="sm" disabled={isPending} onClick={() => verifyMutation.mutate()}>
                    Confirm Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => setRejectMode(true)}
                  >
                    Reject
                  </Button>
                </>
              ) : (
                <div className="w-full space-y-2">
                  <Label htmlFor={`reason-${claim.id}`}>Rejection Reason</Label>
                  <Textarea
                    id={`reason-${claim.id}`}
                    placeholder="Reason (min 10 characters)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending || reason.length < 10}
                      onClick={() => rejectMutation.mutate()}
                    >
                      Confirm Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        setRejectMode(false);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pending Claims Tab ──────────────────────────────────────────────────────

function PendingClaimsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const { data, isLoading } = useQuery({
    queryKey: ["sa-sub-claims", statusFilter],
    queryFn: () => getSaSubscriptionClaims({ status: statusFilter || undefined }),
  });

  const claims = data?.claims ?? [];

  function handleChanged() {
    queryClient.invalidateQueries({ queryKey: ["sa-sub-claims"] });
    queryClient.invalidateQueries({ queryKey: ["sa-sub-claims-pending-count"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="claim-status-filter">Filter by status:</Label>
        <select
          id="claim-status-filter"
          className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading claims...</p>
      ) : claims.length === 0 ? (
        <p className="text-muted-foreground text-sm">No subscription payment claims found.</p>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <PendingSubClaimCard
              key={claim.id}
              claim={claim}
              onVerified={handleChanged}
              onRejected={handleChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recorded Payments Tab ───────────────────────────────────────────────────

function RecordedPaymentsTab() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["sa-all-payments", page],
    queryFn: () => getAllPayments({ page, limit }),
  });

  const rows: PaymentRow[] = data?.rows ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading payments...</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payment records found.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Society</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.societyName}</div>
                      <div className="text-muted-foreground text-xs">{row.societyCode}</div>
                    </TableCell>
                    <TableCell>{new Date(row.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell className={row.isReversal ? "text-destructive" : ""}>
                      {row.isReversal ? "-" : ""}₹{Math.abs(row.amount).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>{row.paymentMode.replace("_", " ")}</TableCell>
                    <TableCell>{row.referenceNo || "-"}</TableCell>
                    <TableCell>{row.invoiceNo}</TableCell>
                    <TableCell>
                      {row.isReversal ? (
                        <Badge variant="destructive">Reversal</Badge>
                      ) : row.isReversed ? (
                        <Badge variant="secondary">Reversed</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SuperAdminBillingPaymentsPage() {
  const { data: pendingData } = useQuery({
    queryKey: ["sa-sub-claims-pending-count"],
    queryFn: getSaPendingSubClaimsCount,
    staleTime: 30_000,
  });
  const pendingCount = pendingData?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="All Payments" description="Payment records and subscription claims" />

      <Tabs defaultValue="recorded">
        <TabsList>
          <TabsTrigger value="recorded">Recorded Payments</TabsTrigger>
          <TabsTrigger value="claims">
            Pending Claims{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recorded">
          <RecordedPaymentsTab />
        </TabsContent>

        <TabsContent value="claims">
          <PendingClaimsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
