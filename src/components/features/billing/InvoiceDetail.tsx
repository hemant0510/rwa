"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InvoiceDetailCard({
  invoice,
}: {
  invoice: {
    invoiceNo: string;
    planName: string;
    billingCycle: string;
    finalAmount: number;
    status: string;
    dueDate: string;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice {invoice.invoiceNo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Plan: {invoice.planName}</p>
        <p>Billing Cycle: {invoice.billingCycle}</p>
        <p>Amount: ₹{Number(invoice.finalAmount).toLocaleString("en-IN")}</p>
        <p>Due Date: {new Date(invoice.dueDate).toLocaleDateString()}</p>
        <p>Status: {invoice.status}</p>
      </CardContent>
    </Card>
  );
}
