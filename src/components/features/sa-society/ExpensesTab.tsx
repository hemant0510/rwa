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

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  status: string;
  date: string;
}

interface ExpensesTabProps {
  expenses: ExpenseItem[];
  isLoading: boolean;
}

export function ExpensesTab({ expenses, isLoading }: ExpensesTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!expenses.length)
    return <p className="text-muted-foreground py-8 text-center text-sm">No expenses found</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="font-medium">{e.title}</TableCell>
            <TableCell className="text-right">{`\u20B9${Number(e.amount).toLocaleString("en-IN")}`}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {e.category.replace(/_/g, " ")}
              </Badge>
            </TableCell>
            <TableCell>{e.status}</TableCell>
            <TableCell>{new Date(e.date).toLocaleDateString("en-IN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
