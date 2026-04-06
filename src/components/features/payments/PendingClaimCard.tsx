"use client";

import { useState } from "react";

import { CheckCircle, ExternalLink, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentClaim } from "@/types/payment";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface PendingClaimCardProps {
  claim: PaymentClaim;
  onVerify: (id: string, adminNotes?: string) => void;
  onReject: (id: string, reason: string) => void;
  isPending: boolean;
}

export function PendingClaimCard({ claim, onVerify, onReject, isPending }: PendingClaimCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const handleRejectSubmit = () => {
    if (rejectionReason.trim().length < 10) return;
    onReject(claim.id, rejectionReason.trim());
    setShowRejectForm(false);
    setRejectionReason("");
  };

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(claim.claimedAmount));

  const claimDate = new Date(claim.paymentDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const submittedAt = new Date(claim.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">
              {claim.user?.name ?? "Unknown"} — Flat {claim.user?.unitNumber ?? "—"}
            </p>
            <p className="text-muted-foreground text-sm">
              Claimed: {formattedAmount} via UPI | Date: {claimDate}
            </p>
            <p className="text-muted-foreground text-sm">UTR: {claim.utrNumber}</p>
            <p className="text-muted-foreground text-xs">Submitted: {submittedAt}</p>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 border-0 font-medium ${STATUS_COLORS[claim.status] ?? ""}`}
          >
            {claim.status}
          </Badge>
        </div>

        {claim.screenshotUrl && (
          <a
            href={claim.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View Screenshot
          </a>
        )}

        {claim.status === "PENDING" && (
          <>
            <div className="space-y-1">
              <Label htmlFor={`notes-${claim.id}`} className="text-xs">
                Admin Notes (optional)
              </Label>
              <Textarea
                id={`notes-${claim.id}`}
                placeholder="Internal notes..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>

            {!showRejectForm ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onVerify(claim.id, adminNotes || undefined)}
                  disabled={isPending}
                  className="flex-1"
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isPending}
                  className="flex-1"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`reason-${claim.id}`} className="text-xs">
                  Rejection Reason (min 10 characters)
                </Label>
                <Textarea
                  id={`reason-${claim.id}`}
                  placeholder="e.g. UTR not found in bank statement"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRejectSubmit}
                    disabled={isPending || rejectionReason.trim().length < 10}
                    className="flex-1"
                  >
                    Confirm Rejection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionReason("");
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {claim.status === "REJECTED" && claim.rejectionReason && (
          <p className="text-muted-foreground text-xs">Reason: {claim.rejectionReason}</p>
        )}

        {claim.adminNotes && (
          <p className="text-muted-foreground text-xs">Notes: {claim.adminNotes}</p>
        )}
      </CardContent>
    </Card>
  );
}
