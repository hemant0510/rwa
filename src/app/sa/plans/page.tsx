"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Layers, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

import { PlanCard } from "@/components/features/plans/PlanCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { archivePlan, getPlans, updatePlan } from "@/services/plans";
import type { PlatformPlan } from "@/types/plan";

type VisibilityFilter = "all" | "visible" | "hidden";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [planToArchive, setPlanToArchive] = useState<PlatformPlan | null>(null);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archivePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan archived successfully");
      setPlanToArchive(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPlanToArchive(null);
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: (plan: PlatformPlan) => updatePlan(plan.id, { isPublic: !plan.isPublic }),
    onMutate: (plan) => setTogglingPlanId(plan.id),
    onSuccess: (_, plan) => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success(
        plan.isPublic
          ? `"${plan.name}" hidden from societies`
          : `"${plan.name}" is now visible to societies`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setTogglingPlanId(null),
  });

  const activePlans = plans.filter((p) => p.isActive);
  const archivedPlans = plans.filter((p) => !p.isActive);

  const visibleCount = activePlans.filter((p) => p.isPublic).length;
  const hiddenCount = activePlans.filter((p) => !p.isPublic).length;

  const filteredActivePlans = activePlans.filter((p) => {
    if (visibilityFilter === "visible") return p.isPublic;
    if (visibilityFilter === "hidden") return !p.isPublic;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Plans"
        description="Create and manage platform pricing plans for RWA societies"
      >
        <div className="flex gap-2">
          <Link href="/sa/discounts">
            <Button variant="outline">
              <Tag className="mr-2 h-4 w-4" />
              Discounts
            </Button>
          </Link>
          <Link href="/sa/plans/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Plan
            </Button>
          </Link>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<Layers className="text-muted-foreground h-8 w-8" />}
          title="No plans yet"
          description="Create your first subscription plan to get started."
          action={
            <Link href="/sa/plans/new">
              <Button>Create Plan</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Active Plans */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Active Plans
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    ({activePlans.length})
                  </span>
                </h2>
                <p className="text-muted-foreground text-xs">
                  {visibleCount} visible to societies · {hiddenCount} hidden
                </p>
              </div>

              {/* Visibility filter */}
              <div className="flex items-center gap-1 rounded-lg border p-1">
                <button
                  type="button"
                  onClick={() => setVisibilityFilter("all")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    visibilityFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({activePlans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVisibilityFilter("visible")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    visibilityFilter === "visible"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  Enabled ({visibleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setVisibilityFilter("hidden")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    visibilityFilter === "hidden"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <EyeOff className="h-3 w-3" />
                  Disabled ({hiddenCount})
                </button>
              </div>
            </div>

            {filteredActivePlans.length === 0 ? (
              <EmptyState
                icon={
                  visibilityFilter === "hidden" ? (
                    <EyeOff className="text-muted-foreground h-6 w-6" />
                  ) : (
                    <Eye className="text-muted-foreground h-6 w-6" />
                  )
                }
                title={
                  visibilityFilter === "visible"
                    ? "No visible plans"
                    : visibilityFilter === "hidden"
                      ? "No hidden plans"
                      : "No active plans"
                }
                description={
                  visibilityFilter === "visible"
                    ? "Enable a plan to make it visible to societies during registration."
                    : visibilityFilter === "hidden"
                      ? "All plans are currently visible to societies."
                      : "Create a plan to get started."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredActivePlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onArchive={setPlanToArchive}
                    onTogglePublic={(p) => togglePublicMutation.mutate(p)}
                    isTogglingPublic={togglingPlanId === plan.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Archived Plans */}
          {archivedPlans.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">
                  Archived Plans
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    ({archivedPlans.length})
                  </span>
                </h2>
                <p className="text-muted-foreground text-xs">
                  Not available for new subscriptions. Existing subscribers are unaffected.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <AlertDialog open={!!planToArchive} onOpenChange={() => setPlanToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &quot;{planToArchive?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This plan will be hidden from new society signups. Existing subscribers are not
              affected. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToArchive && archiveMutation.mutate(planToArchive.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
