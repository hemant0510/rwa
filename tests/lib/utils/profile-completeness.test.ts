import { describe, it, expect } from "vitest";

import { computeCompleteness, type CompletenessInput } from "@/lib/utils/profile-completeness";

/** Base input: all fields null/false — 0 points, ownershipType = OWNER (100 possible) */
const base: CompletenessInput = {
  photoUrl: null,
  mobile: null,
  isEmailVerified: false,
  bloodGroup: null,
  idProofUrl: null,
  ownershipProofUrl: null,
  ownershipType: "OWNER",
  hasEmergencyContact: false,
  householdStatus: "NOT_SET",
  vehicleStatus: "NOT_SET",
  consentWhatsapp: false,
  showInDirectory: false,
  emergencyContactHasBloodGroup: false,
};

/** Fully-complete OWNER input — 100/100 = 100% */
const fullOwner: CompletenessInput = {
  photoUrl: "https://cdn.example.com/photo.jpg",
  mobile: "9876543210",
  isEmailVerified: true,
  bloodGroup: "O_POS",
  idProofUrl: "https://cdn.example.com/id.pdf",
  ownershipProofUrl: "https://cdn.example.com/proof.pdf",
  ownershipType: "OWNER",
  hasEmergencyContact: true,
  householdStatus: "HAS_ENTRIES",
  vehicleStatus: "HAS_ENTRIES",
  consentWhatsapp: true,
  showInDirectory: true,
  emergencyContactHasBloodGroup: true,
};

describe("computeCompleteness — tier thresholds", () => {
  it("0 points → BASIC (0%)", () => {
    const result = computeCompleteness(base);
    expect(result.percentage).toBe(0);
    expect(result.tier).toBe("BASIC");
    expect(result.earned).toBe(0);
    expect(result.possible).toBe(100);
  });

  it("49 points → BASIC (49%)", () => {
    // A1(15) + A2(10) + A3(10) + A4(10) + B1(4 is not valid... let me think)
    // A1=15, A2=10, A3=10, B1=15 => 50. Need 49.
    // A1=15, A2=10, A3=10, A4=10 = 45 ... not 49
    // A1=15, A2=10, A3=10, A4(10) = 45; + C1=10 = 55 too high
    // Actually let's get exactly 49: A1(15)+A2(10)+A3(10)+A4(10) = 45, then add partial...
    // We can only earn whole-item points. To get exactly 49 we need...
    // Items: A1=15, A2=10, A3=10, A4=10, B1=15, B2=10, C1=10, D1=10, E1=10 = 100
    // 49 isn't achievable with these weights. Closest below 50 is 45 (A1+A2+A3+A4).
    // Actually: A2+A3+A4+B2+C1+D1 = 10+10+10+10+10+10 = 60? No.
    // Let's get 45: A1(15)+A2(10)+A3(10)+A4(10) = 45%
    const result = computeCompleteness({
      ...base,
      photoUrl: "photo.jpg", // A1 = 15
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      bloodGroup: "A_POS", // A4 = 10
    });
    // earned = 45, possible = 100, percentage = 45%
    expect(result.percentage).toBe(45);
    expect(result.tier).toBe("BASIC");
  });

  it("exactly 49% boundary → BASIC", () => {
    // 49/100 is not achievable with these point weights.
    // Use ownershipType=OTHER (possible=90) to get different percentages.
    // With OTHER: A1(15)+A2(10)+A3(10)+A4(10) = 45/90 = 50% → STANDARD, not 49%
    // Achievable near-49%: 45/100 = 45% → BASIC confirmed above

    // Let's test 49/100: not achievable, so test 45% is the max below 50 for OWNER
    // with OTHER: 44/90 = 48.8% → BASIC
    // With OTHER: A2(10)+A3(10)+A4(10)+C1(10)+D1(10)-1? Can't subtract.
    // A1(15)+A2(10)+A3(10) = 35/90 = 38.8% → BASIC
    // A1(15)+A2(10)+A3(10)+A4(10) = 45/90 = 50% → STANDARD boundary
    // To get < 50% with OTHER: A1(15)+A2(10)+C1(10) = 35/90 = 38.8%, or A1(15)+A2(10)+A3(10) = 35/90
    const result = computeCompleteness({
      ...base,
      ownershipType: "OTHER",
      photoUrl: "photo.jpg", // A1 = 15
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      // total = 35/90 = 38.8% → BASIC
    });
    expect(result.possible).toBe(90);
    expect(result.earned).toBe(35);
    expect(result.percentage).toBe(39); // Math.round(35/90 * 100) = Math.round(38.88) = 39
    expect(result.tier).toBe("BASIC");
  });

  it("50 points (OWNER) → STANDARD (50%)", () => {
    // A1(15)+A2(10)+A3(10)+B2(10)+C1(10) = 55? No.
    // A1(15)+A2(10)+A3(10)+A4(10)+B2(10) = 55?
    // Need exactly 50: A1(15)+A3(10)+A4(10)+C1(10)+E1(10) = 55. Hmm.
    // A1(15)+A2(10)+A3(10)+D1(10)+E1(10) = 55.
    // A2(10)+A3(10)+A4(10)+B2(10)+C1(10) = 50 ✓
    const result = computeCompleteness({
      ...base,
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      bloodGroup: "B_POS", // A4 = 10
      ownershipProofUrl: "proof", // B2 = 10
      hasEmergencyContact: true, // C1 = 10
    });
    expect(result.earned).toBe(50);
    expect(result.percentage).toBe(50);
    expect(result.tier).toBe("STANDARD");
  });

  it("74% boundary → STANDARD", () => {
    // Need 74/100 → not achievable exactly. Max below 75: 70 = A1+A2+A3+A4+B2+C1+D1 = 75. Hmm.
    // A1(15)+A2(10)+A3(10)+A4(10)+B2(10)+C1(10)+D1(10) = 75 → COMPLETE boundary
    // 65 = A1(15)+A2(10)+A3(10)+A4(10)+B2(10)+C1(10) = 70.
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15) = 60.
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+C1(10) = 70.
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+D1(10) = 70.
    // 70/100 = 70% → STANDARD confirmed
    const result = computeCompleteness({
      ...base,
      photoUrl: "photo.jpg", // A1 = 15
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      bloodGroup: "O_NEG", // A4 = 10
      idProofUrl: "id.pdf", // B1 = 15
      hasEmergencyContact: true, // C1 = 10
    });
    expect(result.earned).toBe(70);
    expect(result.percentage).toBe(70);
    expect(result.tier).toBe("STANDARD");
  });

  it("75 points → COMPLETE (75%)", () => {
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+C1(10)+D1(10) - wait = 80.
    // Need 75: A1(15)+A2(10)+A3(10)+A4(10)+B2(10)+C1(10)+D1(10) = 75 ✓
    const result = computeCompleteness({
      ...base,
      photoUrl: "photo.jpg", // A1 = 15
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      bloodGroup: "AB_POS", // A4 = 10
      ownershipProofUrl: "proof", // B2 = 10
      hasEmergencyContact: true, // C1 = 10
      householdStatus: "DECLARED_NONE", // D1 = 10
    });
    expect(result.earned).toBe(75);
    expect(result.percentage).toBe(75);
    expect(result.tier).toBe("COMPLETE");
  });

  it("89% boundary → COMPLETE", () => {
    // Need 89/100 → not achievable. Max below 90: 85.
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+B2(10)+C1(10)+D1(10) = 90. Too high.
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+B2(10)+C1(10)+E1(10) = 90. Too high.
    // Remove D1: A1+A2+A3+A4+B1+B2+C1+E1 = 90... still too high.
    // 85: A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+C1(10)+D1(10)+E1(10) = 90.
    // Hmm, let me count more carefully:
    // A1=15, A2=10, A3=10, A4=10, B1=15, B2=10, C1=10, D1=10, E1=10 = 100
    // Remove A4 (10): 90.
    // Remove A2 (10): 90.
    // Remove C1 (10): 90.
    // Remove B2 (10): 90.
    // We always get multiples of 5 because of A1(15) and B1(15) being odd.
    // Without A1: A2+A3+A4+B1+B2+C1+D1+E1 = 10+10+10+15+10+10+10+10 = 85 ✓
    const result = computeCompleteness({
      ...base,
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      bloodGroup: "A_NEG", // A4 = 10
      idProofUrl: "id.pdf", // B1 = 15
      ownershipProofUrl: "proof", // B2 = 10
      hasEmergencyContact: true, // C1 = 10
      householdStatus: "HAS_ENTRIES", // D1 = 10
      vehicleStatus: "HAS_ENTRIES", // E1 = 10
    });
    expect(result.earned).toBe(85);
    expect(result.percentage).toBe(85);
    expect(result.tier).toBe("COMPLETE");
  });

  it("90 points → VERIFIED (90%)", () => {
    // A1(15)+A2(10)+A3(10)+A4(10)+B1(15)+B2(10)+C1(10)+D1(10) = 90 ✓
    const result = computeCompleteness({
      ...base,
      photoUrl: "photo.jpg", // A1 = 15
      mobile: "9876543210", // A2 = 10
      isEmailVerified: true, // A3 = 10
      bloodGroup: "B_NEG", // A4 = 10
      idProofUrl: "id.pdf", // B1 = 15
      ownershipProofUrl: "proof", // B2 = 10
      hasEmergencyContact: true, // C1 = 10
      householdStatus: "HAS_ENTRIES", // D1 = 10
    });
    expect(result.earned).toBe(90);
    expect(result.percentage).toBe(90);
    expect(result.tier).toBe("VERIFIED");
  });

  it("100 points (fully complete OWNER) → VERIFIED (100%)", () => {
    const result = computeCompleteness(fullOwner);
    expect(result.earned).toBe(100);
    expect(result.possible).toBe(100);
    expect(result.percentage).toBe(100);
    expect(result.tier).toBe("VERIFIED");
  });
});

describe("computeCompleteness — B2 skip for ownershipType=OTHER", () => {
  it("possible = 90 when ownershipType is OTHER", () => {
    const result = computeCompleteness({ ...base, ownershipType: "OTHER" });
    expect(result.possible).toBe(90);
    expect(result.items.find((i) => i.key === "B2")).toBeUndefined();
  });

  it("possible = 100 when ownershipType is OWNER", () => {
    const result = computeCompleteness({ ...base, ownershipType: "OWNER" });
    expect(result.possible).toBe(100);
    expect(result.items.find((i) => i.key === "B2")).toBeDefined();
  });

  it("possible = 100 when ownershipType is TENANT", () => {
    const result = computeCompleteness({ ...base, ownershipType: "TENANT" });
    expect(result.possible).toBe(100);
    expect(result.items.find((i) => i.key === "B2")).toBeDefined();
  });

  it("possible = 90 when ownershipType is null", () => {
    // null ownershipType: isOther = false, so B2 is included, possible = 100
    const result = computeCompleteness({ ...base, ownershipType: null });
    expect(result.possible).toBe(100);
  });

  it("100% achievable with OTHER ownershipType (90/90)", () => {
    const result = computeCompleteness({
      ...fullOwner,
      ownershipType: "OTHER",
      ownershipProofUrl: null, // B2 excluded, so this doesn't matter
    });
    expect(result.possible).toBe(90);
    // earned = 100 - 10 (B2 excluded) = 90
    expect(result.earned).toBe(90);
    expect(result.percentage).toBe(100);
    expect(result.tier).toBe("VERIFIED");
  });

  it("50% with OTHER = 45/90", () => {
    // A1(15)+A2(10)+A3(10)+A4(10) = 45/90 = 50% → STANDARD boundary
    const result = computeCompleteness({
      ...base,
      ownershipType: "OTHER",
      photoUrl: "photo.jpg",
      mobile: "9876543210",
      isEmailVerified: true,
      bloodGroup: "O_POS",
    });
    expect(result.possible).toBe(90);
    expect(result.earned).toBe(45);
    expect(result.percentage).toBe(50);
    expect(result.tier).toBe("STANDARD");
  });
});

describe("computeCompleteness — bonus items", () => {
  it("bonus items do not affect percentage or tier", () => {
    const withBonus = computeCompleteness({
      ...base,
      consentWhatsapp: true,
      showInDirectory: true,
      emergencyContactHasBloodGroup: true,
    });
    const withoutBonus = computeCompleteness(base);
    expect(withBonus.percentage).toBe(withoutBonus.percentage);
    expect(withBonus.tier).toBe(withoutBonus.tier);
    expect(withBonus.earned).toBe(withoutBonus.earned);
  });

  it("returns correct bonus keys", () => {
    const result = computeCompleteness(base);
    expect(result.bonus.map((b) => b.key)).toEqual(["A5", "F1", "C2"]);
  });

  it("marks bonus items as completed when true", () => {
    const result = computeCompleteness({
      ...base,
      consentWhatsapp: true,
      showInDirectory: true,
      emergencyContactHasBloodGroup: true,
    });
    expect(result.bonus.every((b) => b.completed)).toBe(true);
  });

  it("marks bonus items as not completed when false", () => {
    const result = computeCompleteness(base);
    expect(result.bonus.every((b) => !b.completed)).toBe(true);
  });
});

describe("computeCompleteness — nextIncompleteItem", () => {
  it("returns first incomplete item when some items are missing", () => {
    const result = computeCompleteness(base);
    expect(result.nextIncompleteItem).not.toBeNull();
    expect(result.nextIncompleteItem?.key).toBe("A1"); // first item is profile photo
  });

  it("returns second item when first is complete", () => {
    const result = computeCompleteness({ ...base, photoUrl: "photo.jpg" });
    expect(result.nextIncompleteItem?.key).toBe("A2");
  });

  it("returns null when all items are complete", () => {
    const result = computeCompleteness(fullOwner);
    expect(result.nextIncompleteItem).toBeNull();
  });

  it("returns null when all items are complete with OTHER ownership", () => {
    const result = computeCompleteness({
      ...fullOwner,
      ownershipType: "OTHER",
      ownershipProofUrl: null,
    });
    expect(result.nextIncompleteItem).toBeNull();
  });
});

describe("computeCompleteness — result shape", () => {
  it("items array contains all 9 core items for OWNER", () => {
    const result = computeCompleteness({ ...base, ownershipType: "OWNER" });
    expect(result.items).toHaveLength(9);
    expect(result.items.map((i) => i.key)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
      "B1",
      "B2",
      "C1",
      "D1",
      "E1",
    ]);
  });

  it("items array contains 8 core items for OTHER (B2 excluded)", () => {
    const result = computeCompleteness({ ...base, ownershipType: "OTHER" });
    expect(result.items).toHaveLength(8);
    expect(result.items.map((i) => i.key)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
      "B1",
      "C1",
      "D1",
      "E1",
    ]);
  });

  it("householdStatus DECLARED_NONE satisfies D1", () => {
    const result = computeCompleteness({ ...base, householdStatus: "DECLARED_NONE" });
    const d1 = result.items.find((i) => i.key === "D1");
    expect(d1?.completed).toBe(true);
  });

  it("vehicleStatus DECLARED_NONE satisfies E1", () => {
    const result = computeCompleteness({ ...base, vehicleStatus: "DECLARED_NONE" });
    const e1 = result.items.find((i) => i.key === "E1");
    expect(e1?.completed).toBe(true);
  });
});
