"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Star, Users } from "lucide-react";

import { RELATIONSHIP_LABELS } from "@/components/features/family/RelationshipBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { type AdminFamilyMember, getResidentFamily } from "@/services/admin-residents";

const BLOOD_GROUP_LABELS: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
  UNKNOWN: "Unknown",
};

interface ResidentFamilyTabProps {
  residentId: string;
}

export function ResidentFamilyTab({ residentId }: ResidentFamilyTabProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-resident", residentId, "family"],
    queryFn: () => getResidentFamily(residentId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700">Unable to load family members.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  /* v8 ignore start */
  const members: AdminFamilyMember[] = data ?? [];
  /* v8 ignore stop */

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<Users className="text-muted-foreground h-8 w-8" />}
        title="No family members"
        description="This resident has not added any dependents yet."
      />
    );
  }

  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Relationship</th>
              <th className="px-3 py-2 text-left font-medium">Age</th>
              <th className="px-3 py-2 text-left font-medium">Blood</th>
              <th className="px-3 py-2 text-left font-medium">Emergency</th>
              <th className="px-3 py-2 text-left font-medium">ID Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {active.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
            {inactive.length > 0 && (
              <tr className="bg-muted/20">
                <td
                  colSpan={6}
                  className="text-muted-foreground px-3 py-1.5 text-xs font-semibold uppercase"
                >
                  Inactive ({inactive.length})
                </td>
              </tr>
            )}
            {inactive.map((m) => (
              <MemberRow key={m.id} member={m} inactive />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberRow({ member, inactive }: { member: AdminFamilyMember; inactive?: boolean }) {
  const relationshipLabel =
    member.relationship === "OTHER" && member.otherRelationship
      ? member.otherRelationship
      : (RELATIONSHIP_LABELS[member.relationship] ?? member.relationship);

  const rowClass = inactive ? "text-muted-foreground line-through" : "";

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800">{member.name}</span>
          {member.memberId && (
            <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[10px]">
              {member.memberId}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs">{relationshipLabel}</td>
      <td className="px-3 py-2 text-xs">{member.age ?? "—"}</td>
      <td className="px-3 py-2 text-xs">
        {member.bloodGroup ? (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-700">
            {BLOOD_GROUP_LABELS[member.bloodGroup] ?? member.bloodGroup}
          </Badge>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {member.isEmergencyContact ? (
          <span
            aria-label={
              /* v8 ignore next */
              `Emergency contact priority ${member.emergencyPriority ?? ""}`
            }
            className="inline-flex items-center gap-1 text-amber-700"
          >
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden="true" />
            {member.emergencyPriority === 1 ? "Primary" : "Secondary"}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {member.idProofSignedUrl ? (
          <a
            href={member.idProofSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            View
          </a>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
