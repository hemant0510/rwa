"use client";

import {
  Calendar,
  CheckCircle2,
  Fingerprint,
  IdCard,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CounsellorDetail } from "@/types/counsellor";

interface CounsellorProfileCardProps {
  counsellor: CounsellorDetail;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CounsellorProfileCard({ counsellor }: CounsellorProfileCardProps) {
  const isOnboarded = counsellor.mfaEnrolledAt !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
            {counsellor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={counsellor.photoUrl}
                alt={counsellor.name}
                className="h-16 w-16 object-cover"
              />
            ) : (
              <span className="text-muted-foreground text-xl font-medium">
                {counsellor.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold">{counsellor.name}</h2>
              {counsellor.isActive ? (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Suspended</Badge>
              )}
              {counsellor.isActive && !isOnboarded && (
                <Badge variant="outline">Invite pending</Badge>
              )}
            </div>
            {counsellor.publicBlurb && (
              <p className="text-muted-foreground mt-1 text-sm">{counsellor.publicBlurb}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={counsellor.email} />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label="Mobile"
            value={counsellor.mobile ?? "Not provided"}
          />
          <InfoRow
            icon={<IdCard className="h-4 w-4" />}
            label="National ID"
            value={counsellor.nationalId ?? "Not provided"}
          />
          <InfoRow
            icon={<Calendar className="h-4 w-4" />}
            label="Joined"
            value={formatDate(counsellor.createdAt)}
          />
          <InfoRow
            icon={<Calendar className="h-4 w-4" />}
            label="Last login"
            value={formatDate(counsellor.lastLoginAt)}
          />
          <InfoRow
            icon={
              isOnboarded ? (
                <ShieldCheck className="h-4 w-4 text-green-600" />
              ) : (
                <ShieldAlert className="text-muted-foreground h-4 w-4" />
              )
            }
            label="MFA"
            value={
              isOnboarded ? `Enrolled ${formatDate(counsellor.mfaEnrolledAt)}` : "Not enrolled"
            }
          />
        </div>

        {counsellor.bio && (
          <div className="pt-2">
            <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium uppercase">
              <Fingerprint className="h-3 w-3" /> Bio
            </div>
            <p className="text-sm whitespace-pre-wrap">{counsellor.bio}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate">{value}</p>
      </div>
    </div>
  );
}
