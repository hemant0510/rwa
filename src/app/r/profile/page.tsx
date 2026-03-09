"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Home, Mail, Phone, Shield, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { RESIDENT_STATUS_LABELS, type ResidentStatus } from "@/types/user";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
  ACTIVE_PAID: "border-green-200 bg-green-50 text-green-700",
  ACTIVE_PENDING: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE_OVERDUE: "border-red-200 bg-red-50 text-red-700",
  ACTIVE_PARTIAL: "border-orange-200 bg-orange-50 text-orange-700",
  ACTIVE_EXEMPTED: "border-purple-200 bg-purple-50 text-purple-700",
  REJECTED: "border-gray-200 bg-gray-50 text-gray-500",
};

interface ResidentProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  rwaid: string | null;
  status: ResidentStatus;
  ownershipType: string;
  societyName: string | null;
  unit: string | null;
  designation: string | null;
}

async function fetchProfile(): Promise<ResidentProfile> {
  const res = await fetch("/api/v1/residents/me");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<ResidentProfile>;
}

export default function ResidentProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["resident-profile", user?.societyId],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  if (isLoading) return <PageSkeleton />;

  if (!profile) {
    return <p className="text-muted-foreground text-center">Unable to load profile.</p>;
  }

  const statusLabel = RESIDENT_STATUS_LABELS[profile.status] ?? profile.status;
  const statusColor = STATUS_COLORS[profile.status] ?? "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
              <User className="text-primary h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{profile.name}</h2>
              {profile.rwaid && (
                <p className="text-muted-foreground font-mono text-sm">{profile.rwaid}</p>
              )}
              {profile.designation && (
                <div className="mt-1 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">{profile.designation}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">+91 {profile.mobile}</span>
            </div>
            {profile.email && (
              <div className="flex items-center gap-3">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">{profile.email}</span>
              </div>
            )}
            {(profile.unit || profile.societyName) && (
              <div className="flex items-center gap-3">
                <Home className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">
                  {[profile.unit, profile.societyName].filter(Boolean).join(" — ")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Shield className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">{profile.ownershipType}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Status</span>
            <Badge variant="outline" className={statusColor}>
              {statusLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
