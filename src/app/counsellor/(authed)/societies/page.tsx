"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSocieties } from "@/services/counsellor-self";

export default function CounsellorSocietiesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-societies"],
    queryFn: getSocieties,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My societies"
        description="Societies Super Admin has assigned to your portfolio."
      />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load societies: {error.message}
        </div>
      )}

      {data && data.societies.length === 0 && (
        <EmptyState
          title="No societies assigned"
          description="You have not been assigned to any society yet."
        />
      )}

      {data && data.societies.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {data.societies.map((s) => (
              <Link
                key={s.id}
                href={`/counsellor/societies/${s.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    {s.isPrimary && (
                      <Badge variant="default" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {s.societyCode} · {s.city}, {s.state} · {s.totalUnits} units
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
