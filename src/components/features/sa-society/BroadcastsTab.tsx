"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BroadcastItem {
  id: string;
  subject: string;
  channel: string;
  sentAt: string;
  recipientCount?: number;
}

interface BroadcastsTabProps {
  broadcasts: BroadcastItem[];
  isLoading: boolean;
}

export function BroadcastsTab({ broadcasts, isLoading }: BroadcastsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!broadcasts.length)
    return <p className="text-muted-foreground py-8 text-center text-sm">No broadcasts sent</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead className="text-right">Recipients</TableHead>
          <TableHead>Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {broadcasts.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.subject}</TableCell>
            <TableCell>{b.channel}</TableCell>
            <TableCell className="text-right">{b.recipientCount ?? 0}</TableCell>
            <TableCell>{new Date(b.sentAt).toLocaleDateString("en-IN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
