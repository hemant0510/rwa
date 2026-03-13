"use client";

import { use } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { InvoiceTable } from "@/components/features/billing/InvoiceTable";
import { SubscriptionPaymentHistory } from "@/components/features/billing/PaymentHistory";
import { RecordSubscriptionPaymentDialog } from "@/components/features/billing/RecordPayment";
import { SendReminderDialog } from "@/components/features/billing/SendReminder";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { generateInvoice } from "@/services/billing";
import { getSociety } from "@/services/societies";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function SocietyBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data: society } = useQuery({
    queryKey: ["societies", id],
    queryFn: () => getSociety(id),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const due = new Date(today);
      due.setDate(due.getDate() + 7);
      return generateInvoice(id, {
        periodStart: dateOnly(today),
        periodEnd: dateOnly(nextMonth),
        dueDate: dateOnly(due),
      });
    },
    onSuccess: () => {
      toast.success("Invoice generated");
      qc.invalidateQueries({ queryKey: ["subscription-invoices", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Billing - ${society?.name ?? "Society"}`}
        description="Record subscription payments, send reminders, and review invoices"
      >
        <Link href={`/sa/societies/${id}`}>
          <Button variant="outline">Back to Society</Button>
        </Link>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <RecordSubscriptionPaymentDialog societyId={id} />
        <SendReminderDialog societyId={id} />
        <Button onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending}>
          {invoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
        </Button>
      </div>

      <SubscriptionPaymentHistory societyId={id} />
      <InvoiceTable societyId={id} />
    </div>
  );
}
