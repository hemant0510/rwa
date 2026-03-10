"use client";

import {
  BarChart2,
  Code2,
  IndianRupee,
  MessageCircle,
  Receipt,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import type { PlanFeatures } from "@/types/plan";
import { FEATURE_LABELS } from "@/types/plan";

const FEATURE_ICON_MAP: Record<keyof PlanFeatures, React.ElementType> = {
  resident_management: Users,
  fee_collection: IndianRupee,
  expense_tracking: Receipt,
  basic_reports: BarChart2,
  advanced_reports: TrendingUp,
  whatsapp: MessageCircle,
  elections: Vote,
  ai_insights: Sparkles,
  api_access: Code2,
  multi_admin: Shield,
};

interface FeatureFlagGridProps {
  value: PlanFeatures;
  onChange?: (updated: PlanFeatures) => void;
  readonly?: boolean;
}

export function FeatureFlagGrid({ value, onChange, readonly = false }: FeatureFlagGridProps) {
  const keys = Object.keys(value) as (keyof PlanFeatures)[];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {keys.map((key) => {
        const Icon = FEATURE_ICON_MAP[key];
        const enabled = value[key];
        return (
          <div
            key={key}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              enabled ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`rounded-md p-1.5 ${
                  enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className={`text-sm font-medium ${enabled ? "" : "text-muted-foreground"}`}>
                {FEATURE_LABELS[key]}
              </span>
            </div>
            {!readonly && onChange && (
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => onChange({ ...value, [key]: checked })}
              />
            )}
            {readonly && (
              <span
                className={`text-xs font-medium ${enabled ? "text-green-600" : "text-muted-foreground"}`}
              >
                {enabled ? "Included" : "Not included"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
