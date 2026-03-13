"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSubscriptionPayments } from "@/services/billing";

export function SubscriptionPaymentHistory({ societyId }: { societyId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["subscription-payments", societyId],
    queryFn: () => getSubscriptionPayments(societyId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading payments...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(
                (row: {
                  id: string;
                  paymentDate: string;
                  amount: number;
                  paymentMode: string;
                  referenceNo: string | null;
                  invoiceNo: string;
                }) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>₹{Number(row.amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>{row.paymentMode}</TableCell>
                    <TableCell>{row.referenceNo || "-"}</TableCell>
                    <TableCell>{row.invoiceNo}</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
