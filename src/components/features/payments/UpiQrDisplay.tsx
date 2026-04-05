"use client";

import { useState } from "react";

import Image from "next/image";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UpiQrDisplayProps {
  upiQrUrl: string | null;
  upiId: string | null;
  accountName: string | null;
  amount: number;
}

export function UpiQrDisplay({ upiQrUrl, upiId, accountName, amount }: UpiQrDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast("Copied!", { duration: 1500 });
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 pt-6">
        <p className="text-2xl font-bold">&#8377;{amount.toLocaleString("en-IN")}</p>

        {upiQrUrl ? (
          <div className="overflow-hidden rounded-lg border">
            <Image
              src={upiQrUrl}
              alt="Society UPI QR code"
              width={250}
              height={250}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
        ) : (
          <div className="text-muted-foreground flex h-[250px] w-[250px] items-center justify-center rounded-lg border border-dashed text-center text-sm">
            QR not configured
          </div>
        )}

        {upiId && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="font-mono text-sm">{upiId}</p>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "📋 Copy UPI"}
            </Button>
          </div>
        )}

        {accountName && <p className="text-muted-foreground text-sm">{accountName}</p>}
      </CardContent>
    </Card>
  );
}
