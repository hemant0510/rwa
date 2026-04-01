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

interface GoverningBodyMember {
  id: string;
  userName: string;
  designation: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

interface GoverningBodyTabProps {
  members: GoverningBodyMember[];
  isLoading: boolean;
}

export function GoverningBodyTab({ members, isLoading }: GoverningBodyTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!members.length)
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">No governing body members</p>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">{m.userName}</TableCell>
            <TableCell>{m.designation}</TableCell>
            <TableCell>{new Date(m.startDate).toLocaleDateString("en-IN")}</TableCell>
            <TableCell>
              {m.endDate ? new Date(m.endDate).toLocaleDateString("en-IN") : "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={`border-0 text-xs ${m.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
              >
                {m.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
