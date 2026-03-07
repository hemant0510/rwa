"use client";

import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSocietyId } from "@/hooks/useSocietyId";
import { getBroadcasts, sendBroadcast } from "@/services/notifications";

const FILTER_LABELS: Record<string, string> = {
  ALL_ACTIVE: "All Active Residents",
  FEE_PENDING: "Fee Pending Only",
  FEE_OVERDUE: "Fee Overdue Only",
};

export default function BroadcastPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("ALL_ACTIVE");

  const { data: broadcasts } = useQuery({
    queryKey: ["broadcasts", societyId],
    queryFn: () => getBroadcasts(societyId),
    enabled: !!societyId,
  });

  const mutation = useMutation({
    mutationFn: () => sendBroadcast(societyId, { message, recipientFilter }),
    onSuccess: () => {
      toast.success("Broadcast sent!");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Broadcast" description="Send WhatsApp messages to residents" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            New Broadcast
          </CardTitle>
          <CardDescription>Compose a message to send to residents via WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Recipients</Label>
            <Select value={recipientFilter} onValueChange={setRecipientFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_ACTIVE">All Active Residents</SelectItem>
                <SelectItem value="FEE_PENDING">Fee Pending Only</SelectItem>
                <SelectItem value="FEE_OVERDUE">Fee Overdue Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Type your message here... (minimum 10 characters)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                {message.length < 10 ? `${10 - message.length} more chars needed` : "Ready to send"}
              </span>
              <span>{message.length}/2000</span>
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={message.length < 10 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Broadcast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast History</CardTitle>
        </CardHeader>
        <CardContent>
          {!broadcasts?.data?.length ? (
            <EmptyState
              icon={<MessageSquare className="text-muted-foreground h-8 w-8" />}
              title="No broadcasts sent yet"
              description="Your sent broadcasts will appear here."
            />
          ) : (
            <div className="space-y-3">
              {broadcasts.data.map((b) => (
                <div key={b.id} className="rounded-md border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {FILTER_LABELS[b.recipientFilter] || b.recipientFilter}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {b.recipientCount} recipients
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(b.sentAt), "dd MMM yyyy, hh:mm a")}
                    </span>
                  </div>
                  <p className="text-sm">{b.message}</p>
                  <p className="text-muted-foreground mt-1 text-xs">Sent by {b.sender.name}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
