"use client";

import { use, useState } from "react";

import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FeatureFlagGrid } from "@/components/features/plans/FeatureFlagGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { addBillingOption, getPlan, updateBillingOption, updatePlan } from "@/services/plans";
import type { BillingCycle, PlanBillingOption, PlanFeatures } from "@/types/plan";
import { BILLING_CYCLE_LABELS } from "@/types/plan";

// Cycle multipliers relative to monthly price
const CYCLE_MULTIPLIERS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  ANNUAL: 10,
  TWO_YEAR: 20,
  THREE_YEAR: 27,
};

// Cycle-aware price suffix label
function priceSuffix(planType: string, cycle: BillingCycle): string {
  if (planType === "PER_UNIT") {
    return {
      MONTHLY: "/unit/mo",
      ANNUAL: "/unit/yr",
      TWO_YEAR: "/unit (2 yr)",
      THREE_YEAR: "/unit (3 yr)",
    }[cycle];
  }
  return { MONTHLY: "/mo", ANNUAL: "/yr", TWO_YEAR: "(2 yr)", THREE_YEAR: "(3 yr)" }[cycle];
}

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan", id],
    queryFn: () => getPlan(id),
  });

  // Edit form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [residentLimit, setResidentLimit] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [trialAccessLevel, setTrialAccessLevel] = useState(false);
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Auto-calculated billing option overrides (optionId -> pending price)
  const [pendingPrices, setPendingPrices] = useState<Record<string, number>>({});
  const [pricePerUnitChanged, setPricePerUnitChanged] = useState(false);

  // Inline edit state for manual per-option editing
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  // New billing option form
  const [newCycle, setNewCycle] = useState<BillingCycle>("ANNUAL");
  const [newPrice, setNewPrice] = useState("");

  // Initialize form from loaded plan
  if (plan && !initialized) {
    setName(plan.name);
    setDescription(plan.description ?? "");
    setResidentLimit(plan.residentLimit ? String(plan.residentLimit) : "");
    setPricePerUnit(plan.pricePerUnit ? String(plan.pricePerUnit) : "");
    setBadgeText(plan.badgeText ?? "");
    setIsPublic(plan.isPublic);
    setTrialAccessLevel(plan.trialAccessLevel);
    setFeatures(plan.featuresJson);
    setInitialized(true);
  }

  // When price per unit changes, auto-calculate prices for all billing options
  function handlePricePerUnitChange(value: string) {
    setPricePerUnit(value);
    const base = parseFloat(value);
    if (!plan || isNaN(base) || base <= 0) {
      setPendingPrices({});
      setPricePerUnitChanged(false);
      return;
    }
    const newPending: Record<string, number> = {};
    plan.billingOptions.forEach((opt) => {
      const cycle = opt.billingCycle as BillingCycle;
      newPending[opt.id] = Math.round(base * CYCLE_MULTIPLIERS[cycle] * 100) / 100;
    });
    setPendingPrices(newPending);
    setPricePerUnitChanged(true);
  }

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", id] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOptionMutation = useMutation({
    mutationFn: ({ optionId, price }: { optionId: string; price: number }) =>
      updateBillingOption(id, optionId, { price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", id] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addOptionMutation = useMutation({
    mutationFn: () => addBillingOption(id, { billingCycle: newCycle, price: parseFloat(newPrice) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", id] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Billing option added");
      setNewPrice("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSave() {
    // Save plan details
    await updateMutation.mutateAsync({
      name,
      description: description || undefined,
      residentLimit:
        plan?.planType === "FLAT_FEE" && residentLimit ? parseInt(residentLimit) : null,
      pricePerUnit: plan?.planType === "PER_UNIT" && pricePerUnit ? parseFloat(pricePerUnit) : null,
      badgeText: badgeText || null,
      isPublic,
      trialAccessLevel,
      featuresJson: features,
    });

    // If PER_UNIT and price changed, save all pending billing option prices
    if (
      plan?.planType === "PER_UNIT" &&
      pricePerUnitChanged &&
      Object.keys(pendingPrices).length > 0
    ) {
      await Promise.all(
        Object.entries(pendingPrices).map(([optionId, price]) =>
          updateBillingOption(id, optionId, { price }),
        ),
      );
      setPendingPrices({});
      setPricePerUnitChanged(false);
      queryClient.invalidateQueries({ queryKey: ["plan", id] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    }

    toast.success("Plan saved successfully");
  }

  if (isLoading || !plan || !features) return <PageSkeleton />;

  const usedCycles = plan.billingOptions.map((o) => o.billingCycle as BillingCycle);
  const availableCycles = (
    ["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"] as BillingCycle[]
  ).filter((c) => !usedCycles.includes(c));
  const isSaving = updateMutation.isPending || updateOptionMutation.isPending;
  const activeSubscribers = plan.activeSubscribers ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/sa/plans")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={plan.name}
          description={`${plan.planType === "FLAT_FEE" ? "Flat fee" : "Per unit"} plan · slug: ${plan.slug}`}
        >
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4" />
              {activeSubscribers} active subscriber{activeSubscribers !== 1 ? "s" : ""}
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </PageHeader>
      </div>

      {/* Active subscribers warning */}
      {activeSubscribers > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <span>
            <strong>
              {activeSubscribers} {activeSubscribers === 1 ? "society is" : "societies are"}{" "}
              currently subscribed
            </strong>{" "}
            to this plan. Price changes apply to{" "}
            <strong>new subscriptions and renewals only</strong> — existing subscribers keep their
            current rate until their next billing date.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Plan Info */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plan Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>

            {plan.planType === "FLAT_FEE" && (
              <div className="space-y-1.5">
                <Label>Resident Limit</Label>
                <Input
                  type="number"
                  value={residentLimit}
                  onChange={(e) => setResidentLimit(e.target.value)}
                  placeholder="Leave blank for unlimited"
                />
              </div>
            )}

            {plan.planType === "PER_UNIT" && (
              <div className="space-y-1.5">
                <Label>Base Price per Unit (₹/unit/month)</Label>
                <Input
                  type="number"
                  value={pricePerUnit}
                  onChange={(e) => handlePricePerUnitChange(e.target.value)}
                />
                {pricePerUnitChanged && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600">
                    <RefreshCw className="h-3 w-3" />
                    Billing option prices will be recalculated on Save.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Badge Text</Label>
              <Input
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder='e.g. "Most Popular"'
                maxLength={50}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
                <Label htmlFor="isPublic" className="cursor-pointer">
                  Visible to societies during onboarding
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="trial"
                  checked={trialAccessLevel}
                  onCheckedChange={setTrialAccessLevel}
                />
                <Label htmlFor="trial" className="cursor-pointer">
                  Use as trial access level
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Options */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {plan.billingOptions.map((option: PlanBillingOption) => {
                const cycle = option.billingCycle as BillingCycle;
                const isEditing = editingOptionId === option.id;
                const pendingPrice = pendingPrices[option.id];
                const displayPrice = pendingPrice ?? Number(option.price);
                const isPending =
                  pendingPrice !== undefined && pendingPrice !== Number(option.price);

                return (
                  <div
                    key={option.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${isPending ? "border-amber-300 bg-amber-50" : ""}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{BILLING_CYCLE_LABELS[cycle]}</p>
                      {isEditing ? (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">₹</span>
                          <Input
                            type="number"
                            value={editingPrice}
                            onChange={(e) => setEditingPrice(e.target.value)}
                            className="h-7 w-32 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                editingPrice &&
                                parseFloat(editingPrice) > 0
                              ) {
                                updateOptionMutation.mutate({
                                  optionId: option.id,
                                  price: parseFloat(editingPrice),
                                });
                                setEditingOptionId(null);
                                setEditingPrice("");
                              }
                              if (e.key === "Escape") {
                                setEditingOptionId(null);
                                setEditingPrice("");
                              }
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            disabled={
                              !editingPrice ||
                              parseFloat(editingPrice) <= 0 ||
                              updateOptionMutation.isPending
                            }
                            onClick={() => {
                              updateOptionMutation.mutate({
                                optionId: option.id,
                                price: parseFloat(editingPrice),
                              });
                              setEditingOptionId(null);
                              setEditingPrice("");
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingOptionId(null);
                              setEditingPrice("");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p
                          className={`text-sm ${isPending ? "font-medium text-amber-700" : "text-muted-foreground"}`}
                        >
                          ₹{displayPrice.toLocaleString("en-IN")}
                          {priceSuffix(plan.planType, cycle)}
                          {isPending && <span className="ml-1.5 text-xs">(pending save)</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={option.isActive ? "outline" : "secondary"}>
                        {option.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {!isEditing && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingOptionId(option.id);
                            setEditingPrice(String(displayPrice));
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {availableCycles.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Add Billing Cycle</p>
                  <div className="flex gap-3">
                    <Select value={newCycle} onValueChange={(v) => setNewCycle(v as BillingCycle)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCycles.map((c) => (
                          <SelectItem key={c} value={c}>
                            {BILLING_CYCLE_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="₹ price"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={() => addOptionMutation.mutate()}
                      disabled={
                        !newPrice || parseFloat(newPrice) <= 0 || addOptionMutation.isPending
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureFlagGrid value={features} onChange={setFeatures} />
        </CardContent>
      </Card>
    </div>
  );
}
