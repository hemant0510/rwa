import { describe, it, expect } from "vitest";

import manifest from "@/app/manifest";

describe("manifest", () => {
  it("returns correct app identity", () => {
    const result = manifest();
    expect(result.name).toBe("RWA Connect");
    expect(result.short_name).toBe("RWA Connect");
    expect(result.description).toBe("Manage your Resident Welfare Association with RWA Connect");
  });

  it("returns correct display config", () => {
    const result = manifest();
    expect(result.display).toBe("standalone");
    expect(result.orientation).toBe("portrait");
    expect(result.theme_color).toBe("#0d9488");
    expect(result.background_color).toBe("#fafafa");
    expect(result.start_url).toBe("/");
    expect(result.scope).toBe("/");
  });

  it("returns all 8 icon entries", () => {
    const result = manifest();
    expect(result.icons).toHaveLength(8);
  });

  it("includes required 192x192 and 512x512 icons", () => {
    const result = manifest();
    const sizes = result.icons!.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("includes a maskable icon", () => {
    const result = manifest();
    const maskable = result.icons!.find((i) => i.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable!.sizes).toBe("512x512");
  });
});
