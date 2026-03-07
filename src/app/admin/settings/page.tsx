"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/switch";

interface Settings {
  emailVerificationRequired: boolean;
}

async function fetchSettings(): Promise<Settings> {
  const res = await fetch("/api/v1/admin/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json() as Promise<Settings>;
}

async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const res = await fetch("/api/v1/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to update settings");
  }
  return res.json() as Promise<Settings>;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchSettings,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-settings"], data);
      toast.success("Settings updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your society settings" />

      <Card>
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            Control whether new users must verify their email before accessing the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailVerification">Require Email Verification</Label>
              <p className="text-muted-foreground text-xs">
                When enabled, new admins and residents must verify their email to login
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                id="emailVerification"
                checked={settings?.emailVerificationRequired ?? true}
                disabled={mutation.isPending}
                onCheckedChange={(checked) =>
                  mutation.mutate({ emailVerificationRequired: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
