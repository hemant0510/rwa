"use client";

import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendReminder } from "@/services/billing";

export function SendReminderDialog({ societyId }: { societyId: string }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<"expiry-reminder" | "overdue-reminder" | "trial-ending">(
    "expiry-reminder",
  );

  const mutation = useMutation({
    mutationFn: () => sendReminder(societyId, template),
    onSuccess: () => {
      toast.success("Reminder sent");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Send Reminder</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={template} onValueChange={(v) => setTemplate(v as typeof template)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expiry-reminder">Expiry Reminder</SelectItem>
              <SelectItem value="overdue-reminder">Overdue Reminder</SelectItem>
              <SelectItem value="trial-ending">Trial Ending</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
