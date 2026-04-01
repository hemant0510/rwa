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

interface EventItem {
  id: string;
  title: string;
  category: string;
  status: string;
  eventDate: string;
  registrationCount?: number;
}

interface EventsTabProps {
  events: EventItem[];
  isLoading: boolean;
}

export function EventsTab({ events, isLoading }: EventsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!events.length)
    return <p className="text-muted-foreground py-8 text-center text-sm">No events found</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Registrations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="font-medium">{e.title}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {e.category}
              </Badge>
            </TableCell>
            <TableCell>{e.status}</TableCell>
            <TableCell>{new Date(e.eventDate).toLocaleDateString("en-IN")}</TableCell>
            <TableCell className="text-right">{e.registrationCount ?? 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
