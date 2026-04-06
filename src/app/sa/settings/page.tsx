"use client";

import { useEffect } from "react";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight, KeyRound, QrCode, Settings, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ChangePasswordInput,
  UpdatePlatformConfigInput,
  UpdateProfileInput,
} from "@/lib/validations/settings";
import {
  changePasswordSchema,
  updatePlatformConfigSchema,
  updateProfileSchema,
} from "@/lib/validations/settings";
import {
  changePassword,
  getProfile,
  getPlatformConfig,
  updatePlatformConfig,
  updateProfile,
} from "@/services/settings";

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["sa-profile"],
    queryFn: getProfile,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (profile) reset({ name: profile.name });
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(["sa-profile"], updated);
      reset({ name: updated.name });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={profile?.email ?? ""} disabled />
          <p className="text-muted-foreground text-xs">Email cannot be changed here.</p>
        </div>
      </div>

      {profile && (
        <div className="text-muted-foreground space-y-1 text-sm">
          <p>
            Account created:{" "}
            <span className="font-medium">
              {format(new Date(profile.createdAt), "MMM d, yyyy")}
            </span>
          </p>
          {profile.lastLogin && (
            <p>
              Last login:{" "}
              <span className="font-medium">
                {format(new Date(profile.lastLogin), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={!isDirty || mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      reset();
      toast.success("Password changed successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input id="currentPassword" type="password" {...register("currentPassword")} />
          {errors.currentPassword && (
            <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input id="newPassword" type="password" {...register("newPassword")} />
          {errors.newPassword && (
            <p className="text-destructive text-sm">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
          {errors.confirmPassword && (
            <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Updating…" : "Change Password"}
      </Button>
    </form>
  );
}

// ─── Platform Config Tab ──────────────────────────────────────────────────────

function PlatformConfigTab() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: getPlatformConfig,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdatePlatformConfigInput>({
    resolver: zodResolver(updatePlatformConfigSchema),
  });

  useEffect(() => {
    if (configs.length > 0) {
      const values: Record<string, string | number> = {};
      for (const c of configs) {
        values[c.key] = c.type === "number" ? Number(c.value) : c.value;
      }
      reset(values as UpdatePlatformConfigInput);
    }
  }, [configs, reset]);

  const mutation = useMutation({
    mutationFn: (data: UpdatePlatformConfigInput) =>
      updatePlatformConfig(data as Record<string, string | number>),
    onSuccess: (updated) => {
      queryClient.setQueryData(["platform-config"], updated);
      const values: Record<string, string | number> = {};
      for (const c of updated) {
        values[c.key] = c.type === "number" ? Number(c.value) : c.value;
      }
      reset(values as UpdatePlatformConfigInput);
      toast.success("Platform settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const numberFields = configs.filter((c) => c.type === "number");
  const stringFields = configs.filter((c) => c.type === "string");

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
      {numberFields.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Limits &amp; Timeouts</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {numberFields.map((c) => {
              const key = c.key as keyof UpdatePlatformConfigInput;
              const err = errors[key];
              return (
                <div key={c.key} className="space-y-2">
                  <Label htmlFor={c.key}>{c.label}</Label>
                  <Input
                    id={c.key}
                    type="number"
                    min={0}
                    {...register(key, { valueAsNumber: true })}
                  />
                  {err && <p className="text-destructive text-sm">{err.message as string}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stringFields.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Support Contact</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {stringFields.map((c) => {
              const key = c.key as keyof UpdatePlatformConfigInput;
              const err = errors[key];
              return (
                <div key={c.key} className="space-y-2">
                  <Label htmlFor={c.key}>{c.label}</Label>
                  <Input id={c.key} {...register(key)} />
                  {err && <p className="text-destructive text-sm">{err.message as string}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button type="submit" disabled={!isDirty || mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save Settings"}
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account profile, security, and platform configuration"
      />

      {/* Payment Setup Card */}
      <Link href="/sa/settings/payments">
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base">Payment Setup</CardTitle>
                <CardDescription>
                  Configure platform UPI ID and QR code for subscription payment collection
                </CardDescription>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </CardHeader>
        </Card>
      </Link>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="platform" className="gap-2">
            <Settings className="h-4 w-4" />
            Platform
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your display name and view account details.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Keep your account secure by using a strong password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecurityTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform">
          <Card>
            <CardHeader>
              <CardTitle>Platform Configuration</CardTitle>
              <CardDescription>
                Configure global platform defaults that apply to all societies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformConfigTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
