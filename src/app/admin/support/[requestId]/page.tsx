"use client";

import { use, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { ConversationThread } from "@/components/features/support/ConversationThread";
import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import { StatusTimeline } from "@/components/features/support/StatusTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getAdminRequestDetail, postAdminMessage, reopenRequest } from "@/services/support";

// Derive status timeline events from message history + request metadata
function buildTimelineEvents(request: {
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  status: string;
}): { status: string; timestamp: string; label?: string }[] {
  const events: { status: string; timestamp: string; label?: string }[] = [
    { status: "OPEN", timestamp: request.createdAt, label: "Request created" },
  ];
  if (request.resolvedAt) {
    events.push({ status: "RESOLVED", timestamp: request.resolvedAt, label: "Resolved" });
  }
  if (request.closedAt) {
    events.push({ status: "CLOSED", timestamp: request.closedAt, label: "Closed" });
  }
  return events;
}

export default function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");

  const queryKey = ["admin-support-detail", requestId];

  const { data: request, isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminRequestDetail(requestId),
  });

  const replyMutation = useMutation({
    mutationFn: () => postAdminMessage(requestId, { content: replyText, isInternal: false }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      toast.success("Reply sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      toast.success("Request reopened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  if (!request) {
    return <p className="text-muted-foreground py-8 text-center">Request not found.</p>;
  }

  const isClosed = request.status === "CLOSED";
  const isResolved = request.status === "RESOLVED";
  const isAwaitingAdmin = request.status === "AWAITING_ADMIN";

  // Reopen eligibility: RESOLVED and within 7 days
  const canReopen =
    isResolved &&
    request.resolvedAt &&
    differenceInDays(new Date(), new Date(request.resolvedAt)) < 7;

  const timelineEvents = buildTimelineEvents(request);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`#${request.requestNumber} — ${request.subject}`}
        description={`Created ${format(new Date(request.createdAt), "dd MMM yyyy")}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={request.priority} />
          <SupportStatusBadge status={request.status} />
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{request.description}</p>
            </CardContent>
          </Card>

          {/* Status-specific prompt */}
          {isAwaitingAdmin && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                The platform team needs more information from you.
              </p>
              <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-400">
                Please reply below with the requested details.
              </p>
            </div>
          )}

          {isResolved && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                This request has been resolved.
              </p>
              <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
                {canReopen
                  ? "If your issue is not resolved, you can reopen this request within 7 days."
                  : "The 7-day reopen window has passed. Please create a new request if needed."}
              </p>
            </div>
          )}

          {/* Conversation thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConversationThread messages={request.messages} showInternal={false} />

              {/* Reply form — only for non-closed requests */}
              {!isClosed && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label htmlFor="reply">
                      {isAwaitingAdmin ? "Provide the requested information" : "Add a reply"}
                    </Label>
                    <Textarea
                      id="reply"
                      placeholder="Type your message…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        {canReopen && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reopenMutation.mutate()}
                            disabled={reopenMutation.isPending}
                          >
                            Reopen Request
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => replyMutation.mutate()}
                        disabled={!replyText.trim() || replyMutation.isPending}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {replyMutation.isPending ? "Sending…" : "Send Reply"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Closed state */}
              {isClosed && (
                <div className="rounded-md border p-3 text-center">
                  <p className="text-muted-foreground text-sm">
                    This request is closed. Please create a new request if you need further help.
                  </p>
                  {request.closedReason && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Reason: {request.closedReason}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className="text-xs">
                  {request.type.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <PriorityBadge priority={request.priority} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <SupportStatusBadge status={request.status} />
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(request.createdAt), "dd MMM yyyy")}</span>
              </div>
              {request.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span>{format(new Date(request.resolvedAt), "dd MMM yyyy")}</span>
                </div>
              )}
              {request.closedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closed</span>
                  <span>{format(new Date(request.closedAt), "dd MMM yyyy")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline events={timelineEvents} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
