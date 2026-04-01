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

interface MigrationBatch {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
}

interface MigrationsTabProps {
  migrations: MigrationBatch[];
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

export function MigrationsTab({ migrations, isLoading }: MigrationsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!migrations.length)
    return <p className="text-muted-foreground py-8 text-center text-sm">No migration batches</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Success</TableHead>
          <TableHead className="text-right">Errors</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {migrations.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">{m.fileName}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={`border-0 text-xs ${STATUS_COLORS[m.status] ?? ""}`}
              >
                {m.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{m.totalRows}</TableCell>
            <TableCell className="text-right">{m.successCount}</TableCell>
            <TableCell className="text-right">{m.errorCount}</TableCell>
            <TableCell>{new Date(m.createdAt).toLocaleDateString("en-IN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
