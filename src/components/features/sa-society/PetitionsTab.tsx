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

interface PetitionItem {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  signatureCount?: number;
}

interface PetitionsTabProps {
  petitions: PetitionItem[];
  isLoading: boolean;
}

export function PetitionsTab({ petitions, isLoading }: PetitionsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!petitions.length)
    return <p className="text-muted-foreground py-8 text-center text-sm">No petitions found</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Signatures</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {petitions.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.title}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {p.type}
              </Badge>
            </TableCell>
            <TableCell>{p.status}</TableCell>
            <TableCell className="text-right">{p.signatureCount ?? 0}</TableCell>
            <TableCell>{new Date(p.createdAt).toLocaleDateString("en-IN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
