"use client";

import { Lock } from "lucide-react";

interface InternalNoteProps {
  content: string;
  timestamp: string;
}

export function InternalNote({ content, timestamp }: InternalNoteProps) {
  return (
    <div className="rounded-md border border-dashed border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/20">
      <div className="mb-1 flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
          Internal Note
        </span>
        <span className="text-muted-foreground text-xs">{timestamp}</span>
      </div>
      <p className="text-sm">{content}</p>
    </div>
  );
}
