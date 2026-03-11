import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/discounts/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  couponCode: "SUMMER20",
  planId: "11111111-1111-4111-8111-111111111111",
  billingCycle: "ANNUAL",
};

const mockDiscount = {
  id: "d-1",
  name: "Summer Sale",
  discountType: "PERCENTAGE",
  discountValue: 20,
  appliesToAll: true,
  applicablePlanIds: [],
  couponCode: "SUMMER20",
  triggerType: "COUPON_CODE",
  isActive: true,
  startsAt: null,
  endsAt: null,
  maxUsageCount: null,
  usageCount: 3,
  allowedCycles: [],
};

import { POST } from "@/app/api/v1/super-admin/discounts/validate/route";

describe("POST /api/v1/super-admin/discounts/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with valid coupon details", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue(mockDiscount);

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.discountId).toBe("d-1");
    expect(body.name).toBe("Summer Sale");
    expect(body.discountType).toBe("PERCENTAGE");
    expect(typeof body.discountValue).toBe("number");
    expect(body.discountValue).toBe(20);
  });

  it("returns 404 when coupon code not found", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue(null);

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid or expired");
  });

  it("returns 404 when coupon has reached usage limit", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      maxUsageCount: 5,
      usageCount: 5, // at limit
    });

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("usage limit");
  });

  it("allows coupon when usageCount is below maxUsageCount", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      maxUsageCount: 10,
      usageCount: 5, // below limit
    });

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("allows coupon when maxUsageCount is null (unlimited)", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      maxUsageCount: null,
      usageCount: 9999,
    });

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("returns 404 when coupon is not valid for the given plan", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      appliesToAll: false,
      applicablePlanIds: ["00000000-0000-0000-0000-000000000099"], // different plan
    });

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("not valid for the selected plan");
  });

  it("allows coupon when appliesToAll=true regardless of plan", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      appliesToAll: true,
      applicablePlanIds: [],
    });

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("allows coupon when applicablePlanIds includes the given plan", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      appliesToAll: false,
      applicablePlanIds: ["11111111-1111-4111-8111-111111111111"],
    });

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("returns 404 when billing cycle is restricted and does not match", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      allowedCycles: ["MONTHLY", "THREE_YEAR"], // ANNUAL not allowed
    });

    const req = makeReq({ ...validPayload, billingCycle: "ANNUAL" });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("MONTHLY");
  });

  it("allows coupon when billing cycle matches restriction", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      allowedCycles: ["ANNUAL", "TWO_YEAR"],
    });

    const req = makeReq({ ...validPayload, billingCycle: "ANNUAL" });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("allows coupon when allowedCycles is empty (all cycles allowed)", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      allowedCycles: [],
    });

    const req = makeReq({ ...validPayload, billingCycle: "MONTHLY" });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("returns 422 for invalid payload (empty couponCode)", async () => {
    const req = makeReq({ couponCode: "", planId: validPayload.planId, billingCycle: "MONTHLY" });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid billing cycle", async () => {
    const req = makeReq({ ...validPayload, billingCycle: "WEEKLY" });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 422 for non-UUID planId", async () => {
    const req = makeReq({ ...validPayload, planId: "not-a-uuid" });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.planDiscount.findFirst.mockRejectedValue(new Error("DB error"));

    const req = makeReq(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("discountValue is always returned as a number in response", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({
      ...mockDiscount,
      discountValue: 15,
    });

    const req = makeReq(validPayload);
    const res = await POST(req);
    const body = await res.json();

    expect(typeof body.discountValue).toBe("number");
    expect(body.discountValue).toBe(15);
  });
});
