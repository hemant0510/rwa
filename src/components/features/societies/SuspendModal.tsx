"use client";

import { useState } from "react";

import { AlertTriangle, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SuspendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyName: string;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function SuspendModal({
  open,
  onOpenChange,
  societyName,
  onConfirm,
  isPending = false,
}: SuspendModalProps) {
  const [reason, setReason] = useState("");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Suspend {societyName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately restrict access for all admins and residents of this society. They
            will see a suspension notice when they try to log in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="suspend-reason">Reason for suspension</Label>
          <Textarea
            id="suspend-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Overdue subscription payment for 60+ days"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Suspend Society
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
