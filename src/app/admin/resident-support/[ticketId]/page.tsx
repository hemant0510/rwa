"use client";

import { use, useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

import { ResidentConversationThread } from "@/components/features/resident-support/ResidentConversationThread";
import { ResidentTicketStatusBadge } from "@/components/features/resident-support/ResidentTicketStatusBadge";
import { ResidentTicketTypeBadge } from "@/components/features/resident-support/ResidentTicketTypeBadge";
import { TicketAttachments } from "@/components/features/resident-support/TicketAttachments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyId } from "@/hooks/useSocietyId";
import {
  RESIDENT_TICKET_PRIORITIES,
  RESIDENT_TICKET_PRIORITY_LABELS,
  VALID_TRANSITIONS,
} from "@/lib/validations/resident-support";
import { getPetitions } from "@/services/petitions";
import {
  getAdminResidentTicketDetail,
  postAdminResidentMessage,
  changeAdminResidentTicketStatus,
  changeAdminResidentTicketPriority,
  linkTicketPetition,
  uploadAdminResidentAttachment,
} from "@/services/resident-support";

const STATUS_ACTION_LABELS: Record<string, string> = {
  IN_PROGRESS: "Mark In Progress",
  AWAITING_RESIDENT: "Mark Awaiting Resident",
  AWAITING_ADMIN: "Mark Awaiting Admin",
  RESOLVED: "Mark Resolved",
  CLOSED: "Close Ticket",
  OPEN: "Reopen",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const PETITION_TYPE_LABELS: Record<string, string> = {
  COMPLAINT: "Complaint",
  PETITION: "Petition",
  NOTICE: "Notice",
};

async function createPetitionFromTicket(
  ticketId: string,
  type: "COMPLAINT" | "PETITION" | "NOTICE",
): Promise<{ petition: { id: string }; ticket: unknown }> {
  const res = await fetch(`/api/v1/admin/resident-support/${ticketId}/create-petition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to create petition");
  }
  return res.json();
}

export default function AdminResidentTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { societyId, saQueryString } = useSocietyId();

  const isFullAccess = user?.permission === "FULL_ACCESS";

  const [replyContent, setReplyContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [linkPetitionId, setLinkPetitionId] = useState("");

  const { data: petitionsData } = useQuery({
    queryKey: ["admin-petitions-for-link", societyId],
    queryFn: () => getPetitions(societyId, { limit: 100 }),
    enabled: isFullAccess && !!societyId,
    staleTime: 60_000,
  });

  const queryKey = ["admin-resident-ticket", ticketId];

  const { data: ticket, isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminResidentTicketDetail(ticketId),
  });

  const replyMutation = useMutation({
    mutationFn: () => postAdminResidentMessage(ticketId, { content: replyContent, isInternal }),
    onSuccess: () => {
      setReplyContent("");
      setIsInternal(false);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["admin-resident-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-resident-support-unread"] });
      toast.success(isInternal ? "Internal note added" : "Reply sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      changeAdminResidentTicketStatus(ticketId, {
        status: newStatus as Parameters<typeof changeAdminResidentTicketStatus>[1]["status"],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["admin-resident-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-resident-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-resident-support-unread"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: string) =>
      changeAdminResidentTicketPriority(ticketId, {
        priority: priority as Parameters<typeof changeAdminResidentTicketPriority>[1]["priority"],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["admin-resident-tickets"] });
      toast.success("Priority updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMutation = useMutation({
    mutationFn: (petitionId: string | null) => linkTicketPetition(ticketId, petitionId),
    onSuccess: () => {
      setLinkPetitionId("");
      void queryClient.invalidateQueries({ queryKey });
      toast.success(linkPetitionId ? "Petition linked" : "Petition unlinked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPetitionMutation = useMutation({
    mutationFn: (type: "COMPLAINT" | "PETITION" | "NOTICE") =>
      createPetitionFromTicket(ticketId, type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Petition created and linked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* v8 ignore start */
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAdminResidentAttachment(ticketId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Attachment uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  /* v8 ignore stop */

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return <p className="text-muted-foreground py-8 text-center">Ticket not found.</p>;
  }

  const isClosed = ticket.status === "CLOSED";
  const unit = (
    ticket.createdByUser as {
      userUnits?: Array<{ unit: { displayLabel: string } }>;
    }
  ).userUnits?.[0]?.unit.displayLabel;
  /* v8 ignore start */
  const validNextStatuses = VALID_TRANSITIONS[ticket.status] ?? [];
  const ticketPriorityColor = PRIORITY_COLORS[ticket.priority] ?? "";
  const ticketPriorityLabel =
    RESIDENT_TICKET_PRIORITY_LABELS[
      ticket.priority as (typeof RESIDENT_TICKET_PRIORITIES)[number]
    ] ?? ticket.priority;
  const getActionLabel = (s: string) => STATUS_ACTION_LABELS[s] ?? s;
  const petitionTypeLabel = ticket.petition
    ? (PETITION_TYPE_LABELS[ticket.petition.type] ?? ticket.petition.type)
    : null;
  /* v8 ignore stop */

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/resident-support${saQueryString}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={`#${ticket.ticketNumber} — ${ticket.subject}`}
          description={`${ticket.createdByUser.name}${unit ? ` · ${unit}` : ""} · Created ${format(new Date(ticket.createdAt), "dd MMM yyyy")}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`border-0 text-xs font-medium ${ticketPriorityColor}`}
            >
              {ticketPriorityLabel}
            </Badge>
            <ResidentTicketStatusBadge status={ticket.status} />
          </div>
        </PageHeader>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardContent className="pt-4">
              <TicketAttachments
                attachments={[]}
                canUpload={isFullAccess && !isClosed}
                /* v8 ignore start */
                onUpload={(file) => uploadMutation.mutate(file)}
                /* v8 ignore stop */
                isUploading={uploadMutation.isPending}
              />
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResidentConversationThread messages={ticket.messages} showInternal={true} />

              {/* Reply form */}
              {!isClosed && isFullAccess && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="admin-reply">
                        {isInternal
                          ? "Internal note (not visible to resident)"
                          : "Reply to resident"}
                      </Label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Internal note
                      </label>
                    </div>
                    <Textarea
                      id="admin-reply"
                      placeholder="Type your message…"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={4}
                      className={
                        isInternal
                          ? "border-yellow-300 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/10"
                          : ""
                      }
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => replyMutation.mutate()}
                        disabled={!replyContent.trim() || replyMutation.isPending}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {replyMutation.isPending
                          ? "Sending…"
                          : isInternal
                            ? "Add Note"
                            : "Send Reply"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {isClosed && (
                <div className="rounded-md border p-3 text-center">
                  <p className="text-muted-foreground text-sm">
                    This ticket is closed. No further replies are allowed.
                  </p>
                  {ticket.closedReason && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Reason: {ticket.closedReason}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          {isFullAccess && !isClosed && validNextStatuses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {validNextStatuses.map((nextStatus) => (
                  <Button
                    key={nextStatus}
                    variant={nextStatus === "CLOSED" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => statusMutation.mutate(nextStatus)}
                    disabled={statusMutation.isPending}
                  >
                    {getActionLabel(nextStatus)}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Priority */}
          {isFullAccess && !isClosed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={ticket.priority}
                  onValueChange={(v) => priorityMutation.mutate(v)}
                  disabled={priorityMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESIDENT_TICKET_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {RESIDENT_TICKET_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Petition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Linked Petition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.petition ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{ticket.petition.title}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {petitionTypeLabel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ticket.petition.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/petitions/${ticket.petition.id}${saQueryString}`}
                      className="text-xs text-blue-600 underline hover:no-underline"
                    >
                      View petition
                    </Link>
                    {isFullAccess && (
                      <button
                        onClick={() => linkMutation.mutate(null)}
                        disabled={linkMutation.isPending}
                        className="text-muted-foreground hover:text-destructive text-xs underline"
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No petition linked</p>
              )}

              {isFullAccess && (
                <div className="space-y-2 border-t pt-3">
                  {!ticket.petition && (
                    <div className="space-y-2">
                      <Select value={linkPetitionId} onValueChange={setLinkPetitionId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Search petition…" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* v8 ignore start */}
                          {!petitionsData?.data?.length ? (
                            <p className="text-muted-foreground px-2 py-1 text-xs">
                              No petitions found
                            </p>
                          ) : (
                            petitionsData.data.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="text-xs">{p.title}</span>
                              </SelectItem>
                            ))
                          )}
                          {/* v8 ignore stop */}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => linkMutation.mutate(linkPetitionId)}
                        disabled={!linkPetitionId || linkMutation.isPending}
                      >
                        Link Selected Petition
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {(["COMPLAINT", "PETITION", "NOTICE"] as const).map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => createPetitionMutation.mutate(type)}
                        disabled={createPetitionMutation.isPending}
                      >
                        + {PETITION_TYPE_LABELS[type]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <ResidentTicketTypeBadge type={ticket.type} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <ResidentTicketStatusBadge status={ticket.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <Badge
                  variant="outline"
                  className={`border-0 text-xs font-medium ${ticketPriorityColor}`}
                >
                  {ticketPriorityLabel}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resident</span>
                <span className="font-medium">{ticket.createdByUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(ticket.createdAt), "dd MMM yyyy")}</span>
              </div>
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span>{format(new Date(ticket.resolvedAt), "dd MMM yyyy")}</span>
                </div>
              )}
              {ticket.closedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closed</span>
                  <span>{format(new Date(ticket.closedAt), "dd MMM yyyy")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
