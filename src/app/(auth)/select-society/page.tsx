"use client";

import { useRouter } from "next/navigation";

import { Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import type { SocietySummary } from "@/hooks/useAuth";
import { setActiveSocietyId } from "@/lib/active-society";

const ROLE_LABELS: Record<string, string> = {
  RWA_ADMIN: "Admin",
  RESIDENT: "Resident",
};

export default function SelectSocietyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;

  const societies = user?.societies ?? [];

  const handleSelect = (society: SocietySummary) => {
    setActiveSocietyId(society.societyId);
    const redirectTo = society.role === "RWA_ADMIN" ? "/admin/dashboard" : "/r/home";
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <Building2 className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Select Society</CardTitle>
        <CardDescription>You belong to multiple societies. Choose one to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {societies.map((s) => (
          <button
            key={s.societyId}
            type="button"
            onClick={() => handleSelect(s)}
            className="hover:bg-accent w-full rounded-lg border p-4 text-left transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name ?? "Unknown Society"}</p>
                {s.code && <p className="text-muted-foreground font-mono text-xs">{s.code}</p>}
              </div>
              <Badge
                variant="outline"
                className={`text-xs ${s.designation ? "border-amber-300 bg-amber-50 text-amber-700" : ""}`}
              >
                {s.designation ?? ROLE_LABELS[s.role] ?? s.role}
              </Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
