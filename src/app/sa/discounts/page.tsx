"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, CheckCircle2, Clock, Hash, Layers, Plus, Tag, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { createDiscount, deactivateDiscount, getDiscounts } from "@/services/discounts";
import { getPlans } from "@/services/plans";
import type { PlanDiscount } from "@/types/discount";
import { TRIGGER_TYPE_DESCRIPTIONS, TRIGGER_TYPE_LABELS } from "@/types/discount";
import type { BillingCycle } from "@/types/plan";
import { BILLING_CYCLE_LABELS } from "@/types/plan";

const BILLING_CYCLES: BillingCycle[] = ["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"];

const TRIGGER_COLORS: Record<string, string> = {
  COUPON_CODE: "border-blue-200 bg-blue-50 text-blue-700",
  AUTO_TIME_LIMITED: "border-purple-200 bg-purple-50 text-purple-700",
  PLAN_SPECIFIC: "border-orange-200 bg-orange-50 text-orange-700",
  MANUAL_OVERRIDE: "border-gray-200 bg-gray-50 text-gray-700",
};

function isDiscountActive(d: PlanDiscount): boolean {
  if (!d.isActive) return false;
  const now = new Date();
  if (d.startsAt && new Date(d.startsAt) > now) return false;
  if (d.endsAt && new Date(d.endsAt) < now) return false;
  if (d.maxUsageCount !== null && d.usageCount >= d.maxUsageCount) return false;
  return true;
}

const DEFAULT_FORM = {
  name: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT_AMOUNT",
  discountValue: "",
  appliesToAll: true,
  applicablePlanIds: [] as string[],
  triggerType: "COUPON_CODE" as PlanDiscount["triggerType"],
  couponCode: "",
  startsAt: "",
  endsAt: "",
  maxUsageCount: "",
  allowedCycles: [] as BillingCycle[],
};

export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["discounts"],
    queryFn: getDiscounts,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });

  const createMutation = useMutation({
    mutationFn: createDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success("Discount created");
      setSheetOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success("Discount deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleCycle(c: BillingCycle) {
    setForm((f) => ({
      ...f,
      allowedCycles: f.allowedCycles.includes(c)
        ? f.allowedCycles.filter((x) => x !== c)
        : [...f.allowedCycles, c],
    }));
  }

  function togglePlan(id: string) {
    setForm((f) => ({
      ...f,
      applicablePlanIds: f.applicablePlanIds.includes(id)
        ? f.applicablePlanIds.filter((x) => x !== id)
        : [...f.applicablePlanIds, id],
    }));
  }

  function handleSubmit() {
    createMutation.mutate({
      name: form.name,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      appliesToAll: form.appliesToAll,
      applicablePlanIds: form.applicablePlanIds,
      triggerType: form.triggerType,
      couponCode: form.triggerType === "COUPON_CODE" ? form.couponCode.toUpperCase() : null,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      maxUsageCount: form.maxUsageCount ? parseInt(form.maxUsageCount) : null,
      allowedCycles: form.allowedCycles,
    });
  }

  const activeDiscounts = discounts.filter(isDiscountActive);
  const inactiveDiscounts = discounts.filter((d) => !isDiscountActive(d));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Manage coupon codes, time-limited offers, and plan-specific discounts"
      >
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Discount
        </Button>
      </PageHeader>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : discounts.length === 0 ? (
        <EmptyState
          icon={<Tag className="text-muted-foreground h-8 w-8" />}
          title="No discounts yet"
          description="Create your first discount or coupon code."
          action={<Button onClick={() => setSheetOpen(true)}>Create Discount</Button>}
        />
      ) : (
        <div className="space-y-6">
          {activeDiscounts.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Active ({activeDiscounts.length})
              </h3>
              <div className="space-y-2">
                {activeDiscounts.map((d) => (
                  <DiscountRow
                    key={d.id}
                    discount={d}
                    plans={plans}
                    onDeactivate={() => deactivateMutation.mutate(d.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {inactiveDiscounts.length > 0 && (
            <div>
              <h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                <XCircle className="h-4 w-4" />
                Inactive / Expired ({inactiveDiscounts.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {inactiveDiscounts.map((d) => (
                  <DiscountRow key={d.id} discount={d} plans={plans} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Discount Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Create Discount</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Trigger Type */}
            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <Select
                value={form.triggerType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, triggerType: v as PlanDiscount["triggerType"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "COUPON_CODE",
                      "AUTO_TIME_LIMITED",
                      "PLAN_SPECIFIC",
                      "MANUAL_OVERRIDE",
                    ] as PlanDiscount["triggerType"][]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRIGGER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {TRIGGER_TYPE_DESCRIPTIONS[form.triggerType]}
              </p>
            </div>

            <Separator />

            {/* Name & Description */}
            <div className="space-y-1.5">
              <Label>Discount Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='e.g. "Founding Member Offer"'
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Internal notes"
              />
            </div>

            {/* Coupon Code (if COUPON_CODE) */}
            {form.triggerType === "COUPON_CODE" && (
              <div className="space-y-1.5">
                <Label>Coupon Code *</Label>
                <Input
                  value={form.couponCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      couponCode: e.target.value.toUpperCase().replace(/\s/g, ""),
                    }))
                  }
                  placeholder="e.g. LAUNCH40"
                  maxLength={30}
                />
              </div>
            )}

            {/* Discount Value */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount Amount *</Label>
                <Input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  placeholder="e.g. 40"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      discountType: v as "PERCENTAGE" | "FLAT_AMOUNT",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">% off</SelectItem>
                    <SelectItem value="FLAT_AMOUNT">₹ off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range */}
            {(form.triggerType === "AUTO_TIME_LIMITED" || form.triggerType === "COUPON_CODE") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Starts At</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends At</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Usage Limit */}
            <div className="space-y-1.5">
              <Label>Usage Limit</Label>
              <Input
                type="number"
                value={form.maxUsageCount}
                onChange={(e) => setForm((f) => ({ ...f, maxUsageCount: e.target.value }))}
                placeholder="Leave blank for unlimited"
              />
            </div>

            <Separator />

            {/* Plan Scope */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.appliesToAll}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, appliesToAll: v }))}
                />
                <Label className="cursor-pointer">Applies to all plans</Label>
              </div>

              {!form.appliesToAll && (
                <div className="space-y-2">
                  <Label className="text-sm">Select plans</Label>
                  {plans
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <div
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-3 rounded border p-2.5 text-sm transition-colors ${
                          form.applicablePlanIds.includes(p.id)
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => togglePlan(p.id)}
                      >
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            form.applicablePlanIds.includes(p.id)
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                        {p.name}
                        {p.badgeText && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {p.badgeText}
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Billing Cycle Restriction */}
            <div className="space-y-2">
              <Label>Restrict to billing cycles (leave all off = applies to all)</Label>
              <div className="flex flex-wrap gap-2">
                {BILLING_CYCLES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCycle(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      form.allowedCycles.includes(c)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {BILLING_CYCLE_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                !form.name ||
                !form.discountValue ||
                (form.triggerType === "COUPON_CODE" && !form.couponCode)
              }
            >
              {createMutation.isPending ? "Creating..." : "Create Discount"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DiscountRow({
  discount,
  plans,
  onDeactivate,
}: {
  discount: PlanDiscount;
  plans: { id: string; name: string }[];
  onDeactivate?: () => void;
}) {
  const applicablePlanNames = discount.appliesToAll
    ? "All plans"
    : plans
        .filter((p) => discount.applicablePlanIds.includes(p.id))
        .map((p) => p.name)
        .join(", ") || "Specific plans";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{discount.name}</span>
            <Badge variant="outline" className={TRIGGER_COLORS[discount.triggerType] || ""}>
              {TRIGGER_TYPE_LABELS[discount.triggerType]}
            </Badge>
            {discount.couponCode && (
              <Badge variant="secondary" className="font-mono text-xs">
                <Hash className="mr-1 h-3 w-3" />
                {discount.couponCode}
              </Badge>
            )}
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <span className="text-foreground font-semibold">
              {discount.discountType === "PERCENTAGE"
                ? `${discount.discountValue}% off`
                : `₹${discount.discountValue.toLocaleString("en-IN")} off`}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {applicablePlanNames}
            </span>
            {(discount.startsAt || discount.endsAt) && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {discount.startsAt ? format(new Date(discount.startsAt), "dd MMM") : "Now"}
                {" → "}
                {discount.endsAt ? format(new Date(discount.endsAt), "dd MMM yyyy") : "No end"}
              </span>
            )}
            {discount.maxUsageCount !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {discount.usageCount}/{discount.maxUsageCount} uses
              </span>
            )}
          </div>
        </div>

        {onDeactivate && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDeactivate}
          >
            Deactivate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
