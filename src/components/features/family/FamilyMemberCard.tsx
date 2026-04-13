"use client";

import Image from "next/image";

import { Cake, Mail, Pencil, Phone, Trash2, User } from "lucide-react";

import { EmergencyContactIndicator } from "@/components/features/family/EmergencyContactIndicator";
import { RelationshipBadge } from "@/components/features/family/RelationshipBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FamilyMember } from "@/services/family";

export const BLOOD_GROUP_LABELS: Record<string, string> = {
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

interface FamilyMemberCardProps {
  member: FamilyMember;
  onEdit: (member: FamilyMember) => void;
  onRemove: (member: FamilyMember) => void;
}

export function FamilyMemberCard({ member, onEdit, onRemove }: FamilyMemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {member.photoUrl ? (
              <Image
                src={member.photoUrl}
                alt={member.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="bg-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              >
                {initials || <User className="h-5 w-5" />}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <RelationshipBadge
                  relationship={member.relationship}
                  otherRelationship={member.otherRelationship}
                />
                {member.age !== null && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Cake className="h-3 w-3" aria-hidden="true" />
                    {member.age}y
                  </span>
                )}
              </div>
            </div>
          </div>
          <EmergencyContactIndicator
            isEmergencyContact={member.isEmergencyContact}
            priority={member.emergencyPriority}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {member.bloodGroup && (
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-xs font-medium text-red-700"
            >
              {BLOOD_GROUP_LABELS[member.bloodGroup] ?? member.bloodGroup}
            </Badge>
          )}
          {member.memberId && (
            <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 font-mono text-xs">
              {member.memberId}
            </span>
          )}
        </div>

        {(member.mobile || member.email) && (
          <div className="space-y-1">
            {member.mobile && (
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3" aria-hidden="true" />
                +91 {member.mobile}
              </div>
            )}
            {member.email && (
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Mail className="h-3 w-3" aria-hidden="true" />
                <span className="truncate">{member.email}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onEdit(member)}
            aria-label={`Edit ${member.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700"
            onClick={() => onRemove(member)}
            aria-label={`Remove ${member.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
