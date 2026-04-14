"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  adminEscalateTicket,
  adminNotifyCounsellor,
  adminWithdrawEscalation,
} from "@/services/resident-support";

type Mode = "ESCALATE" | "NOTIFY" | "WITHDRAW";

interface ActiveEscalation {
  id: string;
  source: "ADMIN_ASSIGN" | "ADMIN_NOTIFY" | "RESIDENT_VOTE" | "SUPER_ADMIN_FORCE";
  status: string;
}

interface Props {
  ticketId: string;
  activeEscalation: ActiveEscalation | null;
  disabled?: boolean;
}

export function EscalationActions({ ticketId, activeEscalation, disabled = false }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");

  const close = () => {
    setMode(null);
    setReason("");
  };

  const escalateMutation = useMutation({
    mutationFn: () => adminEscalateTicket(ticketId, reason),
    onSuccess: () => {
      toast.success("Ticket escalated to counsellor");
      qc.invalidateQueries({ queryKey: ["admin-resident-ticket", ticketId] });
      close();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notifyMutation = useMutation({
    mutationFn: () => adminNotifyCounsellor(ticketId, reason),
    onSuccess: () => {
      toast.success("Counsellor notified");
      qc.invalidateQueries({ queryKey: ["admin-resident-ticket", ticketId] });
      close();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => adminWithdrawEscalation(ticketId, reason || undefined),
    onSuccess: () => {
      toast.success("Escalation withdrawn");
      qc.invalidateQueries({ queryKey: ["admin-resident-ticket", ticketId] });
      close();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitting =
    escalateMutation.isPending || notifyMutation.isPending || withdrawMutation.isPending;

  const isActive = activeEscalation !== null;
  const canWithdraw = isActive && activeEscalation.source !== "RESIDENT_VOTE";

  const onSubmit = () => {
    if (mode === "ESCALATE") escalateMutation.mutate();
    else if (mode === "NOTIFY") notifyMutation.mutate();
    else withdrawMutation.mutate();
  };

  const reasonTooShort = (mode === "ESCALATE" || mode === "NOTIFY") && reason.trim().length < 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Counsellor escalation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isActive ? (
          <p className="text-muted-foreground text-sm">
            Status: <span className="font-medium">{activeEscalation.status}</span> (
            {activeEscalation.source.replace("_", " ").toLowerCase()})
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            This ticket is not currently escalated to the counsellor.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isActive && (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={disabled}
                onClick={() => setMode("ESCALATE")}
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                Escalate
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => setMode("NOTIFY")}
              >
                <BellRing className="mr-1.5 h-4 w-4" />
                Notify counsellor
              </Button>
            </>
          )}
          {canWithdraw && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setMode("WITHDRAW")}
            >
              <Undo2 className="mr-1.5 h-4 w-4" />
              Withdraw escalation
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "ESCALATE"
                ? "Escalate to counsellor"
                : mode === "NOTIFY"
                  ? "Notify counsellor"
                  : "Withdraw escalation"}
            </DialogTitle>
            <DialogDescription>
              {mode === "WITHDRAW"
                ? "Optional reason for withdrawing this escalation."
                : "Describe why the counsellor needs to be involved (minimum 10 characters)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="escalation-reason">Reason</Label>
            <Textarea
              id="escalation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder={
                mode === "WITHDRAW" ? "Optional note…" : "e.g. Conflict between residents…"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={submitting || reasonTooShort}>
              {/* v8 ignore start */}
              {submitting ? "Submitting…" : "Confirm"}
              {/* v8 ignore stop */}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
