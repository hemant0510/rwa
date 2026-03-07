import { describe, it, expect } from "vitest";

import {
  calculateProRata,
  getSessionYear,
  getSessionDates,
  generateUnitDisplayLabel,
  generateSocietyId,
  generateRWAID,
  generateReceiptNo,
} from "@/lib/fee-calculator";

describe("calculateProRata", () => {
  it("calculates full year when approved in session start month", () => {
    const result = calculateProRata({
      annualFee: 1200,
      joiningFee: 1000,
      sessionStartMonth: 4,
      approvalMonth: 4,
    });
    expect(result.remainingMonths).toBe(12);
    expect(result.monthlyRate).toBe(100);
    expect(result.proRataAmount).toBe(1200);
    expect(result.totalFirstPayment).toBe(2200);
  });

  it("calculates partial year when approved mid-session", () => {
    const result = calculateProRata({
      annualFee: 1200,
      joiningFee: 1000,
      sessionStartMonth: 4,
      approvalMonth: 10,
    });
    expect(result.remainingMonths).toBe(6);
    expect(result.proRataAmount).toBe(600);
    expect(result.totalFirstPayment).toBe(1600);
  });

  it("handles approval before session start month", () => {
    const result = calculateProRata({
      annualFee: 1200,
      joiningFee: 1000,
      sessionStartMonth: 4,
      approvalMonth: 1,
    });
    expect(result.remainingMonths).toBe(3);
    expect(result.proRataAmount).toBe(300);
    expect(result.totalFirstPayment).toBe(1300);
  });

  it("handles zero joining fee", () => {
    const result = calculateProRata({
      annualFee: 1200,
      joiningFee: 0,
      sessionStartMonth: 4,
      approvalMonth: 4,
    });
    expect(result.joiningFee).toBe(0);
    expect(result.totalFirstPayment).toBe(1200);
  });

  it("handles last month of session", () => {
    const result = calculateProRata({
      annualFee: 1200,
      joiningFee: 1000,
      sessionStartMonth: 4,
      approvalMonth: 3,
    });
    expect(result.remainingMonths).toBe(1);
    expect(result.proRataAmount).toBe(100);
  });

  it("returns rounded monthly rate", () => {
    const result = calculateProRata({
      annualFee: 1000,
      joiningFee: 0,
      sessionStartMonth: 4,
      approvalMonth: 4,
    });
    expect(result.monthlyRate).toBe(83.33);
  });
});

describe("getSessionYear", () => {
  it("returns correct session year for April", () => {
    expect(getSessionYear(new Date(2025, 3, 15))).toBe("2025-26"); // April
  });

  it("returns correct session year for March", () => {
    expect(getSessionYear(new Date(2025, 2, 15))).toBe("2024-25"); // March
  });

  it("returns correct session year for January", () => {
    expect(getSessionYear(new Date(2025, 0, 1))).toBe("2024-25"); // January
  });

  it("returns correct session year for December", () => {
    expect(getSessionYear(new Date(2025, 11, 31))).toBe("2025-26"); // December
  });

  it("supports custom session start month", () => {
    expect(getSessionYear(new Date(2025, 0, 1), 1)).toBe("2025-26"); // Jan with Jan start
  });
});

describe("getSessionDates", () => {
  it("returns correct dates for default session", () => {
    const { start, end } = getSessionDates("2025-26");
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(3); // April (0-indexed)
    expect(end.getMonth()).toBe(2); // March
    expect(end.getFullYear()).toBe(2026);
  });

  it("returns correct dates for custom start month", () => {
    const { start, end: _end } = getSessionDates("2025-26", 1);
    expect(start.getMonth()).toBe(0); // January
    expect(start.getFullYear()).toBe(2025);
  });
});

describe("generateUnitDisplayLabel", () => {
  it("generates APARTMENT_COMPLEX label", () => {
    const label = generateUnitDisplayLabel("APARTMENT_COMPLEX", {
      towerBlock: "A",
      floorNo: "3",
      flatNo: "301",
    });
    expect(label).toBe("A-3-301");
  });

  it("generates BUILDER_FLOORS label", () => {
    const label = generateUnitDisplayLabel("BUILDER_FLOORS", {
      houseNo: "42",
      floorLevel: "GF",
    });
    expect(label).toBe("42-GF");
  });

  it("generates GATED_COMMUNITY_VILLAS label without phase", () => {
    const label = generateUnitDisplayLabel("GATED_COMMUNITY_VILLAS", {
      villaNo: "12",
    });
    expect(label).toBe("Villa-12");
  });

  it("generates GATED_COMMUNITY_VILLAS label with phase", () => {
    const label = generateUnitDisplayLabel("GATED_COMMUNITY_VILLAS", {
      villaNo: "12",
      streetPhase: "2",
    });
    expect(label).toBe("Villa-12-P2");
  });

  it("generates INDEPENDENT_SECTOR label", () => {
    const label = generateUnitDisplayLabel("INDEPENDENT_SECTOR", {
      sectorBlock: "28",
      streetGali: "5",
      houseNo: "42",
    });
    expect(label).toBe("S28-St5-H42");
  });

  it("generates PLOTTED_COLONY label without lane", () => {
    const label = generateUnitDisplayLabel("PLOTTED_COLONY", {
      plotNo: "42",
    });
    expect(label).toBe("Plot-42");
  });

  it("generates PLOTTED_COLONY label with lane", () => {
    const label = generateUnitDisplayLabel("PLOTTED_COLONY", {
      plotNo: "42",
      laneNo: "3",
    });
    expect(label).toBe("Plot-42-L3");
  });

  it("returns Unknown for unrecognized type", () => {
    const label = generateUnitDisplayLabel("UNKNOWN_TYPE", {});
    expect(label).toBe("Unknown");
  });
});

describe("generateSocietyId", () => {
  it("generates correct format", () => {
    const id = generateSocietyId("HR", "GUR", "122001", 1);
    expect(id).toBe("RWA-HR-GUR-122001-0001");
  });

  it("pads sequence number", () => {
    const id = generateSocietyId("DL", "DEL", "110001", 42);
    expect(id).toBe("RWA-DL-DEL-110001-0042");
  });
});

describe("generateRWAID", () => {
  it("generates correct format", () => {
    const id = generateRWAID("RWA-HR-GUR-122001-0001", 2025, 1);
    expect(id).toBe("RWA-HR-GUR-122001-0001-2025-0001");
  });

  it("pads resident sequence", () => {
    const id = generateRWAID("RWA-HR-GUR-122001-0001", 2025, 99);
    expect(id).toBe("RWA-HR-GUR-122001-0001-2025-0099");
  });
});

describe("generateReceiptNo", () => {
  it("generates correct format", () => {
    const receipt = generateReceiptNo("EDEN", 2025, 1);
    expect(receipt).toBe("EDEN-2025-R0001");
  });

  it("pads sequence number", () => {
    const receipt = generateReceiptNo("SEC28", 2025, 123);
    expect(receipt).toBe("SEC28-2025-R0123");
  });
});
