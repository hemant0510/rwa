"use client";

import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Query key factory
export const queryKeys = {
  societies: {
    all: ["societies"] as const,
    detail: (id: string) => ["societies", id] as const,
    byCode: (code: string) => ["societies", "code", code] as const,
  },
  residents: {
    all: (societyId: string) => ["residents", societyId] as const,
    detail: (id: string) => ["residents", "detail", id] as const,
    pending: (societyId: string) => ["residents", societyId, "pending"] as const,
  },
  fees: {
    dashboard: (societyId: string, session?: string) => ["fees", societyId, session] as const,
    detail: (feeId: string) => ["fees", "detail", feeId] as const,
    sessions: (societyId: string) => ["fees", "sessions", societyId] as const,
  },
  expenses: {
    list: (societyId: string) => ["expenses", societyId] as const,
  },
};
