"use client";

import Link from "next/link";

import { ChevronRight, Plus, Star, Users } from "lucide-react";

import {
  DeclarationToggle,
  type DeclarationStatus,
} from "@/components/features/profile/DeclarationToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface EmergencyContactSummary {
  name: string;
  relationship: string;
  mobile: string | null;
  bloodGroup: string | null;
}

interface ProfileFamilyCardProps {
  familyCount: number;
  householdStatus: DeclarationStatus;
  emergencyContacts: EmergencyContactSummary[];
  onDeclareNone: () => void;
  onUndoDeclaration: () => void;
  onAdd?: () => void;
  pending?: boolean;
}

export function ProfileFamilyCard({
  familyCount,
  householdStatus,
  emergencyContacts,
  onDeclareNone,
  onUndoDeclaration,
  onAdd,
  pending = false,
}: ProfileFamilyCardProps) {
  const hasMembers = familyCount > 0;

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Users className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Family Members</p>
              <p className="text-muted-foreground text-xs">
                {hasMembers
                  ? `${familyCount} ${familyCount === 1 ? "member" : "members"} in your household`
                  : "Declare your household or add members"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onAdd && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={onAdd}
                aria-label="Add family member"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {hasMembers && (
              <Link
                href="/r/profile/family"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                aria-label="View family"
              >
                View family
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {hasMembers && emergencyContacts.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t pt-3">
            {emergencyContacts.slice(0, 2).map((c) => (
              <li
                key={`${c.name}-${c.relationship}`}
                className="text-muted-foreground flex items-center gap-2 text-xs"
              >
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                <span className="truncate">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  {c.mobile && <span className="text-slate-500"> · +91 {c.mobile}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!hasMembers && (
          <div className="mt-3 border-t pt-3">
            <DeclarationToggle
              status={householdStatus}
              declareLabel="I have no family members to add"
              declaredLabel="You've declared no family members"
              onDeclareNone={onDeclareNone}
              onUndo={onUndoDeclaration}
              pending={pending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
