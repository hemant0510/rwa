"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FormStepper } from "@/components/features/FormStepper";
import { FeatureFlagGrid } from "@/components/features/plans/FeatureFlagGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { createPlan } from "@/services/plans";
import type { BillingCycle, PlanFeatures } from "@/types/plan";
import { BILLING_CYCLE_LABELS } from "@/types/plan";

const DEFAULT_FEATURES: PlanFeatures = {
  resident_management: true,
  fee_collection: true,
  expense_tracking: true,
  basic_reports: true,
  advanced_reports: false,
  whatsapp: false,
  elections: false,
  ai_insights: false,
  api_access: false,
  multi_admin: false,
};

const BILLING_CYCLES: BillingCycle[] = ["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"];

type BillingEntry = { billingCycle: BillingCycle; price: string };

const STEPS = ["Plan Info", "Billing Options", "Features", "Preview"];

export default function CreatePlanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  // Step 1: Plan Info
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [planType, setPlanType] = useState<"FLAT_FEE" | "PER_UNIT">("FLAT_FEE");
  const [residentLimit, setResidentLimit] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [trialAccessLevel, setTrialAccessLevel] = useState(false);

  // Step 2: Billing Options
  const [billingOptions, setBillingOptions] = useState<BillingEntry[]>([
    { billingCycle: "MONTHLY", price: "" },
  ]);

  // Step 3: Features
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);

  const mutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success(`Plan "${name}" created successfully`);
      router.push("/sa/plans");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function autoSlug(value: string) {
    setName(value);
    if (
      !slug ||
      slug ===
        name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
    ) {
      setSlug(
        value
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
      );
    }
  }

  function addBillingOption() {
    const used = billingOptions.map((o) => o.billingCycle);
    const next = BILLING_CYCLES.find((c) => !used.includes(c));
    if (next) setBillingOptions([...billingOptions, { billingCycle: next, price: "" }]);
  }

  function removeBillingOption(index: number) {
    setBillingOptions(billingOptions.filter((_, i) => i !== index));
  }

  function canProceed(s: number): boolean {
    if (s === 0) return name.trim().length >= 2 && slug.trim().length >= 2;
    if (s === 1)
      return billingOptions.length > 0 && billingOptions.every((o) => parseFloat(o.price) > 0);
    return true;
  }

  function handleSubmit() {
    mutation.mutate({
      name,
      slug,
      description: description || undefined,
      planType,
      residentLimit: planType === "FLAT_FEE" && residentLimit ? parseInt(residentLimit) : null,
      pricePerUnit: planType === "PER_UNIT" && pricePerUnit ? parseFloat(pricePerUnit) : null,
      badgeText: badgeText || null,
      isPublic,
      trialAccessLevel,
      featuresJson: features,
      billingOptions: billingOptions.map((o) => ({
        billingCycle: o.billingCycle,
        price: parseFloat(o.price),
      })),
    });
  }

  const monthlyOption = billingOptions.find((o) => o.billingCycle === "MONTHLY");

  return (
    <div className="space-y-6">
      <PageHeader title="Create Plan" description="Set up a new subscription plan for societies" />

      <FormStepper
        steps={STEPS.map((title, i) => ({
          number: i + 1,
          title,
          status: i < step ? "completed" : i === step ? "active" : ("pending" as const),
        }))}
      />

      {/* Step 0: Plan Info */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => autoSlug(e.target.value)}
                  placeholder="e.g. Community"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug * (auto-generated)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g. community"
                />
                <p className="text-muted-foreground text-xs">
                  Unique identifier. Lowercase letters, numbers, hyphens only.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description shown to societies"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plan Type *</Label>
                <Select
                  value={planType}
                  onValueChange={(v) => setPlanType(v as "FLAT_FEE" | "PER_UNIT")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT_FEE">Flat Fee (fixed monthly/annual price)</SelectItem>
                    <SelectItem value="PER_UNIT">
                      Per Unit (₹ per residential unit/month)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {planType === "FLAT_FEE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="residentLimit">Resident Limit</Label>
                  <Input
                    id="residentLimit"
                    type="number"
                    value={residentLimit}
                    onChange={(e) => setResidentLimit(e.target.value)}
                    placeholder="Leave blank for unlimited"
                  />
                </div>
              )}

              {planType === "PER_UNIT" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pricePerUnit">Price per Unit (₹/unit/month) *</Label>
                  <Input
                    id="pricePerUnit"
                    type="number"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="badgeText">Badge Text (optional)</Label>
                <Input
                  id="badgeText"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder='e.g. "Most Popular" or "Best Value"'
                  maxLength={50}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
                <div>
                  <Label htmlFor="isPublic" className="cursor-pointer">
                    Visible to societies
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Show this plan in the onboarding wizard
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="trialAccessLevel"
                  checked={trialAccessLevel}
                  onCheckedChange={setTrialAccessLevel}
                />
                <div>
                  <Label htmlFor="trialAccessLevel" className="cursor-pointer">
                    Use as trial access level
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Trial societies get this plan&apos;s features
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Billing Options */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Add pricing for each billing cycle. Annual/multi-year options typically offer a
              discount (e.g., annual = monthly × 10 for 2 months free).
            </p>

            <div className="space-y-3">
              {billingOptions.map((option, index) => {
                const available = BILLING_CYCLES.filter(
                  (c) =>
                    c === option.billingCycle ||
                    !billingOptions.some((o, i) => i !== index && o.billingCycle === c),
                );
                return (
                  <div key={index} className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label>Billing Cycle</Label>
                      <Select
                        value={option.billingCycle}
                        onValueChange={(v) => {
                          const updated = [...billingOptions];
                          updated[index].billingCycle = v as BillingCycle;
                          setBillingOptions(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((c) => (
                            <SelectItem key={c} value={c}>
                              {BILLING_CYCLE_LABELS[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label>
                        Price (₹){" "}
                        {planType === "PER_UNIT" && (
                          <span className="text-muted-foreground text-xs">per unit/month</span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        value={option.price}
                        onChange={(e) => {
                          const updated = [...billingOptions];
                          updated[index].price = e.target.value;
                          setBillingOptions(updated);
                        }}
                        placeholder="0"
                      />
                    </div>
                    {billingOptions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeBillingOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {billingOptions.length < BILLING_CYCLES.length && (
              <Button variant="outline" size="sm" onClick={addBillingOption}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Billing Cycle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Features */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Toggle which features are available on this plan.
            </p>
            <FeatureFlagGrid value={features} onChange={setFeatures} />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="font-semibold">{name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Slug</p>
                <p className="font-mono text-sm">{slug}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Type</p>
                <p className="font-semibold">{planType === "FLAT_FEE" ? "Flat Fee" : "Per Unit"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Starting Price</p>
                <p className="font-semibold">
                  {planType === "FLAT_FEE" && monthlyOption
                    ? `₹${parseFloat(monthlyOption.price).toLocaleString("en-IN")}/mo`
                    : planType === "PER_UNIT" && pricePerUnit
                      ? `₹${pricePerUnit}/unit/mo`
                      : "—"}
                </p>
              </div>
            </div>

            {description && (
              <div>
                <p className="text-muted-foreground text-xs">Description</p>
                <p className="text-sm">{description}</p>
              </div>
            )}

            <div>
              <p className="text-muted-foreground mb-2 text-xs">Billing Cycles</p>
              <div className="flex flex-wrap gap-2">
                {billingOptions.map((o) => (
                  <Badge key={o.billingCycle} variant="outline">
                    {BILLING_CYCLE_LABELS[o.billingCycle]}: ₹
                    {parseFloat(o.price).toLocaleString("en-IN")}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs">Features</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(features) as (keyof PlanFeatures)[])
                  .filter((k) => features[k])
                  .map((k) => (
                    <Badge key={k} className="bg-green-100 text-green-700 hover:bg-green-100">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {k.replace(/_/g, " ")}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Visible to societies: <strong>{isPublic ? "Yes" : "No (draft)"}</strong>
              </span>
              <span>
                Trial access level: <strong>{trialAccessLevel ? "Yes" : "No"}</strong>
              </span>
              {badgeText && (
                <span>
                  Badge: <Badge className="ml-1">{badgeText}</Badge>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? router.push("/sa/plans") : setStep(step - 1))}
        >
          {step === 0 ? "Cancel" : "← Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed(step)}>
            Next →
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Plan"}
          </Button>
        )}
      </div>
    </div>
  );
}
