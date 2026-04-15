"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { getCounsellorAuditLog } from "@/services/counsellors";

interface Props {
  counsellorId: string;
}

export function CounsellorAuditPanel({ counsellorId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-audit", counsellorId],
    queryFn: () => getCounsellorAuditLog(counsellorId, { pageSize: 50 }),
  });

  if (isLoading) return <CardSkeleton />;
  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
        Failed to load audit log: {error.message}
      </div>
    );
  }
  /* v8 ignore start -- unreachable: query resolves to logs or hits error branch */
  if (!data) return null;
  /* v8 ignore stop */

  if (data.logs.length === 0) {
    return (
      <EmptyState
        title="No audit events"
        description="This counsellor has no recorded actions yet."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Timestamp</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Entity</th>
          </tr>
        </thead>
        <tbody>
          {data.logs.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="text-muted-foreground px-3 py-2 text-xs">
                {new Date(l.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-medium">{l.actionType.replace(/_/g, " ")}</td>
              <td className="text-muted-foreground px-3 py-2 text-xs">
                {l.entityType} · <span className="font-mono">{l.entityId.slice(0, 8)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">
        Showing {data.logs.length} of {data.total} events
      </p>
    </div>
  );
}
