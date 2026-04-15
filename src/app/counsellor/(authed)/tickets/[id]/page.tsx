"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { CounsellorMessageComposer } from "@/components/features/counsellor/CounsellorMessageComposer";
import { CounsellorTicketActions } from "@/components/features/counsellor/CounsellorTicketActions";
import { EscalationStatusBadge } from "@/components/features/counsellor/EscalationStatusBadge";
import { SlaTimerBadge } from "@/components/features/counsellor/SlaTimerBadge";
import { ResidentConversationThread } from "@/components/features/resident-support/ResidentConversationThread";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCounsellorTicket } from "@/services/counsellor-self";

const CLOSED_STATUSES = new Set(["RESOLVED_BY_COUNSELLOR", "WITHDRAWN"]);

export default function CounsellorTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const escalationId = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-ticket", escalationId],
    queryFn: () => getCounsellorTicket(escalationId),
  });

  return (
    <div className="space-y-6">
      <Link
        href="/counsellor/tickets"
        className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to tickets
      </Link>

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load escalation: {error.message}
        </div>
      )}

      {!isLoading && !error && !data && (
        <EmptyState title="Escalation not found" description="It may have been withdrawn." />
      )}

      {data && (
        <>
          <PageHeader
            title={`#${data.ticket.ticketNumber} — ${data.ticket.subject}`}
            description={`${data.ticket.society.name} · ${data.ticket.society.societyCode}`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <EscalationStatusBadge status={data.status} />
            <SlaTimerBadge deadline={data.slaDeadline} />
            <span className="text-muted-foreground text-xs">
              {data.ticket.type} · {data.ticket.priority}
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ticket details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Resident: </span>
                {data.ticket.createdByUser.name} ({data.ticket.createdByUser.email})
              </div>
              <div>
                <span className="text-muted-foreground">Raised: </span>
                {format(new Date(data.ticket.createdAt), "PPp")}
              </div>
              {data.reason && (
                <div>
                  <span className="text-muted-foreground">Escalation reason: </span>
                  {data.reason}
                </div>
              )}
              <div className="pt-2">
                <p className="text-muted-foreground text-xs">Description</p>
                <p className="whitespace-pre-wrap">{data.ticket.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <CounsellorTicketActions escalationId={data.id} status={data.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResidentConversationThread messages={data.ticket.messages} showInternal={true} />
              {!CLOSED_STATUSES.has(data.status) && (
                <CounsellorMessageComposer escalationId={data.id} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
