"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSocietyResident } from "@/services/counsellor-self";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CounsellorResidentDetailPage() {
  const params = useParams<{ id: string; rid: string }>();
  const societyId = params.id;
  const residentId = params.rid;

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-resident", societyId, residentId],
    queryFn: () => getSocietyResident(societyId, residentId),
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/counsellor/societies/${societyId}`}
        className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to society
      </Link>

      <PageHeader
        title={data?.name ?? "Resident"}
        description={data ? `${data.society.name}` : undefined}
      />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load resident: {error.message}
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>Contact & status</span>
                <Badge variant="secondary">{data.status.replace(/_/g, " ")}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Email" value={data.email} />
              <Row label="Mobile" value={data.mobile ?? "—"} />
              <Row label="Ownership" value={data.ownershipType ?? "—"} />
              <Row label="Registered" value={formatDate(data.registeredAt)} />
              <Row label="Approved" value={formatDate(data.approvedAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Units ({data.units.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 text-sm">
              {data.units.length === 0 ? (
                <p className="text-muted-foreground">No units linked.</p>
              ) : (
                <ul className="divide-y">
                  {data.units.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.displayLabel}</span>
                          {u.isPrimary && (
                            <Badge variant="default" className="text-[10px]">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {u.relationship}
                          {u.towerBlock && ` · Tower ${u.towerBlock}`}
                          {u.floorNo && ` · Floor ${u.floorNo}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
