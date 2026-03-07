"use client";

import { use } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { INDIAN_STATES } from "@/lib/constants";
import { updateSocietySchema, type UpdateSocietyInput } from "@/lib/validations/society";
import { getSociety, updateSociety } from "@/services/societies";
import { SOCIETY_TYPE_LABELS, type SocietyType } from "@/types/society";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "TRIAL", label: "Trial" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "OFFBOARDED", label: "Offboarded" },
] as const;

interface SocietyDetail {
  name: string;
  state: string;
  city: string;
  pincode: string;
  type: SocietyType;
  joiningFee: number;
  annualFee: number;
  status: string;
  emailVerificationRequired?: boolean;
  admins?: {
    id: string;
    name: string;
    email: string;
    authUserId: string | null;
    adminPermission: string;
  }[];
}

export default function EditSocietyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: society, isLoading } = useQuery({
    queryKey: ["societies", id],
    queryFn: () => getSociety(id) as Promise<SocietyDetail>,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateSocietyInput) => updateSociety(id, data),
    onSuccess: async (updatedSociety) => {
      toast.success("Society updated successfully");
      queryClient.setQueryData(["societies", id], updatedSociety);
      await queryClient.invalidateQueries({ queryKey: ["societies"] });
      router.push(`/sa/societies/${id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!society) return <p className="text-muted-foreground">Society not found.</p>;

  const primaryAdmin = society.admins?.find((a) => a.adminPermission === "FULL_ACCESS");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/sa/societies/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title={`Edit ${society.name}`} description="Update society details" />
      </div>

      <EditForm
        key={`${society.name}-${primaryAdmin?.email}-${society.joiningFee}-${society.annualFee}`}
        society={society}
        adminEmail={primaryAdmin?.email ?? ""}
        hasAuthLink={!!primaryAdmin?.authUserId}
        isPending={mutation.isPending}
        onSubmit={(data) => mutation.mutate(data)}
        onCancel={() => router.push(`/sa/societies/${id}`)}
      />
    </div>
  );
}

function EditForm({
  society,
  adminEmail,
  hasAuthLink,
  isPending,
  onSubmit,
  onCancel,
}: {
  society: SocietyDetail;
  adminEmail: string;
  hasAuthLink: boolean;
  isPending: boolean;
  onSubmit: (data: UpdateSocietyInput) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<UpdateSocietyInput>({
    resolver: zodResolver(updateSocietySchema),
    defaultValues: {
      name: society.name,
      state: society.state,
      city: society.city,
      pincode: society.pincode,
      type: society.type,
      joiningFee: Number(society.joiningFee),
      annualFee: Number(society.annualFee),
      status: society.status as UpdateSocietyInput["status"],
      adminEmail: adminEmail,
      adminPassword: "",
      adminPasswordConfirm: "",
      emailVerificationRequired: society.emailVerificationRequired ?? true,
    },
  });

  const societyType = useWatch({ control, name: "type" });
  const societyState = useWatch({ control, name: "state" });
  const emailVerificationRequired = useWatch({ control, name: "emailVerificationRequired" });
  const societyStatus = useWatch({ control, name: "status" });

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (fieldErrors) => {
        const firstError = Object.values(fieldErrors)[0];
        if (firstError?.message) toast.error(firstError.message);
      })}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Society Information</CardTitle>
          <CardDescription>Basic details about the society</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Society Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Society Type</Label>
              <Select value={societyType} onValueChange={(v) => setValue("type", v as SocietyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOCIETY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={societyState} onValueChange={(v) => setValue("state", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INDIAN_STATES).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && <p className="text-destructive text-sm">{errors.state.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
              {errors.city && <p className="text-destructive text-sm">{errors.city.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" maxLength={6} {...register("pincode")} />
              {errors.pincode && (
                <p className="text-destructive text-sm">{errors.pincode.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee Configuration</CardTitle>
          <CardDescription>Update joining and annual fees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="joiningFee">Joining Fee (INR)</Label>
              <Input
                id="joiningFee"
                type="number"
                min={0}
                {...register("joiningFee", { valueAsNumber: true })}
              />
              {errors.joiningFee && (
                <p className="text-destructive text-sm">{errors.joiningFee.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualFee">Annual Fee (INR)</Label>
              <Input
                id="annualFee"
                type="number"
                min={0}
                {...register("annualFee", { valueAsNumber: true })}
              />
              {errors.annualFee && (
                <p className="text-destructive text-sm">{errors.annualFee.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Admin Credentials</CardTitle>
          <CardDescription>
            {hasAuthLink
              ? "Update the admin\u2019s login email or reset their password"
              : "This admin has no login account yet. Provide email and password to create one."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAuthLink && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              No login account linked. Fill in both email and password below to create one.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <Input id="adminEmail" type="email" {...register("adminEmail")} />
            {errors.adminEmail && (
              <p className="text-destructive text-sm">{errors.adminEmail.message}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adminPassword">New Password</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Leave blank to keep current"
                {...register("adminPassword")}
              />
              {errors.adminPassword && (
                <p className="text-destructive text-sm">{errors.adminPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPasswordConfirm">Confirm New Password</Label>
              <Input
                id="adminPasswordConfirm"
                type="password"
                placeholder="Leave blank to keep current"
                {...register("adminPasswordConfirm")}
              />
              {errors.adminPasswordConfirm && (
                <p className="text-destructive text-sm">{errors.adminPasswordConfirm.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>Require users to verify their email before logging in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailVerification">Email Verification Required</Label>
              <p className="text-muted-foreground text-xs">
                When enabled, new admins and residents must verify their email to login
              </p>
            </div>
            <Switch
              id="emailVerification"
              checked={emailVerificationRequired ?? true}
              onCheckedChange={(checked) => setValue("emailVerificationRequired", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Change the society&apos;s operational status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Society Status</Label>
            <Select
              value={societyStatus ?? ""}
              onValueChange={(v) => setValue("status", v as UpdateSocietyInput["status"])}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
