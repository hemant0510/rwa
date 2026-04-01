"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AuditLogEntry {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  performedBy: string;
  performedByName?: string;
  details: string | null;
  createdAt: string;
}

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  isLoading: boolean;
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogTable({ logs, isLoading }: AuditLogTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !logs.length ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No audit logs found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {formatAction(log.actionType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{log.entityType}</TableCell>
                  <TableCell>{log.performedByName ?? log.performedBy}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {log.details ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { formatAction, formatDate };
