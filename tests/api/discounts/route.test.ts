import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

/* eslint-disable import/order */
import { mockPrisma } from "../../__mocks__/prisma";
import { GET, POST } from "@/app/api/v1/super-admin/discounts/route";
/* eslint-enable import/order */

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));

const mockLogAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};
const saForbidden = {
  data: null,
  error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/discounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validCouponPayload = {
  name: "Summer Sale",
  discountType: "PERCENTAGE",
  discountValue: 20,
  appliesToAll: true,
  applicablePlanIds: [],
  triggerType: "COUPON_CODE",
  couponCode: "SUMMER20",
  allowedCycles: [],
};

const mockDiscount = {
  id: "d-1",
  name: "Summer Sale",
  description: null,
  discountType: "PERCENTAGE",
  discountValue: 20,
  appliesToAll: true,
  applicablePlanIds: [],
  triggerType: "COUPON_CODE",
  couponCode: "SUMMER20",
  startsAt: null,
  endsAt: null,
  maxUsageCount: null,
  usageCount: 0,
  allowedCycles: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/v1/super-admin/discounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with serialized discounts", async () => {
    mockPrisma.planDiscount.findMany.mockResolvedValue([
      { ...mockDiscount, _count: { subscriptions: 2 } },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("d-1");
    expect(body[0].usedCount).toBe(2);
    expect(typeof body[0].discountValue).toBe("number");
  });

  it("returns empty array when no discounts", async () => {
    mockPrisma.planDiscount.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual([]);
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.planDiscount.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();

    expect(res.status).toBe(500);
  });

  it("discountValue is always returned as a number", async () => {
    mockPrisma.planDiscount.findMany.mockResolvedValue([
      { ...mockDiscount, discountValue: 15, _count: { subscriptions: 0 } },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(typeof body[0].discountValue).toBe("number");
    expect(body[0].discountValue).toBe(15);
  });
});

describe("POST /api/v1/super-admin/discounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(403);
  });

  it("returns 201 with created discount", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue(null); // coupon not taken
    mockPrisma.planDiscount.create.mockResolvedValue(mockDiscount);

    const req = makeReq(validCouponPayload);
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("d-1");
    expect(body.couponCode).toBe("SUMMER20");
  });

  it("returns 500 when coupon code is already in use", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue({ id: "existing" });

    const req = makeReq(validCouponPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toContain("SUMMER20");
  });

  it("skips coupon uniqueness check when no couponCode", async () => {
    const payload = {
      name: "New Year Offer",
      discountType: "PERCENTAGE",
      discountValue: 30,
      appliesToAll: true,
      applicablePlanIds: [],
      triggerType: "AUTO_TIME_LIMITED",
      allowedCycles: [],
    };
    mockPrisma.planDiscount.create.mockResolvedValue({
      ...mockDiscount,
      ...payload,
      couponCode: null,
    });

    const req = makeReq(payload);
    const res = await POST(req);

    expect(res.status).toBe(201);
    // findFirst should NOT have been called for coupon uniqueness
    expect(mockPrisma.planDiscount.findFirst).not.toHaveBeenCalled();
  });

  it("returns 422 for validation error (missing coupon code for COUPON_CODE type)", async () => {
    const req = makeReq({ ...validCouponPayload, couponCode: null });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 422 for PERCENTAGE discount > 100", async () => {
    const req = makeReq({ ...validCouponPayload, discountValue: 110 });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 422 when appliesToAll=false and no planIds", async () => {
    const req = makeReq({ ...validCouponPayload, appliesToAll: false, applicablePlanIds: [] });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("creates discount with startsAt and endsAt dates", async () => {
    const payload = {
      ...validCouponPayload,
      startsAt: "2025-01-01T00:00:00.000Z",
      endsAt: "2025-12-31T23:59:59.000Z",
    };
    mockPrisma.planDiscount.findFirst.mockResolvedValue(null);
    mockPrisma.planDiscount.create.mockResolvedValue({ ...mockDiscount, ...payload });

    const req = makeReq(payload);
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("returns 500 when database throws during creation", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue(null);
    mockPrisma.planDiscount.create.mockRejectedValue(new Error("DB error"));

    const req = makeReq(validCouponPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("logs audit entry on success", async () => {
    mockPrisma.planDiscount.findFirst.mockResolvedValue(null);
    mockPrisma.planDiscount.create.mockResolvedValue(mockDiscount);

    const req = makeReq(validCouponPayload);
    await POST(req);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_DISCOUNT_CREATED",
        userId: "sa-1",
        entityType: "PlanDiscount",
      }),
    );
  });
});
