import { describe, it, expect } from "vitest";

import { generateMemberId, generatePetId, generateHelperId } from "@/lib/utils/member-id";

describe("generateMemberId", () => {
  it("formats rwaid + seq with M prefix", () => {
    expect(generateMemberId("EDN-DLH-0042", 1)).toBe("EDN-DLH-0042-M1");
  });

  it("increments correctly for multiple members", () => {
    expect(generateMemberId("EDN-DLH-0042", 2)).toBe("EDN-DLH-0042-M2");
    expect(generateMemberId("EDN-DLH-0042", 10)).toBe("EDN-DLH-0042-M10");
  });

  it("works with seq=0 (boundary)", () => {
    expect(generateMemberId("EDN-DLH-0001", 0)).toBe("EDN-DLH-0001-M0");
  });

  it("works with different rwaid formats", () => {
    expect(generateMemberId("EDN-MUM-0001", 1)).toBe("EDN-MUM-0001-M1");
    expect(generateMemberId("XYZ-BLR-9999", 5)).toBe("XYZ-BLR-9999-M5");
  });
});

describe("generatePetId", () => {
  it("formats rwaid + seq with P prefix", () => {
    expect(generatePetId("EDN-DLH-0042", 1)).toBe("EDN-DLH-0042-P1");
  });

  it("increments correctly", () => {
    expect(generatePetId("EDN-DLH-0042", 2)).toBe("EDN-DLH-0042-P2");
    expect(generatePetId("EDN-DLH-0042", 10)).toBe("EDN-DLH-0042-P10");
  });

  it("works with seq=0 (boundary)", () => {
    expect(generatePetId("EDN-DLH-0001", 0)).toBe("EDN-DLH-0001-P0");
  });
});

describe("generateHelperId", () => {
  it("formats rwaid + seq with H prefix", () => {
    expect(generateHelperId("EDN-DLH-0042", 1)).toBe("EDN-DLH-0042-H1");
  });

  it("increments correctly", () => {
    expect(generateHelperId("EDN-DLH-0042", 2)).toBe("EDN-DLH-0042-H2");
    expect(generateHelperId("EDN-DLH-0042", 10)).toBe("EDN-DLH-0042-H10");
  });

  it("works with seq=0 (boundary)", () => {
    expect(generateHelperId("EDN-DLH-0001", 0)).toBe("EDN-DLH-0001-H0");
  });
});
