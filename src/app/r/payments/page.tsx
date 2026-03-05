"use client";

import { CreditCard, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";

// TODO: Fetch from API
const PAYMENT_HISTORY = [
  {
    id: "1",
    sessionYear: "2025-26",
    amountDue: 1200,
    amountPaid: 1200,
    status: "PAID",
    payments: [
      {
        id: "p1",
        amount: 1200,
        paymentMode: "UPI",
        receiptNo: "EDEN-2025-R001",
        paymentDate: "2025-04-15",
      },
    ],
  },
  {
    id: "2",
    sessionYear: "2024-25",
    amountDue: 1200,
    amountPaid: 1200,
    status: "PAID",
    payments: [
      {
        id: "p2",
        amount: 1200,
        paymentMode: "CASH",
        receiptNo: "EDEN-2024-R001",
        paymentDate: "2024-04-10",
      },
    ],
  },
];

const STATUS_COLORS: Record<string, string> = {
  PAID: "border-green-200 bg-green-50 text-green-700",
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  PARTIAL: "border-orange-200 bg-orange-50 text-orange-700",
  EXEMPTED: "border-purple-200 bg-purple-50 text-purple-700",
};

export default function ResidentPaymentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment History</h1>

      {PAYMENT_HISTORY.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="text-muted-foreground h-8 w-8" />}
          title="No payments yet"
          description="Your payment history will appear here."
        />
      ) : (
        PAYMENT_HISTORY.map((fee) => (
          <Card key={fee.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Session {fee.sessionYear}</CardTitle>
                <Badge variant="outline" className={STATUS_COLORS[fee.status] || ""}>
                  {fee.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount Due</span>
                <span className="font-medium">
                  {"\u20B9"}
                  {fee.amountDue.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">
                  {"\u20B9"}
                  {fee.amountPaid.toLocaleString("en-IN")}
                </span>
              </div>

              {fee.payments.map((p) => (
                <div
                  key={p.id}
                  className="bg-muted/30 flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {"\u20B9"}
                      {p.amount.toLocaleString("en-IN")} via {p.paymentMode}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">{p.receiptNo}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
