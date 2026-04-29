"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Users,
} from "lucide-react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_URL, INDIAN_STATES, STATE_CITIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  registerSocietySchema,
  type RegisterSocietyInput,
} from "@/lib/validations/register-society";
import { checkSocietyCode } from "@/services/societies";
import { SOCIETY_TYPE_LABELS, type SocietyType } from "@/types/society";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanBillingOption {
  id: string;
  billingCycle: string;
  price: number;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  planType: string;
  residentLimit: number | null;
  pricePerUnit: number | null;
  featuresJson: Record<string, boolean>;
  badgeText: string | null;
  billingOptions: PlanBillingOption[];
}

// ─── Feature labels ───────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  resident_management: "Resident Management",
  fee_collection: "Fee Collection",
  expense_tracking: "Expense Tracking",
  basic_reports: "Basic Reports",
  advanced_reports: "Advanced Reports",
  multi_admin: "Multi Admin",
  whatsapp: "WhatsApp Notifications",
  elections: "Elections & Voting",
  ai_insights: "AI Insights",
  api_access: "API Access",
};

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Society Info", icon: Building2 },
  { label: "Choose Plan", icon: CreditCard },
  { label: "Admin Account", icon: Users },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthlyPrice(plan: Plan): number | null {
  const monthly = plan.billingOptions.find((o) => o.billingCycle === "MONTHLY");
  if (monthly) return monthly.price;
  const first = plan.billingOptions[0];
  return first ? first.price : null;
}

async function fetchPublicPlans(): Promise<Plan[]> {
  const res = await fetch("/api/v1/auth/plans");
  if (!res.ok) return [];
  // successResponse returns the array directly (no { data: [...] } wrapper)
  const body = (await res.json()) as Plan[];
  return Array.isArray(body) ? body : [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveSocietyCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 2))
    .join("")
    .slice(0, 8);
}

// ─── Left branding panel ──────────────────────────────────────────────────────

function BrandingPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-10 text-white lg:flex lg:w-5/12">
      {/* Background decoration */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5" />
      <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5" />
      <div className="absolute top-1/2 right-8 h-32 w-32 -translate-y-1/2 rounded-full bg-white/5" />

      {/* Logo */}
      <div className="relative z-10">
        <Link
          href="/"
          aria-label="RWA Connect — home"
          className="inline-flex items-center gap-3 rounded-md transition-opacity hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-lg leading-none font-bold">RWA Connect</p>
            <p className="text-xs text-emerald-100">Society Management Platform</p>
          </div>
        </Link>
      </div>

      {/* Headline */}
      <div className="relative z-10 space-y-6">
        <div>
          <h2 className="text-3xl leading-tight font-bold">Manage your society smarter</h2>
          <p className="mt-2 text-base text-emerald-100">
            Everything you need to run your residential society — in one place.
          </p>
        </div>

        <ul className="space-y-3">
          {[
            "Fee collection & payment tracking",
            "Resident directory & unit management",
            "Expense ledger & financial reports",
            "WhatsApp notifications (Pro+)",
            "Elections & governing body",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Trial badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
          <BadgeCheck className="h-4 w-4 text-emerald-200" />
          <span className="text-sm font-medium">14-day free trial · No credit card required</span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10">
        <p className="text-xs text-emerald-200">
          Trusted by RWAs across India &mdash; From small apartments to large gated communities.
        </p>
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-600"
                      : "border-2 border-gray-200 bg-white text-gray-400"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  active ? "text-emerald-600" : done ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 mb-4 h-0.5 w-12 transition-all sm:w-20 ${
                  i < step ? "bg-emerald-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const monthlyPrice = getMonthlyPrice(plan);
  const features = Object.entries(plan.featuresJson)
    .filter(([, val]) => val === true)
    .map(([key]) => FEATURE_LABELS[key] ?? key);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full cursor-pointer flex-col rounded-xl border-2 p-4 text-left transition-all ${
        selected
          ? "border-emerald-600 bg-emerald-50 shadow-md"
          : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm"
      }`}
    >
      {/* Badge */}
      {plan.badgeText && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white">
          {plan.badgeText}
        </span>
      )}

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Plan name + price */}
      <div className="mb-3">
        <p className="text-sm font-bold text-gray-900">{plan.name}</p>
        {plan.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{plan.description}</p>
        )}
        <div className="mt-2">
          {monthlyPrice !== null ? (
            <span className="text-sm font-semibold text-emerald-700">
              ₹{monthlyPrice.toLocaleString("en-IN")}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </span>
          ) : plan.pricePerUnit ? (
            <span className="text-sm font-semibold text-emerald-700">
              ₹{plan.pricePerUnit}
              <span className="text-xs font-normal text-gray-400">/unit/mo</span>
            </span>
          ) : null}
        </div>
        {plan.residentLimit && (
          <p className="mt-0.5 text-xs text-gray-400">Up to {plan.residentLimit} residents</p>
        )}
        {!plan.residentLimit && <p className="mt-0.5 text-xs text-gray-400">Unlimited residents</p>}
      </div>

      {/* Features */}
      <ul className="mt-auto space-y-1">
        {features.slice(0, 4).map((f) => (
          <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
            <Check className="h-3 w-3 shrink-0 text-emerald-500" />
            {f}
          </li>
        ))}
        {features.length > 4 && (
          <li className="text-xs text-gray-400">+{features.length - 4} more</li>
        )}
      </ul>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RegisterSocietyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  const form = useForm<RegisterSocietyInput>({
    resolver: zodResolver(registerSocietySchema),
    defaultValues: {
      name: "",
      state: "",
      city: "",
      pincode: "",
      type: "INDEPENDENT_SECTOR",
      societyCode: "",
      registrationNo: "",
      registrationDate: "",
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
  const nameValue = watch("name");

  useEffect(() => {
    if (!codeManuallyEdited) {
      setValue("societyCode", deriveSocietyCode(nameValue), { shouldValidate: false });
    }
  }, [nameValue, codeManuallyEdited, setValue]);

  const { data: codeCheck, isFetching: codeChecking } = useQuery({
    queryKey: ["society-code-check", code],
    queryFn: () => checkSocietyCode(code),
    enabled: code.length >= 4,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: fetchPublicPlans,
    staleTime: 5 * 60 * 1000,
  });

  const canProceed = () => {
    if (step === 0) {
      const { name, state, city, pincode, type, societyCode } = watch();
      return (
        name &&
        state &&
        city &&
        pincode.length === 6 &&
        type &&
        societyCode.length >= 4 &&
        consentAccepted
      );
    }
    if (step === 1) {
      // Plan step — can always proceed (plan is optional)
      return true;
    }
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

  const onSubmit = async (data: RegisterSocietyInput) => {
    setIsLoading(true);
    try {
      const payload = { ...data, selectedPlanId: selectedPlanId ?? undefined };
      const res = await fetch("/api/v1/auth/register-society", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json()) as {
        error?: { message?: string };
        requiresVerification?: boolean;
      };

      if (!res.ok) {
        toast.error(body.error?.message ?? "Registration failed");
        return;
      }

      if (body.requiresVerification) {
        toast.success("Society registered! Please verify your email.");
        router.push(`/check-email?email=${encodeURIComponent(data.adminEmail)}`);
        return;
      }

      toast.success("Society registered! Signing you in...");

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
    // Escape the auth layout's max-w-md container
    <div className="fixed inset-0 z-50 flex overflow-auto bg-white">
      <BrandingPanel />

      {/* Right: form */}
      <div className="flex w-full flex-col lg:w-7/12">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b px-6 py-4 lg:hidden">
          <Link href="/" className="flex items-center gap-3" aria-label="RWA Connect — home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm leading-none font-bold text-gray-900">RWA Connect</p>
              <p className="text-xs text-gray-500">14-day free trial</p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-xl">
            {/* Heading */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-gray-900">Register Your Society</h1>
              <p className="mt-1 text-sm text-gray-500">
                Step {step + 1} of {STEPS.length} &mdash; {STEPS[step]?.label}
              </p>
            </div>

            <StepIndicator step={step} />

            <form
              onSubmit={handleSubmit(onSubmit, (fieldErrors: FieldErrors<RegisterSocietyInput>) => {
                const step0Fields = ["name", "state", "city", "pincode", "type", "societyCode"];
                const errorKeys = Object.keys(fieldErrors);
                const firstError = Object.values(fieldErrors)[0];
                if (errorKeys.some((k) => step0Fields.includes(k)) && step !== 0) {
                  toast.error(`Step 1 error: ${String(firstError?.message ?? "")}`);
                  setStep(0);
                } else if (firstError?.message) {
                  toast.error(String(firstError.message));
                }
              })}
              className="flex flex-1 flex-col"
            >
              {/* ── Step 0: Society Info ─────────────────────────────────── */}
              {step === 0 && (
                <div className="space-y-5">
                  {/* Name + Code */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">
                        Society Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="e.g. Sunrise Apartments RWA"
                        aria-invalid={!!errors.name}
                        {...register("name")}
                      />
                      {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="societyCode">
                        Short Code <span className="text-red-500">*</span>
                        <span className="ml-1 text-xs font-normal text-gray-400">
                          (residents join via this)
                        </span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="societyCode"
                          aria-invalid={!!errors.societyCode}
                          {...register("societyCode", {
                            onChange: (e) => {
                              e.target.value = (e.target.value as string).toUpperCase();
                              setCodeManuallyEdited(true);
                            },
                          })}
                          className="uppercase"
                        />
                        {codeManuallyEdited && (
                          <button
                            type="button"
                            className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-gray-400 hover:text-emerald-600"
                            onClick={() => {
                              setCodeManuallyEdited(false);
                              setValue("societyCode", deriveSocietyCode(nameValue), {
                                shouldValidate: false,
                              });
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      {code.length > 0 && code.length < 4 && (
                        <p className="text-xs text-amber-600">Minimum 4 characters</p>
                      )}
                      {code.length >= 4 &&
                        (codeChecking ? (
                          <p className="text-xs text-gray-400">Checking…</p>
                        ) : codeCheck?.available ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-emerald-600">✓ Available</p>
                            <p className="text-xs text-gray-400">
                              Join link: {APP_URL}/register/{code}
                            </p>
                          </div>
                        ) : codeCheck?.available === false ? (
                          <p className="text-xs text-red-500">✗ Already taken — try another</p>
                        ) : null)}
                      {errors.societyCode && (
                        <p className="text-xs text-red-500">{errors.societyCode.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <Label>
                      Society Type <span className="text-red-500">*</span>
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

                  {/* State + City + Pincode */}
                  <div className="grid gap-4 sm:[grid-template-columns:1.2fr_2fr_1fr]">
                    <div className="space-y-1.5">
                      <Label>
                        State <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={watch("state")}
                        onValueChange={(v) => {
                          setValue("state", v);
                          setValue("city", "");
                        }}
                      >
                        <SelectTrigger aria-invalid={!!errors.state}>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(INDIAN_STATES).map(([stateCode, stateName]) => (
                            <SelectItem key={stateCode} value={stateCode}>
                              {stateName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.state && (
                        <p className="text-xs text-red-500">{errors.state.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city">
                        City <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="city"
                        list="city-suggestions"
                        placeholder="Type or select city"
                        aria-invalid={!!errors.city}
                        {...register("city")}
                      />
                      <datalist id="city-suggestions">
                        {(STATE_CITIES[watch("state")] ?? []).map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode">
                        Pincode <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="pincode"
                        placeholder="6-digit pincode"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        aria-invalid={!!errors.pincode}
                        {...register("pincode")}
                      />
                      {errors.pincode && (
                        <p className="text-xs text-red-500">{errors.pincode.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Govt Registration No + Date */}
                  <div className="space-y-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-gray-400" />
                      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                        Govt. Registration (Optional)
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="registrationNo" className="text-gray-600">
                          Official Reg. Number
                        </Label>
                        <Input
                          id="registrationNo"
                          placeholder="e.g. DL/RWA/2019/0042"
                          {...register("registrationNo")}
                        />
                        <p className="text-xs text-gray-400">
                          Issued by Registrar of Societies / local authority
                        </p>
                        {errors.registrationNo && (
                          <p className="text-xs text-red-500">{errors.registrationNo.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="registrationDate" className="text-gray-600">
                          Date of Registration
                        </Label>
                        <Input
                          id="registrationDate"
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          {...register("registrationDate")}
                        />
                        <p className="text-xs text-gray-400">
                          Official date on your registration certificate
                        </p>
                        {errors.registrationDate && (
                          <p className="text-xs text-red-500">{errors.registrationDate.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* T&C */}
                  <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <Checkbox
                      id="consentTerms"
                      checked={consentAccepted}
                      onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="consentTerms"
                      className="cursor-pointer text-sm leading-snug text-gray-600"
                    >
                      I agree to the{" "}
                      <Link href="/terms" target="_blank" className="text-emerald-600 underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" target="_blank" className="text-emerald-600 underline">
                        Privacy Policy
                      </Link>
                      <span className="text-red-500"> *</span>
                    </Label>
                  </div>
                </div>
              )}

              {/* ── Step 1: Choose Plan ──────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Trial info banner */}
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        You get 14 days free on any plan
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Choose a plan now or decide later. No payment required until your trial
                        ends.
                      </p>
                    </div>
                  </div>

                  {/* Plan grid */}
                  {plansLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    </div>
                  ) : plans.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                      No plans available right now. You can choose a plan after sign-up.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {plans.map((plan) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          selected={selectedPlanId === plan.id}
                          onSelect={() =>
                            setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)
                          }
                        />
                      ))}
                    </div>
                  )}

                  {/* Skip note */}
                  <p className="text-center text-xs text-gray-400">
                    Not sure yet?{" "}
                    <button
                      type="button"
                      className="cursor-pointer font-medium text-emerald-600 hover:text-emerald-700"
                      onClick={() => {
                        setSelectedPlanId(null);
                        setStep(2);
                      }}
                    >
                      Skip for now
                    </button>{" "}
                    — you can upgrade anytime from the dashboard.
                  </p>
                </div>
              )}

              {/* ── Step 2: Admin Account ────────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="adminName">
                        Your Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="adminName"
                        placeholder="First and last name"
                        aria-invalid={!!errors.adminName}
                        {...register("adminName")}
                      />
                      <p className="text-xs text-gray-400">
                        Name of the person managing this account
                      </p>
                      {errors.adminName && (
                        <p className="text-xs text-red-500">{errors.adminName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adminEmail">
                        Email <span className="text-red-500">*</span>
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
                        <p className="text-xs text-red-500">{errors.adminEmail.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adminMobile">Mobile (Optional)</Label>
                    <div className="flex gap-2">
                      <span className="flex items-center rounded-md border bg-gray-50 px-3 text-sm text-gray-500">
                        +91
                      </span>
                      <Input
                        id="adminMobile"
                        placeholder="10-digit mobile number"
                        inputMode="numeric"
                        maxLength={10}
                        aria-invalid={!!errors.adminMobile}
                        {...register("adminMobile")}
                      />
                    </div>
                    {errors.adminMobile && (
                      <p className="text-xs text-red-500">{errors.adminMobile.message}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="adminPassword">
                        Password <span className="text-red-500">*</span>
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
                        <p className="text-xs text-red-500">{errors.adminPassword.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adminPasswordConfirm">
                        Confirm Password <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="adminPasswordConfirm"
                        type="password"
                        autoComplete="new-password"
                        aria-invalid={!!errors.adminPasswordConfirm}
                        {...register("adminPasswordConfirm")}
                      />
                      {errors.adminPasswordConfirm && (
                        <p className="text-xs text-red-500">
                          {errors.adminPasswordConfirm.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Selected plan summary */}
                  {selectedPlanId && plans.length > 0 && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <p className="text-sm text-emerald-800">
                        Plan selected:{" "}
                        <strong>{plans.find((p) => p.id === selectedPlanId)?.name}</strong>
                        <span className="ml-1 text-emerald-600">(after trial)</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanId(null)}
                        className="ml-auto text-xs text-emerald-600 underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between">
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
                  <Button
                    type="button"
                    disabled={!canProceed()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading || !canProceed()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Register Society
                  </Button>
                )}
              </div>
            </form>

            {/* Sign in link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-emerald-600 underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
