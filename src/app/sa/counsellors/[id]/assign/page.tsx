"use client";

import { useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, FileUp, Search } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { assignSocieties, listAvailableSocieties } from "@/services/counsellors";

export default function AssignSocietiesPage() {
  /* v8 ignore start */
  const params = useParams<{ id: string }>();
  const counsellorId = params?.id ?? "";
  /* v8 ignore stop */
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [csvCodes, setCsvCodes] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["available-societies", counsellorId, search],
    queryFn: () => listAvailableSocieties(counsellorId, search || undefined),
    enabled: Boolean(counsellorId),
  });

  const societies = useMemo(() => data?.societies ?? [], [data]);

  const { matched, unmatched } = useMemo(() => {
    if (!csvCodes) return { matched: [] as string[], unmatched: [] as string[] };
    const codeSet = new Set(csvCodes.map((c) => c.toUpperCase()));
    const m: string[] = [];
    for (const s of societies) {
      if (codeSet.has(s.societyCode.toUpperCase())) m.push(s.id);
    }
    const matchedCodesUpper = new Set(
      societies.filter((s) => m.includes(s.id)).map((s) => s.societyCode.toUpperCase()),
    );
    const um = csvCodes.filter((c) => !matchedCodesUpper.has(c.toUpperCase()));
    return { matched: m, unmatched: um };
  }, [csvCodes, societies]);

  const mutation = useMutation({
    mutationFn: () => {
      const ids = Array.from(selected);
      return assignSocieties(counsellorId, { societyIds: ids });
    },
    onSuccess: (result) => {
      const total = result.assigned + result.reactivated;
      toast.success(
        total > 0
          ? `Assigned ${total} ${total === 1 ? "society" : "societies"}.`
          : `All ${result.alreadyActive} were already assigned.`,
      );
      router.push(`/sa/counsellors/${counsellorId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === societies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(societies.map((s) => s.id)));
    }
  }

  function handleCsv(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (res) => {
        const codes: string[] = [];
        for (const row of res.data as unknown as string[][]) {
          const value = (row[0] ?? "").trim();
          if (value && value.toLowerCase() !== "society_code") codes.push(value);
        }
        setCsvCodes(codes);
      },
      error: () => {
        toast.error("Failed to parse CSV file");
      },
    });
  }

  function applyCsvSelection() {
    if (matched.length === 0) {
      toast.error("No matching societies found in this counsellor's available list.");
      return;
    }
    setSelected(new Set(matched));
    toast.success(
      `Pre-selected ${matched.length} matched societies${
        unmatched.length > 0 ? ` (${unmatched.length} codes did not match)` : ""
      }.`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/sa/counsellors/${counsellorId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Back to counsellor
      </Link>

      <PageHeader
        title="Assign Societies"
        description="Multi-select from available societies, or upload a CSV of society codes."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk upload (CSV)</CardTitle>
          <CardDescription>
            One column with header <code>society_code</code> (or no header). Rows are matched
            against this counsellor&apos;s available societies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              data-testid="csv-input"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                /* v8 ignore next */
                if (f) handleCsv(f);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-1 h-4 w-4" />
              Choose CSV
            </Button>
            {csvCodes && (
              <span className="text-muted-foreground text-sm">
                {csvCodes.length} code{csvCodes.length === 1 ? "" : "s"} loaded — {matched.length}{" "}
                matched, {unmatched.length} unmatched
              </span>
            )}
          </div>
          {csvCodes && (
            <Button size="sm" onClick={applyCsvSelection} disabled={mutation.isPending}>
              Apply CSV selection
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder="Search by name, code, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load societies: {error.message}
        </div>
      )}

      {!isLoading && !error && societies.length === 0 && (
        <EmptyState
          icon={<Search className="text-muted-foreground h-8 w-8" />}
          title="No available societies"
          description="All societies are either inactive, suspended, or already assigned to this counsellor."
        />
      )}

      {societies.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <div className="bg-muted/30 flex items-center gap-3 border-b px-4 py-2 text-sm">
            <Checkbox
              checked={selected.size === societies.length}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            <span className="text-muted-foreground">
              {selected.size} of {societies.length} selected
            </span>
          </div>
          {societies.map((s) => (
            <label
              key={s.id}
              className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs">
                  {s.societyCode} · {s.city}, {s.state} · {s.totalUnits} units · {s.plan}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/sa/counsellors/${counsellorId}`)}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={selected.size === 0 || mutation.isPending}
        >
          {/* v8 ignore start */}
          {mutation.isPending ? "Assigning..." : null}
          {/* v8 ignore stop */}
          {!mutation.isPending &&
            `Assign ${selected.size} ${selected.size === 1 ? "society" : "societies"}`}
        </Button>
      </div>
    </div>
  );
}
