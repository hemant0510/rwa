"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  adminPermission: string | null;
  societyName: string | null;
  societyCode: string | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchProfile(): Promise<AdminProfile> {
  const res = await fetch("/api/v1/admin/profile");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<AdminProfile>;
}

async function updateProfile(data: { name: string; mobile: string }): Promise<void> {
  const res = await fetch("/api/v1/admin/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? "Update failed");
  }
}

// ─── Editable form (mounts only when profile is loaded) ───────────────────────
// State is initialized from props at mount time — no useEffect needed.

function ProfileForm({ profile }: { profile: AdminProfile }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [mobile, setMobile] = useState(profile.mobile ?? "");

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-profile"] });
    },
    onError: (err: Error) => {
      /* v8 ignore start */
      toast.error(err.message ?? "Update failed");
      /* v8 ignore stop */
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your personal account details" />

      {/* Editable section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Details
          </CardTitle>
          <CardDescription>Update your name and mobile number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile (Optional)</Label>
              <div className="flex gap-2">
                <span className="flex items-center rounded-md border bg-gray-50 px-3 text-sm text-gray-500">
                  +91
                </span>
                <Input
                  id="mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => mutation.mutate({ name, mobile })}
              disabled={mutation.isPending || !name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Read-only info section */}
      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
          <CardDescription>Read-only details about your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Email
              </p>
              <p className="text-sm font-medium">{profile.email}</p>
              <p className="text-muted-foreground text-xs">Contact support to change your email</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Role
              </p>
              <p className="text-sm font-medium">RWA Administrator</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Society
              </p>
              <p className="text-sm font-medium">{profile.societyName ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Society Code
              </p>
              <p className="font-mono text-sm font-medium">{profile.societyCode ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminProfilePage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin-profile"],
    queryFn: fetchProfile,
  });

  if (isLoading || !profile) return <PageSkeleton />;

  return <ProfileForm profile={profile} />;
}
