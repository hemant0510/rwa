"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  castEscalationVote,
  getResidentEscalationStatus,
  withdrawEscalationVote,
} from "@/services/resident-support";

interface Props {
  ticketId: string;
  canVote: boolean;
}

export function EscalationVoteWidget({ ticketId, canVote }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["resident-ticket-escalation-status", ticketId],
    queryFn: () => getResidentEscalationStatus(ticketId),
    refetchInterval: 30_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["resident-ticket-escalation-status", ticketId] });

  const castMutation = useMutation({
    mutationFn: () => castEscalationVote(ticketId),
    onSuccess: (res) => {
      toast.success(
        res.escalationCreated
          ? "Threshold reached — ticket escalated to counsellor"
          : "Your vote has been recorded",
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawEscalationVote(ticketId),
    onSuccess: () => {
      toast.success("Your vote has been withdrawn");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Counsellor escalation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  const pct = Math.min(100, Math.round((data.voteCount / data.threshold) * 100));
  const pending = castMutation.isPending || withdrawMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {data.escalationCreated ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
          )}
          Counsellor escalation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.escalationCreated ? (
          <p className="text-sm text-emerald-700">
            This ticket has been escalated to the society counsellor.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {data.voteCount} of {data.threshold} resident votes to escalate this ticket to the
              counsellor.
            </p>
            <Progress value={pct} aria-label="Escalation vote progress" />
          </>
        )}

        {canVote && !data.escalationCreated && (
          <div className="flex gap-2">
            {data.hasVoted ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => withdrawMutation.mutate()}
                disabled={pending}
              >
                <ShieldOff className="mr-1.5 h-4 w-4" />
                Withdraw my vote
              </Button>
            ) : (
              <Button size="sm" onClick={() => castMutation.mutate()} disabled={pending}>
                <ShieldAlert className="mr-1.5 h-4 w-4" />
                Support escalation
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
