"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { PaymentClaimForm } from "@/components/features/payments/PaymentClaimForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";

type FeeRecord = {
  id: string;
  sessionYear: string;
  amountDue: number;
  amountPaid: number;
  status: string;
};

async function fetchFees(): Promise<{ fees: FeeRecord[] }> {
  const res = await fetch("/api/v1/residents/me/fees");
  if (!res.ok) throw new Error("Failed to fetch fees");
  return res.json() as Promise<{ fees: FeeRecord[] }>;
}

export default function ConfirmPaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const feeId = searchParams.get("feeId");

  const { data, isLoading } = useQuery({
    queryKey: ["resident", "fees"],
    queryFn: fetchFees,
    enabled: !!feeId,
  });

  const fee = data?.fees.find((f) => f.id === feeId);
  const amountDue = fee ? fee.amountDue - fee.amountPaid : 0;

  if (isLoading) return <PageSkeleton />;

  if (!feeId || !fee) {
    return (
      <div className="space-y-4">
        <Link href="/r/payments" className="text-muted-foreground flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-muted-foreground text-sm">Fee not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/r/payments/pay?feeId=${feeId}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">Confirm payment</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amount paid</CardTitle>
          <CardDescription>
            &#8377;{amountDue.toLocaleString("en-IN")} — Session {fee.sessionYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentClaimForm
            membershipFeeId={feeId}
            amountDue={amountDue}
            onSuccess={() => router.push("/r/payments")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
