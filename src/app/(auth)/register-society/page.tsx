"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, Loader2 } from "lucide-react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  registerSocietySchema,
  type RegisterSocietyInput,
} from "@/lib/validations/register-society";
import { checkSocietyCode } from "@/services/societies";
import { SOCIETY_TYPE_LABELS, type SocietyType } from "@/types/society";

const STEPS = ["Society Info", "Admin Account"];

export default function RegisterSocietyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterSocietyInput>({
    resolver: zodResolver(registerSocietySchema),
    defaultValues: {
      name: "",
      state: "",
      city: "",
      pincode: "",
      type: "INDEPENDENT_SECTOR",
      societyCode: "",
      adminName: "",
      adminEmail: "",
      adminMobile: "",
      adminPassword: "",
      adminPasswordConfirm: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const code = watch("societyCode");
  const { data: codeCheck } = useQuery({
    queryKey: ["society-code-check", code],
    queryFn: () => checkSocietyCode(code),
    enabled: code.length >= 4,
  });

  const canProceed = () => {
    if (step === 0) {
      const { name, state, city, pincode, type, societyCode } = watch();
      return name && state && city && pincode.length === 6 && type && societyCode.length >= 4;
    }
    if (step === 1) {
      const { adminName, adminEmail, adminPassword, adminPasswordConfirm } = watch();
      return (
        adminName &&
        adminEmail &&
        adminEmail.includes("@") &&
        adminPassword.length >= 8 &&
        adminPassword === adminPasswordConfirm
      );
    }
    return false;
  };

  const onSubmit = async (data: RegisterSocietyInput) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register-society", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        toast.error(err.error?.message ?? "Registration failed");
        return;
      }

      toast.success("Society registered! Signing you in...");

      // Auto sign-in
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.adminEmail,
        password: data.adminPassword,
      });

      if (signInError) {
        toast.error("Society created but sign-in failed. Please log in manually.");
        router.push("/login");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <Building2 className="text-primary h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Register Your Society</h1>
        <p className="text-muted-foreground text-sm">Start with a free 14-day trial</p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-primary text-primary border-2"
                    : "bg-muted text-muted-foreground border"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="bg-border mx-2 h-px w-8" />}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, (fieldErrors: FieldErrors<RegisterSocietyInput>) => {
          const step0Fields = ["name", "state", "city", "pincode", "type", "societyCode"];
          const errorKeys = Object.keys(fieldErrors);
          const firstError = Object.values(fieldErrors)[0];
          if (errorKeys.some((k) => step0Fields.includes(k)) && step !== 0) {
            toast.error(`Step 1 error: ${firstError?.message}`);
            setStep(0);
          } else if (firstError?.message) {
            toast.error(firstError.message);
          }
        })}
      >
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Society Information</CardTitle>
              <CardDescription>Basic details about your society</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Society Name</Label>
                  <Input id="name" placeholder="Eden Estate RWA" {...register("name")} />
                  {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="societyCode">Society Code</Label>
                  <Input
                    id="societyCode"
                    placeholder="EDEN01"
                    {...register("societyCode", {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                    className="uppercase"
                  />
                  {code.length >= 4 && (
                    <p
                      className={`text-sm ${codeCheck?.available ? "text-green-600" : "text-destructive"}`}
                    >
                      {codeCheck?.available ? "Code is available" : "Code already taken"}
                    </p>
                  )}
                  {errors.societyCode && (
                    <p className="text-destructive text-sm">{errors.societyCode.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Society Type</Label>
                <Select
                  value={watch("type")}
                  onValueChange={(v) => setValue("type", v as SocietyType)}
                >
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={watch("state")} onValueChange={(v) => setValue("state", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INDIAN_STATES).map(([stateCode, name]) => (
                        <SelectItem key={stateCode} value={stateCode}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && (
                    <p className="text-destructive text-sm">{errors.state.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Gurugram" {...register("city")} />
                  {errors.city && <p className="text-destructive text-sm">{errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" placeholder="122001" maxLength={6} {...register("pincode")} />
                  {errors.pincode && (
                    <p className="text-destructive text-sm">{errors.pincode.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Account</CardTitle>
              <CardDescription>Your details as the primary admin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Full Name</Label>
                  <Input id="adminName" placeholder="Hemant Kumar" {...register("adminName")} />
                  {errors.adminName && (
                    <p className="text-destructive text-sm">{errors.adminName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@example.com"
                    {...register("adminEmail")}
                  />
                  {errors.adminEmail && (
                    <p className="text-destructive text-sm">{errors.adminEmail.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminMobile">Mobile (Optional)</Label>
                  <div className="flex gap-2">
                    <span className="bg-muted text-muted-foreground flex items-center rounded-md border px-3 text-sm">
                      +91
                    </span>
                    <Input
                      id="adminMobile"
                      placeholder="9876543210"
                      maxLength={10}
                      {...register("adminMobile")}
                    />
                  </div>
                  {errors.adminMobile && (
                    <p className="text-destructive text-sm">{errors.adminMobile.message}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Password</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Min 8 characters"
                    {...register("adminPassword")}
                  />
                  {errors.adminPassword && (
                    <p className="text-destructive text-sm">{errors.adminPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPasswordConfirm">Confirm Password</Label>
                  <Input
                    id="adminPasswordConfirm"
                    type="password"
                    {...register("adminPasswordConfirm")}
                  />
                  {errors.adminPasswordConfirm && (
                    <p className="text-destructive text-sm">
                      {errors.adminPasswordConfirm.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={isLoading || !canProceed()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Society
            </Button>
          )}
        </div>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
