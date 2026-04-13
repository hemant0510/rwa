"use client";

import { useEffect, useState } from "react";

import { Car, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SearchMode = "people" | "vehicle";

interface VehicleSearchBarProps {
  mode: SearchMode;
  query: string;
  onModeChange: (mode: SearchMode) => void;
  onQueryChange: (query: string) => void;
  debounceMs?: number;
  minQueryLength?: number;
  className?: string;
}

export function VehicleSearchBar({
  mode,
  query,
  onModeChange,
  onQueryChange,
  debounceMs = 300,
  minQueryLength = 3,
  className,
}: VehicleSearchBarProps) {
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => setLocalQuery(query), [query]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (localQuery !== query) {
        onQueryChange(localQuery);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQuery, debounceMs]);

  const placeholder =
    mode === "vehicle"
      ? "Search by registration, make, or colour…"
      : "Search by name, email, or phone…";

  const belowMinimum =
    mode === "vehicle" && localQuery.trim().length > 0 && localQuery.trim().length < minQueryLength;

  return (
    <div className={className}>
      <div className="mb-2 inline-flex rounded-md border bg-white p-0.5">
        <Button
          type="button"
          size="sm"
          variant={mode === "people" ? "default" : "ghost"}
          className="h-7 gap-1.5 rounded-[4px] px-2 text-xs"
          onClick={() => onModeChange("people")}
          aria-pressed={mode === "people"}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          By Name / Email / Phone
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "vehicle" ? "default" : "ghost"}
          className="h-7 gap-1.5 rounded-[4px] px-2 text-xs"
          onClick={() => onModeChange("vehicle")}
          aria-pressed={mode === "vehicle"}
        >
          <Car className="h-3.5 w-3.5" aria-hidden="true" />
          By Vehicle
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={placeholder}
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          className="pl-9"
          aria-label={mode === "vehicle" ? "Search vehicles" : "Search residents"}
        />
      </div>

      {belowMinimum && (
        <p className="text-muted-foreground mt-1 text-xs">
          Type at least {minQueryLength} characters to search vehicles.
        </p>
      )}
    </div>
  );
}
