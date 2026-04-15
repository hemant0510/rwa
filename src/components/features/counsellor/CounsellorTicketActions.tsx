"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidEscalationTransition } from "@/lib/validations/escalation";
import {
  acknowledgeEscalation,
  deferEscalation,
  resolveEscalation,
} from "@/services/counsellor-self";

type Mode = "ACKNOWLEDGE" | "RESOLVE" | "DEFER";

interface Props {
  escalationId: string;
  status: string;
}

export function CounsellorTicketActions({ escalationId, status }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");

  const close = () => {
    setMode(null);
    setText("");
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["counsellor-ticket", escalationId] });
    qc.invalidateQueries({ queryKey: ["counsellor-tickets"] });
  };

  const ackMutation = useMutation({
    mutationFn: () => acknowledgeEscalation(escalationId),
    onSuccess: () => {
      toast.success("Escalation acknowledged");
      invalidate();
      close();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveEscalation(escalationId, { summary: text.trim() }),
    onSuccess: () => {
      toast.success("Escalation resolved");
      invalidate();
      close();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deferMutation = useMutation({
    mutationFn: () => deferEscalation(escalationId, { reason: text.trim() }),
    onSuccess: () => {
      toast.success("Escalation deferred to admin");
      invalidate();
      close();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canAck = isValidEscalationTransition(status, "ACKNOWLEDGED");
  const canResolve = isValidEscalationTransition(status, "RESOLVED_BY_COUNSELLOR");
  const canDefer = isValidEscalationTransition(status, "DEFERRED_TO_ADMIN");

  const submitting = ackMutation.isPending || resolveMutation.isPending || deferMutation.isPending;

  const onSubmit = () => {
    if (mode === "ACKNOWLEDGE") ackMutation.mutate();
    else if (mode === "RESOLVE") resolveMutation.mutate();
    else if (mode === "DEFER") deferMutation.mutate();
  };

  const dialogTitle =
    mode === "ACKNOWLEDGE"
      ? "Acknowledge escalation"
      : mode === "RESOLVE"
        ? "Resolve with advisory"
        : "Defer to admin";
  const dialogDesc =
    mode === "ACKNOWLEDGE"
      ? "Confirm that you are starting work on this escalation."
      : mode === "RESOLVE"
        ? "Summarise the outcome for the RWA admin (min 10 characters)."
        : "Explain why this needs admin action (min 10 characters).";

  const needsText = mode === "RESOLVE" || mode === "DEFER";
  const textValid = !needsText || text.trim().length >= 10;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={!canAck}
          onClick={() => setMode("ACKNOWLEDGE")}
        >
          <CheckCircle2 className="mr-1 h-4 w-4" /> Acknowledge
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={!canResolve}
          onClick={() => setMode("RESOLVE")}
        >
          <Send className="mr-1 h-4 w-4" /> Resolve
        </Button>
        <Button size="sm" variant="outline" disabled={!canDefer} onClick={() => setMode("DEFER")}>
          <RotateCcw className="mr-1 h-4 w-4" /> Defer to admin
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDesc}</DialogDescription>
          </DialogHeader>

          {needsText && (
            <div className="space-y-2">
              <Label htmlFor="action-text">{mode === "RESOLVE" ? "Summary" : "Reason"}</Label>
              <Textarea
                id="action-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Minimum 10 characters"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={submitting || !textValid}>
              {/* v8 ignore start */}
              {submitting ? "Submitting…" : "Confirm"}
              {/* v8 ignore stop */}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
