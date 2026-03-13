"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  societyId: string;
  societyName: string;
  societyCode: string;
  planName: string;
  billingCycle: string | null;
  status: string;
  periodEndDate: string | null;
  amountDue: number;
  lastPaymentDate: string | null;
};

export function SubscriptionListTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Society</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Billing</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Period End</TableHead>
          <TableHead>Amount Due</TableHead>
          <TableHead>Last Payment</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.societyId}>
            <TableCell>
              <div className="font-medium">{row.societyName}</div>
              <div className="text-muted-foreground text-xs">{row.societyCode}</div>
            </TableCell>
            <TableCell>{row.planName}</TableCell>
            <TableCell>{row.billingCycle ?? "-"}</TableCell>
            <TableCell>
              <Badge variant="outline">{row.status}</Badge>
            </TableCell>
            <TableCell>
              {row.periodEndDate ? new Date(row.periodEndDate).toLocaleDateString() : "-"}
            </TableCell>
            <TableCell>₹{row.amountDue.toLocaleString("en-IN")}</TableCell>
            <TableCell>
              {row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString() : "-"}
            </TableCell>
            <TableCell className="space-x-2 text-right">
              <Link href={`/sa/societies/${row.societyId}`}>
                <Button size="sm" variant="outline">
                  View
                </Button>
              </Link>
              <Link href={`/sa/societies/${row.societyId}/billing`}>
                <Button size="sm">Billing</Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
