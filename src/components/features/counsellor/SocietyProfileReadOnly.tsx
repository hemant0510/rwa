import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CounsellorSocietyDetail } from "@/types/counsellor";

interface Props {
  society: CounsellorSocietyDetail;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SocietyProfileReadOnly({ society }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>{society.name}</span>
            {society.isPrimary && <Badge variant="default">Primary</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Code" value={society.societyCode} />
          <Row label="City" value={`${society.city}, ${society.state}`} />
          <Row label="Pincode" value={society.pincode} />
          <Row label="Total units" value={String(society.totalUnits)} />
          <Row label="Onboarded" value={formatDate(society.onboardingDate)} />
          <Row label="Assigned to you" value={formatDate(society.assignedAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registration & Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Registration no." value={society.registrationNo ?? "—"} />
          <Row label="Registration date" value={formatDate(society.registrationDate)} />
          <Row
            label="Escalation threshold"
            value={`${society.counsellorEscalationThreshold} votes`}
          />
          <div className="border-t pt-2" />
          <Row label="Residents" value={String(society.counts.residents)} />
          <Row label="Governing body" value={String(society.counts.governingBodyMembers)} />
          <Row label="Open escalations" value={String(society.counts.openEscalations)} />
        </CardContent>
      </Card>
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
