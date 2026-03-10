"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { BillingCycleSelector } from "@/components/features/plans/BillingCycleSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPlans } from "@/services/plans";
import { assignPlan, switchPlan } from "@/services/subscriptions";
import type { BillingCycle, PlanBillingOption, PlatformPlan } from "@/types/plan";
import { BILLING_CYCLE_LABELS } from "@/types/plan";

interface PlanSwitchModalProps {
  societyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: PlatformPlan | null;
  currentBillingOption?: PlanBillingOption | null;
}

export function PlanSwitchModal({
  societyId,
  open,
  onOpenChange,
  currentPlan,
  currentBillingOption,
}: PlanSwitchModalProps) {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("MONTHLY");

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    enabled: open,
  });

  const publicPlans = plans.filter((p) => p.isActive && p.isPublic);
  const selectedPlan = publicPlans.find((p) => p.id === selectedPlanId);
  const selectedOption = selectedPlan?.billingOptions.find((o) => o.billingCycle === selectedCycle);

  const isSwitch = !!currentPlan;

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedOption) throw new Error("Select a billing option");
      if (isSwitch) {
        return switchPlan(societyId, {
          planId: selectedPlanId,
          billingOptionId: selectedOption.id,
        });
      } else {
        return assignPlan(societyId, {
          planId: selectedPlanId,
          billingOptionId: selectedOption.id,
        });
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["subscription", societyId] });
      queryClient.invalidateQueries({ queryKey: ["society", societyId] });
      if (result?.proRata?.netAmount != null) {
        const net = result.proRata.netAmount;
        if (net > 0) {
          toast.success(`Plan switched. ₹${net.toLocaleString("en-IN")} due for remaining period.`);
        } else if (net < 0) {
          toast.success(`Plan switched. ₹${Math.abs(net).toLocaleString("en-IN")} credit applied.`);
        } else {
          toast.success("Plan switched successfully.");
        }
      } else {
        toast.success(isSwitch ? "Plan switched successfully" : "Plan assigned successfully");
      }
      onOpenChange(false);
      setSelectedPlanId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // When a plan is selected, auto-select the same cycle or default to MONTHLY
  function handlePlanSelect(planId: string) {
    setSelectedPlanId(planId);
    const plan = publicPlans.find((p) => p.id === planId);
    if (plan) {
      const hasSameCycle = plan.billingOptions.some((o) => o.billingCycle === selectedCycle);
      if (!hasSameCycle) setSelectedCycle("MONTHLY");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isSwitch ? "Switch Plan" : "Assign Plan"}</DialogTitle>
          <DialogDescription>
            {isSwitch
              ? "Select a new plan. The switch takes effect immediately with pro-rata adjustment."
              : "Select a plan and billing cycle for this society."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current Plan */}
          {isSwitch && currentPlan && currentBillingOption && (
            <div className="bg-muted/30 flex items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="font-medium">{currentPlan.name}</span>
              <Badge variant="outline" className="text-xs">
                {BILLING_CYCLE_LABELS[currentBillingOption.billingCycle as BillingCycle]}
              </Badge>
              <ArrowRight className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">
                {selectedPlan ? (
                  <span className="text-foreground font-medium">{selectedPlan.name}</span>
                ) : (
                  "Select new plan →"
                )}
              </span>
            </div>
          )}

          {/* Plan Selection */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {publicPlans.map((plan) => {
              const isSelected = plan.id === selectedPlanId;
              const isCurrent = plan.id === currentPlan?.id;
              const monthlyOption = plan.billingOptions.find((o) => o.billingCycle === "MONTHLY");

              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handlePlanSelect(plan.id)}
                  className={`relative flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                      : isCurrent
                        ? "cursor-not-allowed opacity-50"
                        : "hover:border-primary/40"
                  }`}
                >
                  {plan.badgeText && <Badge className="mb-1 text-xs">{plan.badgeText}</Badge>}
                  {isCurrent && (
                    <Badge variant="outline" className="mb-1 text-xs">
                      Current
                    </Badge>
                  )}
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
                    <span className="text-muted-foreground text-xs">Unlimited units</span>
                  )}
                  {isSelected && (
                    <CheckCircle2 className="text-primary absolute top-2 right-2 h-4 w-4" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Billing Cycle Selection */}
          {selectedPlan && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Billing Cycle</p>
              <BillingCycleSelector
                plan={selectedPlan}
                selected={selectedCycle}
                onChange={setSelectedCycle}
              />
            </div>
          )}

          {/* Pro-rata info */}
          {isSwitch && selectedOption && currentBillingOption && (
            <p className="text-muted-foreground text-sm">
              Pro-rata adjustment will be calculated based on remaining days in the current billing
              period.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedPlanId || !selectedOption || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? isSwitch
                ? "Switching..."
                : "Assigning..."
              : isSwitch
                ? "Confirm Switch"
                : "Assign Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
