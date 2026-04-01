"use client";

import { use, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";

import { ConversationThread } from "@/components/features/support/ConversationThread";
import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { changeSAStatus, getSARequestDetail, postSAMessage } from "@/services/support";

// ─── Status action config ─────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<
  string,
  { label: string; variant: "default" | "outline" | "destructive"; toStatus: string }[]
> = {
  OPEN: [
    { label: "Pick Up", variant: "default", toStatus: "IN_PROGRESS" },
    { label: "Close", variant: "destructive", toStatus: "CLOSED" },
  ],
  IN_PROGRESS: [
    { label: "Resolve", variant: "default", toStatus: "RESOLVED" },
    { label: "Request Info", variant: "outline", toStatus: "AWAITING_ADMIN" },
    { label: "Close", variant: "destructive", toStatus: "CLOSED" },
  ],
  AWAITING_ADMIN: [
    { label: "Resolve", variant: "default", toStatus: "RESOLVED" },
    { label: "Close", variant: "destructive", toStatus: "CLOSED" },
  ],
  AWAITING_SA: [
    { label: "Reply & Resolve", variant: "default", toStatus: "RESOLVED" },
    { label: "Continue Progress", variant: "outline", toStatus: "IN_PROGRESS" },
    { label: "Close", variant: "destructive", toStatus: "CLOSED" },
  ],
  RESOLVED: [
    { label: "Re-open", variant: "outline", toStatus: "IN_PROGRESS" },
    { label: "Close", variant: "destructive", toStatus: "CLOSED" },
  ],
  CLOSED: [],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SASupportDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const queryClient = useQueryClient();

  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const queryKey = ["sa-support-detail", requestId];

  const { data: request, isLoading } = useQuery({
    queryKey,
    queryFn: () => getSARequestDetail(requestId),
  });

  const replyMutation = useMutation({
    mutationFn: () => postSAMessage(requestId, { content: replyText, isInternal }),
    onSuccess: () => {
      setReplyText("");
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["sa-support-list"] });
      toast.success(isInternal ? "Internal note added" : "Reply sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (toStatus: string) => changeSAStatus(requestId, toStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["sa-support-list"] });
      queryClient.invalidateQueries({ queryKey: ["sa-support-stats"] });
      toast.success("Status updated");
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

  const transitions = STATUS_TRANSITIONS[request.status] ?? [];
  const isClosed = request.status === "CLOSED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`#${request.requestNumber} — ${request.subject}`}
        description={`${request.society?.name ?? ""} · ${request.createdByUser?.name ?? ""} · ${format(new Date(request.createdAt), "dd MMM yyyy")}`}
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

          {/* Conversation thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConversationThread messages={request.messages} showInternal />

              {/* Reply form */}
              {!isClosed && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reply">
                        {isInternal ? (
                          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                            <Lock className="h-3.5 w-3.5" />
                            Internal Note (not visible to admin)
                          </span>
                        ) : (
                          "Reply to Admin"
                        )}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">Internal note</span>
                        <Switch
                          checked={isInternal}
                          onCheckedChange={setIsInternal}
                          id="internal-toggle"
                        />
                      </div>
                    </div>
                    <Textarea
                      id="reply"
                      placeholder={
                        isInternal
                          ? "Add a private note for SA tracking only…"
                          : "Type your reply to the admin…"
                      }
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      className={
                        isInternal
                          ? "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                          : ""
                      }
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => replyMutation.mutate()}
                        disabled={!replyText.trim() || replyMutation.isPending}
                        size="sm"
                        variant={isInternal ? "outline" : "default"}
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
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* SA Actions */}
          {transitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {transitions.map((t) => (
                  <Button
                    key={t.toStatus}
                    variant={t.variant}
                    size="sm"
                    className="w-full"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(t.toStatus)}
                  >
                    {t.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

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
                <span className="text-muted-foreground">Society</span>
                <span className="font-medium">{request.society?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Raised by</span>
                <span className="font-medium">{request.createdByUser?.name ?? "—"}</span>
              </div>
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
              {request.closedReason && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Close reason</span>
                  <p className="text-xs">{request.closedReason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
