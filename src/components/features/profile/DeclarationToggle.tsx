"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type DeclarationStatus = "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";

interface DeclarationToggleProps {
  status: DeclarationStatus;
  declareLabel: string;
  declaredLabel: string;
  onDeclareNone: () => void;
  onUndo: () => void;
  pending?: boolean;
}

export function DeclarationToggle({
  status,
  declareLabel,
  declaredLabel,
  onDeclareNone,
  onUndo,
  pending = false,
}: DeclarationToggleProps) {
  if (status === "HAS_ENTRIES") return null;

  if (status === "DECLARED_NONE") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="text-slate-600">{declaredLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={pending}
          onClick={onUndo}
          aria-label="Undo declaration"
        >
          {/* v8 ignore start */}
          {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {/* v8 ignore stop */}
          Undo
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs"
      disabled={pending}
      onClick={onDeclareNone}
    >
      {/* v8 ignore start */}
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      {/* v8 ignore stop */}
      {declareLabel}
    </Button>
  );
}
