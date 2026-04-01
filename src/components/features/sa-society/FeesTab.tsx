"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FeeItem {
  id: string;
  userName: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  session: string;
}

interface FeesTabProps {
  fees: FeeItem[];
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  OVERDUE: "bg-red-100 text-red-700",
  EXEMPTED: "bg-blue-100 text-blue-700",
};

export function FeesTab({ fees, isLoading }: FeesTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!fees.length)
    return <p className="text-muted-foreground py-8 text-center text-sm">No fee records</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Resident</TableHead>
          <TableHead className="text-right">Due</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Session</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fees.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="font-medium">{f.userName}</TableCell>
            <TableCell className="text-right">{`\u20B9${Number(f.amountDue).toLocaleString("en-IN")}`}</TableCell>
            <TableCell className="text-right">{`\u20B9${Number(f.amountPaid).toLocaleString("en-IN")}`}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={`border-0 text-xs ${STATUS_COLORS[f.status] ?? ""}`}
              >
                {f.status}
              </Badge>
            </TableCell>
            <TableCell>{f.session}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
