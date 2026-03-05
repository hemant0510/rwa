"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDIAN_STATES, DEFAULT_JOINING_FEE, DEFAULT_ANNUAL_FEE } from "@/lib/constants";
import { createSocietySchema, type CreateSocietyInput } from "@/lib/validations/society";
import { createSociety, checkSocietyCode } from "@/services/societies";
import { SOCIETY_TYPE_LABELS, type SocietyType } from "@/types/society";

const STEPS = ["Society Info", "Fee Config", "Primary Admin"];

export default function NewSocietyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const queryClient = useQueryClient();

  const form = useForm<CreateSocietyInput>({
    resolver: zodResolver(createSocietySchema),
    defaultValues: {
      name: "",
      state: "",
      city: "",
      pincode: "",
      type: "INDEPENDENT_SECTOR",
      societyCode: "",
      joiningFee: DEFAULT_JOINING_FEE,
      annualFee: DEFAULT_ANNUAL_FEE,
      adminName: "",
      adminEmail: "",
      adminMobile: "",
      adminPassword: "",
      adminPasswordConfirm: "",
    },
  });

  const code = form.watch("societyCode");
  const { data: codeCheck } = useQuery({
    queryKey: ["society-code-check", code],
    queryFn: () => checkSocietyCode(code),
    enabled: code.length >= 4,
  });

  const mutation = useMutation({
    mutationFn: (data: CreateSocietyInput) => createSociety(data),
    onSuccess: () => {
      toast.success("Society onboarded successfully!");
      queryClient.invalidateQueries({ queryKey: ["societies"] });
      router.push("/sa/societies");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const canProceed = () => {
    if (step === 0) {
      const { name, state, city, pincode, type, societyCode } = watch();
      return name && state && city && pincode.length === 6 && type && societyCode.length >= 4;
    }
    if (step === 1) return true;
    if (step === 2) {
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

  return (
    <div className="space-y-6">
      <PageHeader title="Onboard New Society" description="Register a society in 3 steps" />

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-primary text-primary border-2"
                    : "bg-muted text-muted-foreground border"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`hidden text-sm sm:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="bg-border mx-2 h-px w-8" />}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit(
          (data) => mutation.mutate(data),
          (fieldErrors: FieldErrors<CreateSocietyInput>) => {
            // Find the first error's step and show a toast
            const step0Fields = ["name", "state", "city", "pincode", "type", "societyCode"];
            const step1Fields = ["joiningFee", "annualFee"];
            const errorKeys = Object.keys(fieldErrors);
            const firstError = Object.values(fieldErrors)[0];
            if (errorKeys.some((k) => step0Fields.includes(k)) && step !== 0) {
              toast.error(`Step 1 error: ${firstError?.message}`);
              setStep(0);
            } else if (errorKeys.some((k) => step1Fields.includes(k)) && step !== 1) {
              toast.error(`Step 2 error: ${firstError?.message}`);
              setStep(1);
            } else if (firstError?.message) {
              toast.error(firstError.message);
            }
          },
        )}
      >
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Society Information</CardTitle>
              <CardDescription>Basic details about the society</CardDescription>
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
                      {Object.entries(INDIAN_STATES).map(([code, name]) => (
                        <SelectItem key={code} value={code}>
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
              <CardTitle>Fee Configuration</CardTitle>
              <CardDescription>Set joining and annual fees</CardDescription>
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
              <p className="text-muted-foreground text-sm">
                Fee session runs April to March. New members pay pro-rata based on joining month.
              </p>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Primary Admin</CardTitle>
              <CardDescription>The main contact who will manage this society</CardDescription>
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
                  <Label htmlFor="adminMobile">Mobile Number (Optional)</Label>
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
            <Button type="submit" disabled={mutation.isPending || !canProceed()}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Onboard Society
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
