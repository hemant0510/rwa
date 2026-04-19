import { describe, it, expect } from "vitest";

import { getCounsellorLifecycleState } from "@/lib/counsellor/lifecycle-state";

describe("getCounsellorLifecycleState", () => {
  it("returns SUSPENDED when isActive is false", () => {
    expect(
      getCounsellorLifecycleState({
        isActive: false,
        passwordSetAt: "2026-01-01T00:00:00Z",
        lastLoginAt: "2026-02-01T00:00:00Z",
      }),
    ).toBe("SUSPENDED");
  });

  it("returns INVITE_PENDING when active but passwordSetAt is null", () => {
    expect(
      getCounsellorLifecycleState({
        isActive: true,
        passwordSetAt: null,
        lastLoginAt: null,
      }),
    ).toBe("INVITE_PENDING");
  });

  it("returns AWAITING_FIRST_LOGIN when password set but never logged in", () => {
    expect(
      getCounsellorLifecycleState({
        isActive: true,
        passwordSetAt: "2026-03-01T00:00:00Z",
        lastLoginAt: null,
      }),
    ).toBe("AWAITING_FIRST_LOGIN");
  });

  it("returns ACTIVE when password set and has logged in", () => {
    expect(
      getCounsellorLifecycleState({
        isActive: true,
        passwordSetAt: "2026-03-01T00:00:00Z",
        lastLoginAt: "2026-04-01T00:00:00Z",
      }),
    ).toBe("ACTIVE");
  });
});
