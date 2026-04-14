"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { Plus, Search, UserPlus } from "lucide-react";

import { CounsellorRow } from "@/components/features/sa-counsellors/CounsellorRow";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { listCounsellors } from "@/services/counsellors";

type StatusFilter = "all" | "active" | "inactive";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  active: "Active",
  inactive: "Suspended",
};

export default function CounsellorsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellors", { search, status }],
    queryFn: () =>
      listCounsellors({
        search: search || undefined,
        status: status === "all" ? undefined : status,
      }),
  });

  const counsellors = data?.counsellors ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Counsellors"
        description="Platform-appointed advisors (Great Admins) overseeing portfolios of societies."
      >
        <Link href="/sa/counsellors/new">
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            New Counsellor
          </Button>
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "inactive"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load counsellors: {error.message}
        </div>
      )}

      {!isLoading && !error && counsellors.length === 0 && (
        <EmptyState
          icon={<UserPlus className="text-muted-foreground h-8 w-8" />}
          title="No counsellors yet"
          description="Appoint your first platform-level ombudsperson."
          action={
            <Link href="/sa/counsellors/new">
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                New Counsellor
              </Button>
            </Link>
          }
        />
      )}

      {!isLoading && !error && counsellors.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          {counsellors.map((c) => (
            <CounsellorRow key={c.id} counsellor={c} />
          ))}
        </div>
      )}

      {data && data.total > counsellors.length && (
        <p className="text-muted-foreground text-xs">
          Showing {counsellors.length} of {data.total}. Refine search to narrow results.
        </p>
      )}
    </div>
  );
}
