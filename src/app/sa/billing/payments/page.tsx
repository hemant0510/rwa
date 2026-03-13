"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllPayments } from "@/services/billing";

interface PaymentRow {
  id: string;
  societyName: string;
  societyCode: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  invoiceNo: string;
  paymentDate: string;
  isReversal: boolean;
  isReversed: boolean;
  createdAt: string;
}

export default function SuperAdminBillingPaymentsPage() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["sa-all-payments", page],
    queryFn: () => getAllPayments({ page, limit }),
  });

  const rows: PaymentRow[] = data?.rows ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Payments"
        description={`${total} payment records across all societies`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading payments...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payment records found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Society</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.societyName}</div>
                        <div className="text-muted-foreground text-xs">{row.societyCode}</div>
                      </TableCell>
                      <TableCell>{new Date(row.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell className={row.isReversal ? "text-destructive" : ""}>
                        {row.isReversal ? "-" : ""}₹{Math.abs(row.amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>{row.paymentMode.replace("_", " ")}</TableCell>
                      <TableCell>{row.referenceNo || "-"}</TableCell>
                      <TableCell>{row.invoiceNo}</TableCell>
                      <TableCell>
                        {row.isReversal ? (
                          <Badge variant="destructive">Reversal</Badge>
                        ) : row.isReversed ? (
                          <Badge variant="secondary">Reversed</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
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
