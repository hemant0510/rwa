export type BillingCycle = "MONTHLY" | "ANNUAL" | "TWO_YEAR" | "THREE_YEAR";

export interface PublicPlanBillingOption {
  id: string;
  billingCycle: BillingCycle | string;
  price: number;
}

export interface PublicPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  planType: string;
  residentLimit: number | null;
  pricePerUnit: number | null;
  featuresJson: Record<string, boolean>;
  badgeText: string | null;
  displayOrder: number;
  billingOptions: PublicPlanBillingOption[];
}

export const FEATURE_LABELS: Record<string, string> = {
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
