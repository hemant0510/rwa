"use client";

import { Button } from "@/components/ui/button";

export function InvoicePDF({ societyId, invoiceId }: { societyId: string; invoiceId: string }) {
  const href = `/api/v1/societies/${societyId}/subscription/invoices/${invoiceId}/pdf`;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Button variant="outline">Download PDF</Button>
    </a>
  );
}
