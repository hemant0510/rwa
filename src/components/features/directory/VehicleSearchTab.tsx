"use client";

import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Car, Home, Loader2, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { searchVehicles, type VehicleSearchResult } from "@/services/vehicles";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export function VehicleSearchTab() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const effectiveQuery = debouncedQuery.length >= MIN_QUERY_LENGTH ? debouncedQuery : "";

  const { data, isFetching } = useQuery({
    queryKey: ["directory-vehicle-search", effectiveQuery],
    queryFn: () => searchVehicles(effectiveQuery),
    enabled: !!effectiveQuery,
  });

  const results: VehicleSearchResult[] = data ?? [];
  const hasMinQuery = debouncedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search by registration, make, or colour…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Search vehicles"
        />
      </div>

      {!hasMinQuery && (
        <p className="text-muted-foreground text-xs">
          Type at least {MIN_QUERY_LENGTH} characters to search.
        </p>
      )}

      {hasMinQuery && isFetching && (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Searching vehicles…
        </div>
      )}

      {hasMinQuery && !isFetching && results.length === 0 && (
        <EmptyState
          icon={<Car className="text-muted-foreground h-8 w-8" />}
          title="No matching vehicles"
          description="Check the registration number or owner name and try again."
        />
      )}

      {hasMinQuery && results.length > 0 && (
        <div className="bg-card divide-y rounded-xl border shadow-sm">
          {results.map((v) => (
            <div
              key={v.id}
              className="hover:bg-muted/40 flex items-center gap-4 px-4 py-3 transition-colors"
            >
              <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                <Car className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono font-semibold">{v.registrationNumber}</span>
                  {v.colour && <span className="text-muted-foreground text-xs">· {v.colour}</span>}
                  {(v.make || v.model) && (
                    <span className="text-muted-foreground text-xs">
                      · {[v.make, v.model].filter(Boolean).join(" ")}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  {v.unit?.displayLabel && (
                    <span className="flex items-center gap-1">
                      <Home className="h-3 w-3" aria-hidden="true" />
                      {v.unit.displayLabel}
                    </span>
                  )}
                  {v.owner?.name && <span>Owner: {v.owner.name}</span>}
                  {v.dependentOwner?.name && <span>Driver: {v.dependentOwner.name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
