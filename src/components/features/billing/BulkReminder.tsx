"use client";

import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { sendBulkReminders } from "@/services/billing";

type TemplateKey = "expiry-reminder" | "overdue-reminder" | "trial-ending";

export function BulkReminderSheet({
  societies,
}: {
  societies: Array<{ id: string; name: string }>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [templateKey, setTemplateKey] = useState<TemplateKey>("expiry-reminder");
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => sendBulkReminders(selected, templateKey),
    onSuccess: () => {
      toast.success("Bulk reminders sent");
      setOpen(false);
      setSelected([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Bulk Send Reminders</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Bulk Reminder</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Reminder Type</Label>
            <Select value={templateKey} onValueChange={(v) => setTemplateKey(v as TemplateKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reminder type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry-reminder">Expiry Reminder</SelectItem>
                <SelectItem value="overdue-reminder">Overdue Reminder</SelectItem>
                <SelectItem value="trial-ending">Trial Ending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {societies.map((society) => (
              <label key={society.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(society.id)}
                  onCheckedChange={() => toggle(society.id)}
                />
                {society.name}
              </label>
            ))}
          </div>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || selected.length === 0}
          >
            {mutation.isPending ? "Sending..." : `Send (${selected.length})`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
