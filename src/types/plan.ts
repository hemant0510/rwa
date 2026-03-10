export type PlanType = "FLAT_FEE" | "PER_UNIT";
export type BillingCycle = "MONTHLY" | "ANNUAL" | "TWO_YEAR" | "THREE_YEAR";

export interface PlanFeatures {
  resident_management: boolean;
  fee_collection: boolean;
  expense_tracking: boolean;
  basic_reports: boolean;
  advanced_reports: boolean;
  whatsapp: boolean;
  elections: boolean;
  ai_insights: boolean;
  api_access: boolean;
  multi_admin: boolean;
}

export interface PlanBillingOption {
  id: string;
  planId: string;
  billingCycle: BillingCycle;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  planType: PlanType;
  residentLimit: number | null;
  pricePerUnit: number | null;
  featuresJson: PlanFeatures;
  isActive: boolean;
  isPublic: boolean;
  displayOrder: number;
  badgeText: string | null;
  trialAccessLevel: boolean;
  createdAt: string;
  updatedAt: string;
  billingOptions: PlanBillingOption[];
  activeSubscribers?: number;
}

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
  TWO_YEAR: "2 Years",
  THREE_YEAR: "3 Years",
};

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  resident_management: "Resident Management",
  fee_collection: "Fee Collection",
  expense_tracking: "Expense Tracking",
  basic_reports: "Basic Reports",
  advanced_reports: "Advanced Reports & Analytics",
  whatsapp: "WhatsApp Notifications",
  elections: "Elections Module",
  ai_insights: "AI-Powered Insights",
  api_access: "API Access",
  multi_admin: "Multiple Admins",
};

export const FEATURE_ICONS: Record<keyof PlanFeatures, string> = {
  resident_management: "Users",
  fee_collection: "IndianRupee",
  expense_tracking: "Receipt",
  basic_reports: "BarChart2",
  advanced_reports: "TrendingUp",
  whatsapp: "MessageCircle",
  elections: "Vote",
  ai_insights: "Sparkles",
  api_access: "Code2",
  multi_admin: "Shield",
};
