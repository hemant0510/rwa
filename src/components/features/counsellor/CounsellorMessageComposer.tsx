"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postCounsellorMessage } from "@/services/counsellor-self";

type Kind = "ADVISORY_TO_ADMIN" | "PRIVATE_NOTE";

interface Props {
  escalationId: string;
  disabled?: boolean;
}

export function CounsellorMessageComposer({ escalationId, disabled = false }: Props) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<Kind>("ADVISORY_TO_ADMIN");

  const mutation = useMutation({
    mutationFn: () => postCounsellorMessage(escalationId, { content: content.trim(), kind }),
    onSuccess: () => {
      toast.success(kind === "ADVISORY_TO_ADMIN" ? "Advisory posted" : "Private note saved");
      qc.invalidateQueries({ queryKey: ["counsellor-ticket", escalationId] });
      setContent("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = content.trim().length > 0 && !mutation.isPending && !disabled;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <Label className="text-xs">Message type</Label>
        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === "ADVISORY_TO_ADMIN" ? "default" : "outline"}
            onClick={() => setKind("ADVISORY_TO_ADMIN")}
          >
            Advisory to admin
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "PRIVATE_NOTE" ? "default" : "outline"}
            onClick={() => setKind("PRIVATE_NOTE")}
          >
            Private note
          </Button>
        </div>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder={
          kind === "ADVISORY_TO_ADMIN"
            ? "Visible to RWA admins"
            : "Visible only to you (not shown to admin or resident)"
        }
        disabled={disabled}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!canSubmit}>
          <Send className="mr-1 h-4 w-4" /> Post
        </Button>
      </div>
    </div>
  );
}
