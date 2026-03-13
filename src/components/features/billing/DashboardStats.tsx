"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BillingDashboardStats({
  data,
}: {
  data: {
    totalActive: number;
    expiringSoon: number;
    expired: number;
    trialEnding: number;
    revenueThisMonth: number;
    pendingInvoices: number;
  };
}) {
  const items = [
    { label: "Total Active", value: data.totalActive },
    { label: "Expiring Soon (30d)", value: data.expiringSoon },
    { label: "Expired", value: data.expired },
    { label: "Trial Ending (7d)", value: data.trialEnding },
    { label: "Revenue This Month", value: `₹${data.revenueThisMonth.toLocaleString("en-IN")}` },
    { label: "Pending Invoices", value: data.pendingInvoices },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
