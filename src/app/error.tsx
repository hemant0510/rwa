"use client";

import { useEffect } from "react";

import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive h-8 w-8" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <Button onClick={reset} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
