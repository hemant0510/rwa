"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInvoices } from "@/services/billing";

export function InvoiceTable({ societyId }: { societyId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["subscription-invoices", societyId],
    queryFn: () => getInvoices(societyId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading invoices...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Final Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(
                (invoice: {
                  id: string;
                  invoiceNo: string;
                  periodStart: string;
                  periodEnd: string;
                  finalAmount: number;
                  paidAmount: number;
                  status: string;
                }) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoiceNo}</TableCell>
                    <TableCell>
                      {new Date(invoice.periodStart).toLocaleDateString()} -{" "}
                      {new Date(invoice.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell>₹{Number(invoice.finalAmount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{Number(invoice.paidAmount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.status}</Badge>
                    </TableCell>
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
