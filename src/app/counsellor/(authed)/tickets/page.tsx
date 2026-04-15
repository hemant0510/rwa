"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { EscalationStatusBadge } from "@/components/features/counsellor/EscalationStatusBadge";
import { SlaTimerBadge } from "@/components/features/counsellor/SlaTimerBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCounsellorTickets } from "@/services/counsellor-self";

type StatusFilter = "open" | "all";

export default function CounsellorTicketsPage() {
  const [filter, setFilter] = useState<StatusFilter>("open");

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-tickets", filter],
    queryFn: () => getCounsellorTickets(filter === "all" ? { status: "all" } : {}),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalated tickets"
        description="Resident tickets escalated to you from the societies you counsel."
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === "open" ? "default" : "outline"}
          onClick={() => setFilter("open")}
        >
          Open
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
      </div>

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load escalations: {error.message}
        </div>
      )}

      {data && data.escalations.length === 0 && (
        <EmptyState
          title="No escalated tickets"
          description={
            filter === "open"
              ? "No open escalations in your portfolio."
              : "No escalations have been assigned to you yet."
          }
        />
      )}

      {data && data.escalations.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {data.escalations.map((e) => (
              <Link
                key={e.id}
                href={`/counsellor/tickets/${e.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      #{e.ticket.ticketNumber} — {e.ticket.subject}
                    </span>
                    <EscalationStatusBadge status={e.status} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {e.ticket.society.name} · {e.ticket.society.societyCode} · {e.ticket.type} ·{" "}
                    {e.ticket.priority}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <SlaTimerBadge deadline={e.slaDeadline} />
                  </div>
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
