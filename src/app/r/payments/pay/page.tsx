"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { UpiQrDisplay } from "@/components/features/payments/UpiQrDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { getPaymentSetup } from "@/services/payment-setup";

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

export default function PayFeePage() {
  const searchParams = useSearchParams();
  const feeId = searchParams.get("feeId");
  const { user } = useAuth();
  const societyId = user?.societyId ?? "";

  const { data: feesData, isLoading: feesLoading } = useQuery({
    queryKey: ["resident", "fees"],
    queryFn: fetchFees,
    enabled: !!feeId,
  });

  const { data: upiSettings, isLoading: upiLoading } = useQuery({
    queryKey: ["payment-setup", societyId],
    queryFn: () => getPaymentSetup(societyId),
    enabled: !!societyId,
  });

  const fee = feesData?.fees.find((f) => f.id === feeId);
  const amountDue = fee ? fee.amountDue - fee.amountPaid : 0;

  if (feesLoading || upiLoading) return <PageSkeleton />;

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

  const upiConfigured = !!upiSettings?.upiId;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/r/payments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">Pay fee</h1>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4 text-sm">
          <p className="text-muted-foreground">Session: {fee.sessionYear}</p>
          <p className="text-muted-foreground">
            Annual fee: &#8377;{fee.amountDue.toLocaleString("en-IN")}
          </p>
          <p className="text-muted-foreground">
            Already paid: &#8377;{fee.amountPaid.toLocaleString("en-IN")}
          </p>
        </CardContent>
      </Card>

      {upiConfigured ? (
        <>
          <UpiQrDisplay
            upiQrUrl={upiSettings.upiQrUrl}
            upiId={upiSettings.upiId}
            accountName={upiSettings.upiAccountName}
            amount={amountDue}
          />

          <Card>
            <CardContent className="space-y-1 pt-4 text-sm">
              <p className="font-medium">How to pay:</p>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1">
                <li>Open GPay / PhonePe</li>
                <li>Scan QR → Enter &#8377;{amountDue.toLocaleString("en-IN")}</li>
                <li>Return here and confirm</li>
              </ol>
              <p className="text-muted-foreground pt-1 text-xs">
                No convenience fee — pay exactly &#8377;{amountDue.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <Button asChild className="h-12">
              <Link href={`/r/payments/confirm?feeId=${feeId}`}>
                I&apos;ve paid — confirm payment
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/r/payments">Pay later</Link>
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">
              Your society hasn&apos;t set up online payments yet. Ask your admin to configure it in
              Settings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
