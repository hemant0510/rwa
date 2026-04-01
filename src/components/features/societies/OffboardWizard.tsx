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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OffboardWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyName: string;
  onConfirm: (data: { reason: string; deleteData: boolean }) => void;
  isPending?: boolean;
}

export function OffboardWizard({
  open,
  onOpenChange,
  societyName,
  onConfirm,
  isPending = false,
}: OffboardWizardProps) {
  const [reason, setReason] = useState("");
  const [deleteData, setDeleteData] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Offboard {societyName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action is irreversible. The society will be permanently removed from the platform.
            All admin and resident access will be revoked.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offboard-reason">Reason for offboarding</Label>
            <Textarea
              id="offboard-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Society dissolved, contract terminated"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="delete-data"
              checked={deleteData}
              onCheckedChange={(v) => setDeleteData(v === true)}
            />
            <Label htmlFor="delete-data" className="text-sm">
              Delete all society data (residents, fees, expenses, events)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-offboard"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            <Label htmlFor="confirm-offboard" className="text-sm font-medium text-red-600">
              I understand this action cannot be undone
            </Label>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm({ reason, deleteData })}
            disabled={!reason.trim() || !confirmed || isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Offboard Society
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
