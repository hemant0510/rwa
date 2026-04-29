"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { BillingCycleSelector } from "@/components/features/plans/BillingCycleSelector";
import { Badge } from "@/components/ui/badge";
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
import { getPlans } from "@/services/plans";
import { createSociety, checkSocietyCode } from "@/services/societies";
import { BILLING_CYCLE_LABELS, type BillingCycle } from "@/types/plan";
import { SOCIETY_TYPE_LABELS, type SocietyType } from "@/types/society";

const STEPS = ["Society Info", "Choose Plan", "Fee Config", "Primary Admin"];

export default function NewSocietyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("MONTHLY");

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
      planId: null,
      billingOptionId: null,
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

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    enabled: step === 1,
  });
  const publicPlans = plans.filter((p) => p.isActive && p.isPublic);
  const selectedPlan = publicPlans.find((p) => p.id === selectedPlanId);
  const selectedOption = selectedPlan?.billingOptions.find((o) => o.billingCycle === selectedCycle);

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

  function handlePlanSelect(planId: string) {
    const plan = publicPlans.find((p) => p.id === planId);
    if (!plan) return;
    setSelectedPlanId(planId);
    setValue("planId", planId);
    const cycle = plan.billingOptions.some((o) => o.billingCycle === selectedCycle)
      ? selectedCycle
      : "MONTHLY";
    setSelectedCycle(cycle);
    const option = plan.billingOptions.find((o) => o.billingCycle === cycle);
    setValue("billingOptionId", option?.id ?? null);
  }

  function handleCycleChange(cycle: BillingCycle) {
    setSelectedCycle(cycle);
    const option = selectedPlan?.billingOptions.find((o) => o.billingCycle === cycle);
    setValue("billingOptionId", option?.id ?? null);
  }

  const canProceed = () => {
    if (step === 0) {
      const { name, state, city, pincode, type, societyCode } = watch();
      return name && state && city && pincode.length === 6 && type && societyCode.length >= 4;
    }
    if (step === 1) return true; // Plan is optional — SA can skip
    if (step === 2) return true;
    if (step === 3) {
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
      <PageHeader title="Onboard New Society" description="Register a society in 4 steps" />

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
            const step0Fields = ["name", "state", "city", "pincode", "type", "societyCode"];
            const step2Fields = ["joiningFee", "annualFee"];
            const errorKeys = Object.keys(fieldErrors);
            const firstError = Object.values(fieldErrors)[0];
            if (errorKeys.some((k) => step0Fields.includes(k)) && step !== 0) {
              toast.error(`Step 1 error: ${firstError?.message}`);
              setStep(0);
            } else if (errorKeys.some((k) => step2Fields.includes(k)) && step !== 2) {
              toast.error(`Step 3 error: ${firstError?.message}`);
              setStep(2);
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
                  <Label htmlFor="name">
                    Society Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Greenwood Residency RWA"
                    aria-invalid={!!errors.name}
                    {...register("name")}
                  />
                  {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="societyCode">
                    Society Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="societyCode"
                    placeholder="GRNW01"
                    aria-invalid={!!errors.societyCode}
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
                <Label>
                  Society Type <span className="text-destructive">*</span>
                </Label>
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
                  <Label>
                    State <span className="text-destructive">*</span>
                  </Label>
                  <Select value={watch("state")} onValueChange={(v) => setValue("state", v)}>
                    <SelectTrigger aria-invalid={!!errors.state}>
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
                  <Label htmlFor="city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    placeholder="Gurugram"
                    aria-invalid={!!errors.city}
                    {...register("city")}
                  />
                  {errors.city && <p className="text-destructive text-sm">{errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">
                    Pincode <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pincode"
                    placeholder="122001"
                    maxLength={6}
                    aria-invalid={!!errors.pincode}
                    {...register("pincode")}
                  />
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
              <CardTitle>Choose a Subscription Plan</CardTitle>
              <CardDescription>
                Select a plan and billing cycle for this society. You can skip and assign a plan
                later from the society detail page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Plan cards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {publicPlans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  const monthlyOption = plan.billingOptions.find(
                    (o) => o.billingCycle === "MONTHLY",
                  );
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handlePlanSelect(plan.id)}
                      className={`relative flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                          : "hover:border-primary/40"
                      }`}
                    >
                      {plan.badgeText && <Badge className="mb-1 text-xs">{plan.badgeText}</Badge>}
                      <span className="font-semibold">{plan.name}</span>
                      {monthlyOption && (
                        <span className="text-muted-foreground text-sm">
                          from ₹{monthlyOption.price.toLocaleString("en-IN")}/mo
                        </span>
                      )}
                      {plan.residentLimit ? (
                        <span className="text-muted-foreground text-xs">
                          Up to {plan.residentLimit} units
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Unlimited / per-unit</span>
                      )}
                      {isSelected && (
                        <CheckCircle2 className="text-primary absolute top-2 right-2 h-4 w-4" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Billing cycle */}
              {selectedPlan && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Billing Cycle</p>
                  <BillingCycleSelector
                    plan={selectedPlan}
                    selected={selectedCycle}
                    onChange={handleCycleChange}
                  />
                </div>
              )}

              {/* Selected summary */}
              {selectedPlan && selectedOption && (
                <div className="bg-muted/30 flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <CheckCircle2 className="text-primary h-4 w-4" />
                  <span className="font-medium">{selectedPlan.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {BILLING_CYCLE_LABELS[selectedCycle]}
                  </Badge>
                  <span className="text-muted-foreground ml-auto">
                    ₹{selectedOption.price.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {!selectedPlanId && (
                <p className="text-muted-foreground text-sm">
                  No plan selected. You can assign one later from the society detail page.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Fee Configuration</CardTitle>
              <CardDescription>Set joining and annual fees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="joiningFee">
                    Joining Fee (INR) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="joiningFee"
                    type="number"
                    min={0}
                    aria-invalid={!!errors.joiningFee}
                    {...register("joiningFee", { valueAsNumber: true })}
                  />
                  {errors.joiningFee && (
                    <p className="text-destructive text-sm">{errors.joiningFee.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annualFee">
                    Annual Fee (INR) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="annualFee"
                    type="number"
                    min={0}
                    aria-invalid={!!errors.annualFee}
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

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Primary Admin</CardTitle>
              <CardDescription>The main contact who will manage this society</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adminName">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminName"
                    placeholder="Arjun Kapoor"
                    aria-invalid={!!errors.adminName}
                    {...register("adminName")}
                  />
                  {errors.adminName && (
                    <p className="text-destructive text-sm">{errors.adminName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@example.com"
                    autoComplete="off"
                    aria-invalid={!!errors.adminEmail}
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
                      aria-invalid={!!errors.adminMobile}
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
                  <Label htmlFor="adminPassword">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    aria-invalid={!!errors.adminPassword}
                    {...register("adminPassword")}
                  />
                  {errors.adminPassword && (
                    <p className="text-destructive text-sm">{errors.adminPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPasswordConfirm">
                    Confirm Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminPasswordConfirm"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={!!errors.adminPasswordConfirm}
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
