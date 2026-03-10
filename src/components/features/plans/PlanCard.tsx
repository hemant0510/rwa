"use client";

import Link from "next/link";

import { Archive, CheckCircle2, Edit, Eye, EyeOff, Users, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { PlanFeatures, PlatformPlan } from "@/types/plan";
import { FEATURE_LABELS } from "@/types/plan";

interface PlanCardProps {
  plan: PlatformPlan;
  onArchive?: (plan: PlatformPlan) => void;
  onTogglePublic?: (plan: PlatformPlan) => void;
  isTogglingPublic?: boolean;
}

const ENABLED_FEATURES_MAX = 5;

export function PlanCard({ plan, onArchive, onTogglePublic, isTogglingPublic }: PlanCardProps) {
  const monthlyOption = plan.billingOptions.find((o) => o.billingCycle === "MONTHLY");
  const features = plan.featuresJson as PlanFeatures;
  const enabledFeatures = (Object.keys(features) as (keyof PlanFeatures)[]).filter(
    (k) => features[k],
  );
  const displayFeatures = enabledFeatures.slice(0, ENABLED_FEATURES_MAX);
  const overflow = enabledFeatures.length - ENABLED_FEATURES_MAX;

  return (
    <Card className={`relative flex flex-col ${!plan.isActive ? "opacity-60" : ""}`}>
      {plan.badgeText && (
        <div className="absolute -top-2.5 left-4">
          <Badge className="bg-primary text-primary-foreground text-xs">{plan.badgeText}</Badge>
        </div>
      )}
      {!plan.isActive && (
        <div className="absolute -top-2.5 right-4">
          <Badge variant="secondary" className="text-xs">
            Archived
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        {/* Visibility toggle — shown only for active plans */}
        {plan.isActive && onTogglePublic && (
          <div className="mb-3 flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {plan.isPublic ? (
                <Eye className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
              )}
              <span
                className={plan.isPublic ? "font-medium text-green-700" : "text-muted-foreground"}
              >
                {plan.isPublic ? "Visible to societies" : "Hidden"}
              </span>
            </div>
            <Switch
              checked={plan.isPublic}
              disabled={isTogglingPublic}
              onCheckedChange={() => onTogglePublic(plan)}
              aria-label="Toggle plan visibility"
            />
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="text-muted-foreground text-sm">
              {plan.planType === "FLAT_FEE" ? "Flat fee" : "Per unit"}
            </p>
          </div>
          <div className="text-right">
            {plan.planType === "FLAT_FEE" && monthlyOption ? (
              <>
                <p className="text-2xl font-bold">₹{monthlyOption.price.toLocaleString("en-IN")}</p>
                <p className="text-muted-foreground text-xs">/month</p>
              </>
            ) : plan.planType === "PER_UNIT" && monthlyOption ? (
              <>
                <p className="text-2xl font-bold">₹{monthlyOption.price}</p>
                <p className="text-muted-foreground text-xs">/unit/month</p>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs">
            {plan.residentLimit ? `Up to ${plan.residentLimit} units` : "Unlimited units"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {plan.billingOptions.length} billing cycle{plan.billingOptions.length !== 1 ? "s" : ""}
          </Badge>
          {plan.trialAccessLevel && (
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700">
              Trial tier
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {plan.description && <p className="text-muted-foreground text-sm">{plan.description}</p>}

        <div className="space-y-1.5">
          {displayFeatures.map((key) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
              <span>{FEATURE_LABELS[key]}</span>
            </div>
          ))}
          {(Object.keys(features) as (keyof PlanFeatures)[])
            .filter((k) => !features[k])
            .slice(0, 2)
            .map((key) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <XCircle className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-muted-foreground">{FEATURE_LABELS[key]}</span>
              </div>
            ))}
          {overflow > 0 && (
            <p className="text-muted-foreground pl-5 text-xs">+{overflow} more features</p>
          )}
        </div>

        {typeof plan.activeSubscribers === "number" && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5" />
            <span>
              {plan.activeSubscribers} active subscriber
              {plan.activeSubscribers !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <Link href={`/sa/plans/${plan.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </Link>
          {plan.isActive && onArchive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onArchive(plan)}
              disabled={(plan.activeSubscribers ?? 0) > 0}
              title={
                (plan.activeSubscribers ?? 0) > 0
                  ? "Cannot archive: active subscribers"
                  : "Archive plan"
              }
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
