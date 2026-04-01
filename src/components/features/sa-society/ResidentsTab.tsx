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

interface Resident {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: string;
  ownershipType: string | null;
}

interface ResidentsTabProps {
  residents: Resident[];
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-700",
  DEACTIVATED: "bg-gray-100 text-gray-700",
};

export function ResidentsTab({ residents, isLoading }: ResidentsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!residents.length) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No residents found</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Mobile</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ownership</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {residents.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell>{r.email}</TableCell>
            <TableCell>{r.mobile ?? "—"}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={`border-0 text-xs ${STATUS_COLORS[r.status] ?? ""}`}
              >
                {r.status.replace(/_/g, " ")}
              </Badge>
            </TableCell>
            <TableCell>{r.ownershipType ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
