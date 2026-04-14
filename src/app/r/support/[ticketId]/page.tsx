"use client";

import { useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { EscalationVoteWidget } from "@/components/features/resident-support/EscalationVoteWidget";
import { ResidentConversationThread } from "@/components/features/resident-support/ResidentConversationThread";
import { ResidentTicketStatusBadge } from "@/components/features/resident-support/ResidentTicketStatusBadge";
import { ResidentTicketTypeBadge } from "@/components/features/resident-support/ResidentTicketTypeBadge";
import { TicketAttachments } from "@/components/features/resident-support/TicketAttachments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { RESIDENT_TICKET_PRIORITY_LABELS } from "@/lib/validations/resident-support";
import type { Petition } from "@/services/petitions";
import { getResidentPetitions } from "@/services/petitions";
import {
  getResidentTicketDetail,
  getResidentTicketAttachments,
  linkResidentTicketPetition,
  postResidentTicketMessage,
  reopenResidentTicket,
  uploadResidentTicketAttachment,
} from "@/services/resident-support";

// ── Priority badge colors ──────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

// ── Petition Link Card ─────────────────────────────────────────────────────

interface PetitionLinkCardProps {
  ticketId: string;
  currentPetitionId: string | null;
  currentPetition: { id: string; title: string; type: string; status: string } | null;
  isCreator: boolean;
  isClosed: boolean;
}

function PetitionLinkCard({
  ticketId,
  currentPetitionId,
  currentPetition,
  isCreator,
  isClosed,
}: PetitionLinkCardProps) {
  const queryClient = useQueryClient();
  const [showSelect, setShowSelect] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: petitionsData } = useQuery({
    queryKey: ["resident-petitions"],
    queryFn: getResidentPetitions,
    enabled: isCreator && showSelect,
  });

  /* v8 ignore start */
  const petitions: Petition[] = (petitionsData?.data ?? []).filter(
    (p) => p.status === "PUBLISHED" || p.status === "SUBMITTED",
  );
  /* v8 ignore stop */

  const linkMutation = useMutation({
    mutationFn: (petitionId: string | null) => linkResidentTicketPetition(ticketId, petitionId),
    onSuccess: () => {
      /* v8 ignore start */
      toast.success(currentPetitionId && !selectedId ? "Petition unlinked." : "Petition linked.");
      /* v8 ignore stop */
      setShowSelect(false);
      setSelectedId("");
      void queryClient.invalidateQueries({ queryKey: ["resident-ticket", ticketId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleLink = () => {
    /* v8 ignore start */
    if (!selectedId) return;
    linkMutation.mutate(selectedId);
    /* v8 ignore stop */
  };

  const handleUnlink = () => {
    linkMutation.mutate(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Related Petition</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentPetition ? (
          <div className="space-y-2">
            <div className="rounded-md border p-3 text-sm">
              <p className="leading-snug font-medium">{currentPetition.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {currentPetition.type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {currentPetition.status}
                </Badge>
              </div>
            </div>
            {(currentPetition.status === "PUBLISHED" || currentPetition.status === "SUBMITTED") && (
              <a
                href={`/r/petitions`}
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View Petition
              </a>
            )}
            {isCreator && !isClosed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                onClick={handleUnlink}
                disabled={linkMutation.isPending}
              >
                <Link2Off className="mr-1 h-3 w-3" />
                Unlink
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No petition linked</p>
        )}

        {isCreator && !isClosed && !currentPetition && (
          <div className="space-y-2">
            {showSelect ? (
              <div className="space-y-2">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select petition…" />
                  </SelectTrigger>
                  <SelectContent>
                    {petitions.length === 0 ? (
                      <p className="text-muted-foreground px-2 py-1 text-xs">
                        No published petitions
                      </p>
                    ) : (
                      /* v8 ignore start */
                      petitions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="text-xs">{p.title}</span>
                        </SelectItem>
                      ))
                      /* v8 ignore stop */
                    )}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleLink}
                    disabled={/* v8 ignore next */ !selectedId || linkMutation.isPending}
                  >
                    {/* v8 ignore start */}
                    {linkMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {/* v8 ignore stop */}
                    Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setShowSelect(false);
                      setSelectedId("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowSelect(true)}
              >
                <Link2 className="mr-1 h-3 w-3" />
                Link to Petition
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ResidentTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const ticketId = params.ticketId as string;

  const [replyContent, setReplyContent] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["resident-ticket", ticketId],
    queryFn: () => getResidentTicketDetail(ticketId),
    enabled: !!ticketId,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["resident-ticket-attachments", ticketId],
    queryFn: () => getResidentTicketAttachments(ticketId),
    enabled: !!ticketId,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      postResidentTicketMessage(ticketId, { content, isInternal: false }),
    onSuccess: () => {
      toast.success("Message sent.");
      setReplyContent("");
      void queryClient.invalidateQueries({ queryKey: ["resident-ticket", ticketId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenResidentTicket(ticketId),
    onSuccess: () => {
      toast.success("Ticket reopened.");
      void queryClient.invalidateQueries({ queryKey: ["resident-ticket", ticketId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadResidentTicketAttachment(ticketId, file),
    onSuccess: () => {
      toast.success("File uploaded.");
      void queryClient.invalidateQueries({
        queryKey: ["resident-ticket-attachments", ticketId],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="text-muted-foreground">Ticket not found.</p>
      </div>
    );
  }

  const isCreator = ticket.createdBy === user?.id;
  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";
  const isAwaitingResident = ticket.status === "AWAITING_RESIDENT";

  const canReopen =
    isCreator &&
    isResolved &&
    ticket.resolvedAt != null &&
    differenceInDays(new Date(), new Date(ticket.resolvedAt)) <= 7;

  const canReply = !isClosed;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/r/support")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Support
      </Button>

      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono text-sm">#{ticket.ticketNumber}</span>
          <ResidentTicketStatusBadge status={ticket.status} />
          <ResidentTicketTypeBadge type={ticket.type} />
          {/* v8 ignore start */}
          <Badge
            variant="outline"
            className={`border-0 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] ?? ""}`}
          >
            {RESIDENT_TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
          </Badge>
          {/* v8 ignore stop */}
        </div>
        <h1 className="text-xl font-bold">{ticket.subject}</h1>
        <p className="text-muted-foreground text-sm">
          Raised by {ticket.createdByUser.name} ·{" "}
          {format(new Date(ticket.createdAt), "dd MMM yyyy")}
        </p>
      </div>

      {/* Status banners */}
      {isAwaitingResident && (
        <div
          data-testid="awaiting-resident-banner"
          className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Action required
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              The support team is waiting for your reply.
            </p>
          </div>
        </div>
      )}
      {isResolved && (
        <div
          data-testid="resolved-banner"
          className="flex items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Ticket resolved
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              This ticket has been marked as resolved.
              {canReopen ? " You can reopen it if the issue persists." : ""}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardContent className="pt-4">
              <TicketAttachments
                attachments={attachments}
                canUpload={isCreator && !isClosed}
                onUpload={(file) => uploadMutation.mutate(file)}
                isUploading={uploadMutation.isPending}
              />
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResidentConversationThread messages={ticket.messages} showInternal={false} />

              {/* Reply form */}
              {canReply && (
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="reply-content">Reply</Label>
                  <Textarea
                    id="reply-content"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    maxLength={5000}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      /* v8 ignore start */
                      if (replyContent.trim()) {
                        replyMutation.mutate(replyContent.trim());
                      }
                      /* v8 ignore stop */
                    }}
                    disabled={!replyContent.trim() || replyMutation.isPending}
                  >
                    {/* v8 ignore start */}
                    {replyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {/* v8 ignore stop */}
                    Send Reply
                  </Button>
                </div>
              )}

              {isClosed && (
                <p
                  data-testid="closed-notice"
                  className="text-muted-foreground pt-2 text-center text-sm"
                >
                  This ticket is closed. No further replies can be added.
                </p>
              )}

              {/* Reopen button */}
              {canReopen && (
                <div className="border-t pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reopenMutation.mutate()}
                    disabled={reopenMutation.isPending}
                  >
                    {/* v8 ignore start */}
                    {reopenMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {/* v8 ignore stop */}
                    Reopen Ticket
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <ResidentTicketTypeBadge type={ticket.type} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                {/* v8 ignore start */}
                <Badge
                  variant="outline"
                  className={`border-0 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] ?? ""}`}
                >
                  {RESIDENT_TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                </Badge>
                {/* v8 ignore stop */}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <ResidentTicketStatusBadge status={ticket.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-right">
                  {format(new Date(ticket.createdAt), "dd MMM yyyy")}
                </span>
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

          {/* Handled By card */}
          {(ticket.assignees?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Handled By</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {ticket.assignees?.map((a) => (
                  <div key={a.id} className="text-sm">
                    <span className="font-medium">{a.assignee.name}</span>
                    {a.assignee.governingBodyMembership && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        · {a.assignee.governingBodyMembership.designation.name}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Petition linking card */}
          <PetitionLinkCard
            ticketId={ticketId}
            currentPetitionId={ticket.petitionId}
            currentPetition={ticket.petition}
            isCreator={isCreator}
            isClosed={isClosed}
          />

          {/* Counsellor escalation widget */}
          {!isClosed && <EscalationVoteWidget ticketId={ticketId} canVote={!isCreator} />}
        </div>
      </div>
    </div>
  );
}
