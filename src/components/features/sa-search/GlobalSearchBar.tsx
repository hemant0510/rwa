"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Loader2, Search } from "lucide-react";

import {
  SearchResults,
  type SearchResultsData,
} from "@/components/features/sa-search/SearchResults";

const EMPTY_RESULTS: SearchResultsData = {
  societies: [],
  residents: [],
  payments: [],
  events: [],
  petitions: [],
};

export function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultsData>(EMPTY_RESULTS);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setResults(EMPTY_RESULTS);
    setQuery("");
  }, []);

  // Ctrl+K / Meta+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        closeDropdown();
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDropdown]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  // Debounced search
  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults(EMPTY_RESULTS);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/super-admin/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as SearchResultsData;
          setResults(data);
          setIsOpen(true);
        }
      } catch {
        // Silently handle network errors
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="Search residents, societies, transactions..."
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-md border py-2 pr-12 pl-9 text-sm focus-visible:ring-1 focus-visible:outline-none"
        />
        {isLoading ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
        ) : (
          <kbd className="bg-muted text-muted-foreground pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-xs sm:inline-block">
            Ctrl+K
          </kbd>
        )}
      </div>

      {isOpen && (
        <div className="bg-popover border-border absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border shadow-lg">
          <div className="max-h-[400px] overflow-y-auto">
            <SearchResults results={results} onSelect={closeDropdown} />
          </div>
        </div>
      )}
    </div>
  );
}
