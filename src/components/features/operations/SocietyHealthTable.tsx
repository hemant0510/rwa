"use client";

import Link from "next/link";

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
import type { SocietyHealthItem } from "@/services/operations";

const SOCIETY_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  TRIAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function healthColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function healthBg(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 50)
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function formatCurrency(val: number): string {
  if (val >= 100_000) return `\u20B9${(val / 100_000).toFixed(1)}L`;
  if (val >= 1_000) return `\u20B9${(val / 1_000).toFixed(1)}K`;
  return `\u20B9${val.toLocaleString("en-IN")}`;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SocietyHealthTableProps {
  societies: SocietyHealthItem[];
  isLoading: boolean;
}

export function SocietyHealthTable({ societies, isLoading }: SocietyHealthTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Society Health</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !societies.length ? (
          <p className="text-muted-foreground py-8 text-center">No societies found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Society</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Residents</TableHead>
                <TableHead className="hidden text-right md:table-cell">Collection %</TableHead>
                <TableHead className="hidden text-right md:table-cell">Balance</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Events (30d)</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Petitions (30d)</TableHead>
                <TableHead className="hidden lg:table-cell">Last Admin Login</TableHead>
                <TableHead className="text-right">Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {societies.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/sa/societies/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-0 text-xs font-medium ${SOCIETY_STATUS_COLORS[s.status] ?? ""}`}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{s.residents}</TableCell>
                  <TableCell
                    className={`hidden text-right md:table-cell ${healthColor(s.collectionRate)}`}
                  >
                    {s.collectionRate}%
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {formatCurrency(s.balance)}
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">{s.events30d}</TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    {s.petitions30d}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {s.lastAdminLogin ? timeAgo(s.lastAdminLogin) : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={`border-0 text-xs font-bold ${healthBg(s.healthScore)}`}
                    >
                      {s.healthScore}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { healthColor, healthBg, formatCurrency, timeAgo };
