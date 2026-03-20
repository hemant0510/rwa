import { describe, it, expect } from "vitest";

import { cn, maskMobile } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("px-4", "py-2");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toContain("base");
    expect(result).toContain("visible");
    expect(result).not.toContain("hidden");
  });

  it("resolves Tailwind conflicts", () => {
    const result = cn("px-4", "px-6");
    expect(result).toBe("px-6");
  });

  it("handles undefined and null", () => {
    const result = cn("base", undefined, null);
    expect(result).toBe("base");
  });

  it("handles empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });
});

describe("maskMobile", () => {
  it("masks first 5 digits of a 10-digit number", () => {
    expect(maskMobile("9876543210")).toBe("XXXXX 43210");
  });

  it("masks numbers with leading zeros", () => {
    expect(maskMobile("0123456789")).toBe("XXXXX 56789");
  });

  it("returns non-10-digit strings unchanged", () => {
    expect(maskMobile("98765")).toBe("98765");
    expect(maskMobile("987654321012")).toBe("987654321012");
  });

  it("returns — for null", () => {
    expect(maskMobile(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(maskMobile(undefined)).toBe("—");
  });

  it("returns — for empty string", () => {
    expect(maskMobile("")).toBe("—");
  });

  it("returns non-numeric strings unchanged", () => {
    expect(maskMobile("not-a-number")).toBe("not-a-number");
  });
});
