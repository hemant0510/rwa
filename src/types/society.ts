export interface Society {
  id: string;
  societyId: string;
  societyCode: string;
  name: string;
  registrationNo: string | null;
  state: string;
  city: string;
  cityCode: string;
  pincode: string;
  type: SocietyType;
  totalUnits: number;
  joiningFee: number;
  annualFee: number;
  feeSessionStartMonth: number;
  gracePeriodDays: number;
  plan: SubscriptionPlan;
  status: SocietyStatus;
  subscriptionExpiresAt: string | null;
  trialEndsAt: string | null;
  onboardingDate: string;
  createdAt: string;
  updatedAt: string;
}

export type SocietyType =
  | "APARTMENT_COMPLEX"
  | "BUILDER_FLOORS"
  | "GATED_COMMUNITY_VILLAS"
  | "INDEPENDENT_SECTOR"
  | "PLOTTED_COLONY";

export type SocietyStatus = "ACTIVE" | "TRIAL" | "SUSPENDED" | "OFFBOARDED";

export type SubscriptionPlan = "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";

export const SOCIETY_TYPE_LABELS: Record<SocietyType, string> = {
  APARTMENT_COMPLEX: "Apartment Complex",
  BUILDER_FLOORS: "Builder Floors",
  GATED_COMMUNITY_VILLAS: "Gated Community (Villas)",
  INDEPENDENT_SECTOR: "Independent Sector",
  PLOTTED_COLONY: "Plotted Colony",
};

export interface AdminSummary {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  authUserId: string | null;
  adminPermission: "FULL_ACCESS" | "READ_NOTIFY" | null;
  createdAt: string;
}

export interface SocietyDetail extends Society {
  residentCount: number;
  admins: AdminSummary[];
  feeStats: {
    totalCollected: number;
    breakdown: { status: string; _count: number; _sum: { amountPaid: number | null } }[];
  };
  balance: number;
}

export const SOCIETY_TYPE_ADDRESS_FIELDS: Record<
  SocietyType,
  { required: string[]; optional: string[] }
> = {
  APARTMENT_COMPLEX: { required: ["towerBlock", "floorNo", "flatNo"], optional: [] },
  BUILDER_FLOORS: { required: ["houseNo", "floorLevel"], optional: [] },
  GATED_COMMUNITY_VILLAS: { required: ["villaNo"], optional: ["streetPhase"] },
  INDEPENDENT_SECTOR: { required: ["houseNo", "streetGali"], optional: ["sectorBlock"] },
  PLOTTED_COLONY: { required: ["plotNo"], optional: ["laneNo", "phase"] },
};
