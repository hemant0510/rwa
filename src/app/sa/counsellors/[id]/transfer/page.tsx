"use client";

import { useState } from "react";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { listCounsellors, transferPortfolio } from "@/services/counsellors";

export default function TransferPortfolioPage() {
  /* v8 ignore start */
  const params = useParams<{ id: string }>();
  const sourceId = params?.id ?? "";
  /* v8 ignore stop */
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ id: string; name: string; email: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellors", { search, status: "active" as const }],
    queryFn: () => listCounsellors({ search: search || undefined, status: "active", pageSize: 50 }),
  });

  const candidates = (data?.counsellors ?? []).filter((c) => c.id !== sourceId);

  const mutation = useMutation({
    mutationFn: () => {
      /* v8 ignore start */
      if (!target) throw new Error("Pick a target counsellor first");
      /* v8 ignore stop */
      return transferPortfolio(sourceId, { targetCounsellorId: target.id });
    },
    onSuccess: (result) => {
      toast.success(
        result.transferred > 0
          ? `Transferred ${result.transferred} ${result.transferred === 1 ? "society" : "societies"} to ${target?.name}.`
          : "No societies needed transfer (target was already assigned to all of them).",
      );
      router.push(`/sa/counsellors/${sourceId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/sa/counsellors/${sourceId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Back to counsellor
      </Link>

      <PageHeader
        title="Transfer Portfolio"
        description="Move all active society assignments from this counsellor to another active counsellor."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target counsellor</CardTitle>
          <CardDescription>
            Pick the active counsellor who will take over this portfolio. The transfer applies to
            ALL active assignments and runs in a single transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search active counsellors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading && <CardSkeleton />}

          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
              Failed to load counsellors: {error.message}
            </div>
          )}

          {!isLoading && !error && candidates.length === 0 && (
            <EmptyState
              icon={<Search className="text-muted-foreground h-8 w-8" />}
              title="No other active counsellors"
              description="You need at least one other active counsellor to transfer a portfolio."
            />
          )}

          {candidates.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <input
                    type="radio"
                    name="target"
                    value={c.id}
                    checked={target?.id === c.id}
                    onChange={() => setTarget({ id: c.id, name: c.name, email: c.email })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {c.email} · {c._count.assignments} assigned
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/sa/counsellors/${sourceId}`)}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={!target || mutation.isPending}>
          {/* v8 ignore start */}
          {mutation.isPending ? "Transferring..." : null}
          {/* v8 ignore stop */}
          {!mutation.isPending && (target ? `Transfer to ${target.name}` : "Pick a target")}
        </Button>
      </div>
    </div>
  );
}
