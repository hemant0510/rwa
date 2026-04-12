import type { BloodGroup, OwnershipType } from "@prisma/client";

export type TierLabel = "BASIC" | "STANDARD" | "COMPLETE" | "VERIFIED";

export interface CompletenessItem {
  key: string;
  label: string;
  completed: boolean;
  points: number;
}

export interface CompletenessBonus {
  key: string;
  label: string;
  completed: boolean;
}

export interface CompletenessResult {
  percentage: number;
  tier: TierLabel;
  earned: number;
  possible: number;
  items: CompletenessItem[];
  bonus: CompletenessBonus[];
  nextIncompleteItem: CompletenessItem | null;
}

export interface CompletenessInput {
  photoUrl: string | null;
  mobile: string | null;
  isEmailVerified: boolean;
  bloodGroup: BloodGroup | null;
  idProofUrl: string | null;
  ownershipProofUrl: string | null;
  ownershipType: OwnershipType | null;
  hasEmergencyContact: boolean;
  householdStatus: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
  vehicleStatus: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
  // bonus
  consentWhatsapp: boolean;
  showInDirectory: boolean;
  emergencyContactHasBloodGroup: boolean;
}

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const isOther = input.ownershipType === "OTHER";

  const coreItems: CompletenessItem[] = [
    { key: "A1", label: "Profile photo", completed: !!input.photoUrl, points: 15 },
    { key: "A2", label: "Mobile number", completed: !!input.mobile, points: 10 },
    { key: "A3", label: "Email verified", completed: input.isEmailVerified, points: 10 },
    { key: "A4", label: "Blood group", completed: !!input.bloodGroup, points: 10 },
    { key: "B1", label: "ID proof", completed: !!input.idProofUrl, points: 15 },
    // B2 only applicable when ownershipType is OWNER or TENANT (not OTHER)
    ...(!isOther
      ? [{ key: "B2", label: "Residency proof", completed: !!input.ownershipProofUrl, points: 10 }]
      : []),
    { key: "C1", label: "Emergency contact", completed: input.hasEmergencyContact, points: 10 },
    {
      key: "D1",
      label: "Household declared",
      completed: input.householdStatus !== "NOT_SET",
      points: 10,
    },
    {
      key: "E1",
      label: "Vehicle declared",
      completed: input.vehicleStatus !== "NOT_SET",
      points: 10,
    },
  ];

  const possible = coreItems.reduce((s, i) => s + i.points, 0); // 90 for OTHER, 100 for rest
  const earned = coreItems.filter((i) => i.completed).reduce((s, i) => s + i.points, 0);
  const percentage = Math.round((earned / possible) * 100);

  const tier: TierLabel =
    percentage >= 90
      ? "VERIFIED"
      : percentage >= 75
        ? "COMPLETE"
        : percentage >= 50
          ? "STANDARD"
          : "BASIC";

  const bonus: CompletenessBonus[] = [
    { key: "A5", label: "WhatsApp notifications", completed: input.consentWhatsapp },
    { key: "F1", label: "In society directory", completed: input.showInDirectory },
    {
      key: "C2",
      label: "Emergency contact blood group",
      completed: input.emergencyContactHasBloodGroup,
    },
  ];

  const nextIncompleteItem = coreItems.find((i) => !i.completed) ?? null;

  return { percentage, tier, earned, possible, items: coreItems, bonus, nextIncompleteItem };
}
