"use client";

import Link from "next/link";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import type { CounsellorResidentListItem } from "@/types/counsellor";

interface Props {
  societyId: string;
  residents: CounsellorResidentListItem[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE_PAID") return "default";
  if (status === "SUSPENDED" || status === "REJECTED") return "destructive";
  return "secondary";
}

export function ResidentDirectoryReadOnly({
  societyId,
  residents,
  total,
  page,
  pageSize,
  search,
  onSearchChange,
  onPageChange,
  isLoading,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showEmpty = !isLoading && residents.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2 h-4 w-4" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, email, or mobile"
            className="pl-8"
            aria-label="Search residents"
          />
        </div>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {total} resident{total === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading residents…</p>}

      {showEmpty && (
        <EmptyState
          title="No residents found"
          description={search ? "Try a different search term." : "This society has no residents."}
        />
      )}

      {!isLoading && residents.length > 0 && (
        <ul className="divide-y rounded-md border bg-white">
          {residents.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/counsellor/societies/${societyId}/residents/${r.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <Badge variant={statusVariant(r.status)} className="text-[10px]">
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {r.unitLabel ?? "No unit"} · {r.email}
                  {r.mobile && ` · ${r.mobile}`}
                </p>
              </div>
              <Link
                href={`/counsellor/societies/${societyId}/residents/${r.id}`}
                className="text-xs text-emerald-700 hover:underline"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
