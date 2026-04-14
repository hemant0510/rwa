"use client";

import Link from "next/link";

import { Briefcase, CheckCircle2, Mail, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CounsellorListItem } from "@/types/counsellor";

interface CounsellorRowProps {
  counsellor: CounsellorListItem;
}

export function CounsellorRow({ counsellor }: CounsellorRowProps) {
  const societyCount = counsellor._count.assignments;
  const isOnboarded = counsellor.mfaEnrolledAt !== null;

  return (
    <Link
      href={`/sa/counsellors/${counsellor.id}`}
      className="hover:bg-muted/50 block border-b last:border-b-0"
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {counsellor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={counsellor.photoUrl}
              alt={counsellor.name}
              className="h-10 w-10 object-cover"
            />
          ) : (
            <span className="text-muted-foreground text-sm font-medium">
              {counsellor.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{counsellor.name}</p>
            {!counsellor.isActive && (
              <Badge variant="secondary" className="text-xs">
                Suspended
              </Badge>
            )}
            {counsellor.isActive && !isOnboarded && (
              <Badge variant="outline" className="text-xs">
                Invite pending
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground flex items-center gap-1 truncate text-sm">
            <Mail className="h-3 w-3" />
            {counsellor.email}
          </p>
        </div>

        <div className="hidden items-center gap-4 text-sm sm:flex">
          <div className="text-muted-foreground flex items-center gap-1" aria-label="Societies">
            <Briefcase className="h-3.5 w-3.5" />
            <span>{societyCount}</span>
          </div>
          {isOnboarded ? (
            <div className="flex items-center gap-1 text-green-600" aria-label="MFA enabled">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">MFA</span>
            </div>
          ) : (
            <div
              className="text-muted-foreground flex items-center gap-1"
              aria-label="MFA not enrolled"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Pending</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
