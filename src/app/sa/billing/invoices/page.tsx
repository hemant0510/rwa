"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllInvoices } from "@/services/billing";

interface InvoiceRow {
  id: string;
  societyId: string;
  societyName: string;
  societyCode: string;
  invoiceNo: string;
  planName: string;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  finalAmount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  PAID: "default",
  UNPAID: "outline",
  PARTIALLY_PAID: "secondary",
  OVERDUE: "destructive",
  WAIVED: "secondary",
  CANCELLED: "secondary",
};

export default function SuperAdminBillingInvoicesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["sa-all-invoices", page, status],
    queryFn: () => getAllInvoices({ page, limit, status }),
  });

  const rows: InvoiceRow[] = data?.rows ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <PageHeader title="All Invoices" description={`${total} invoices across all societies`} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoices</CardTitle>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="WAIVED">Waived</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading invoices...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Society</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="font-medium">{inv.societyName}</div>
                        <div className="text-muted-foreground text-xs">{inv.societyCode}</div>
                      </TableCell>
                      <TableCell>{inv.invoiceNo}</TableCell>
                      <TableCell>
                        <div>{inv.planName}</div>
                        <div className="text-muted-foreground text-xs">{inv.billingCycle}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(inv.periodStart).toLocaleDateString()} -{" "}
                        {new Date(inv.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell>₹{inv.finalAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>
                          {inv.status}
                        </Badge>
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
    </div>
  );
}
