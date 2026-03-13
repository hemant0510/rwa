"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Calendar, CheckCircle2, Layers, RefreshCw, Tag } from "lucide-react";
import { toast } from "sonner";

import { PlanSwitchModal } from "@/components/features/subscription/PlanSwitchModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getDiscounts } from "@/services/discounts";
import { applyDiscount, getSubscription } from "@/services/subscriptions";
import type { BillingCycle } from "@/types/plan";
import { BILLING_CYCLE_LABELS } from "@/types/plan";

const STATUS_COLORS: Record<string, string> = {
  TRIAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  EXPIRED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-gray-200 bg-gray-50 text-gray-500",
  SUSPENDED: "border-orange-200 bg-orange-50 text-orange-700",
};

interface SubscriptionStatusCardProps {
  societyId: string;
}

export function SubscriptionStatusCard({ societyId }: SubscriptionStatusCardProps) {
  const queryClient = useQueryClient();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("");
  const [customPct, setCustomPct] = useState("");

  const { data: sub, isLoading } = useQuery({
    queryKey: ["subscription", societyId],
    queryFn: () => getSubscription(societyId),
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["discounts"],
    queryFn: getDiscounts,
    enabled: discountOpen,
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      applyDiscount(societyId, {
        discountId: selectedDiscountId || null,
        customDiscountPct: customPct ? parseFloat(customPct) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", societyId] });
      toast.success("Discount applied");
      setDiscountOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!sub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            No active subscription. Assign a plan below.
          </div>
          <Button className="mt-3" size="sm" onClick={() => setSwitchOpen(true)}>
            Assign Plan
          </Button>
          <PlanSwitchModal societyId={societyId} open={switchOpen} onOpenChange={setSwitchOpen} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Subscription
          </CardTitle>
          <Badge variant="outline" className={STATUS_COLORS[sub.status] || ""}>
            {sub.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">Plan</p>
              <p className="font-semibold">{sub.plan?.name ?? "Trial"}</p>
            </div>
            {sub.billingOption && (
              <div>
                <p className="text-muted-foreground text-xs">Billing</p>
                <p className="font-semibold">
                  {BILLING_CYCLE_LABELS[sub.billingOption.billingCycle as BillingCycle]}
                </p>
              </div>
            )}
            {sub.finalPrice != null && (
              <div>
                <p className="text-muted-foreground text-xs">Effective Price</p>
                <p className="font-semibold">
                  ₹{Number(sub.finalPrice).toLocaleString("en-IN")}
                  {sub.discount || sub.customDiscountPct ? (
                    <span className="ml-1 text-xs font-normal text-green-600">(discounted)</span>
                  ) : null}
                </p>
              </div>
            )}
            {sub.currentPeriodEnd && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  Renews
                </p>
                <p className="font-semibold">
                  {format(new Date(sub.currentPeriodEnd), "dd MMM yyyy")}
                </p>
              </div>
            )}
            {sub.status === "TRIAL" && sub.trialEndsAt && (
              <div>
                <p className="text-muted-foreground text-xs">Trial ends</p>
                <p className="font-semibold text-yellow-600">
                  {format(new Date(sub.trialEndsAt), "dd MMM yyyy")}
                </p>
              </div>
            )}
          </div>

          {sub.discount && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-muted-foreground">
                Discount applied: <strong>{sub.discount.name}</strong>
                {" ("}
                {sub.discount.discountType === "PERCENTAGE"
                  ? `${sub.discount.discountValue}% off`
                  : `₹${sub.discount.discountValue} off`}
                {")"}
              </span>
            </div>
          )}

          {sub.customDiscountPct && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-muted-foreground">
                Manual discount: <strong>{sub.customDiscountPct}% off</strong>
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Link href={`/sa/societies/${societyId}/billing`}>
              <Button variant="outline" size="sm">
                Record Payment
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setSwitchOpen(true)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Switch Plan
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDiscountOpen(true)}>
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Apply Discount
            </Button>
          </div>
        </CardContent>
      </Card>

      <PlanSwitchModal
        societyId={societyId}
        currentPlan={sub.plan}
        currentBillingOption={sub.billingOption}
        open={switchOpen}
        onOpenChange={setSwitchOpen}
      />

      {/* Apply Discount Sheet */}
      <Sheet open={discountOpen} onOpenChange={setDiscountOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Apply Discount</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Select Existing Discount</Label>
              <Select value={selectedDiscountId} onValueChange={setSelectedDiscountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a discount..." />
                </SelectTrigger>
                <SelectContent>
                  {discounts
                    .filter((d) => d.isActive)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} —{" "}
                        {d.discountType === "PERCENTAGE"
                          ? `${d.discountValue}% off`
                          : `₹${d.discountValue} off`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background text-muted-foreground px-2">or</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Custom Discount %</Label>
              <Input
                type="number"
                value={customPct}
                onChange={(e) => {
                  setCustomPct(e.target.value);
                  setSelectedDiscountId("");
                }}
                placeholder="e.g. 25"
                min={0}
                max={100}
              />
              <p className="text-muted-foreground text-xs">
                Override: apply a one-off percentage for this society only
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || (!selectedDiscountId && !customPct)}
            >
              {applyMutation.isPending ? "Applying..." : "Apply Discount"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
