import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

/* eslint-disable import/order */
import { mockPrisma } from "../../__mocks__/prisma";
import { PATCH, DELETE } from "@/app/api/v1/super-admin/discounts/[id]/route";
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

function makePatchReq(body: unknown, id = "d-1") {
  return new NextRequest(`http://localhost/api/v1/super-admin/discounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(id = "d-1") {
  return new NextRequest(`http://localhost/api/v1/super-admin/discounts/${id}`, {
    method: "DELETE",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

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

describe("PATCH /api/v1/super-admin/discounts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await PATCH(makePatchReq({ name: "Updated" }), makeParams("d-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with updated discount", async () => {
    const updated = { ...mockDiscount, name: "Summer Sale Updated" };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ name: "Summer Sale Updated" });
    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Summer Sale Updated");
  });

  it("returns 404 when discount not found", async () => {
    mockPrisma.planDiscount.findUnique.mockResolvedValue(null);

    const req = makePatchReq({ name: "Updated" });
    const res = await PATCH(req, makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Discount not found");
  });

  it("returns 422 for invalid data", async () => {
    const req = makePatchReq({ discountValue: -10 }); // negative value

    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(422);
  });

  it("discountValue is always returned as a number", async () => {
    const updated = { ...mockDiscount, discountValue: 25 };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ discountValue: 25 });
    const res = await PATCH(req, makeParams("d-1"));
    const body = await res.json();

    expect(typeof body.discountValue).toBe("number");
    expect(body.discountValue).toBe(25);
  });

  it("can update allowedCycles", async () => {
    const updated = { ...mockDiscount, allowedCycles: ["ANNUAL"] };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ allowedCycles: ["ANNUAL"] });
    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowedCycles).toEqual(["ANNUAL"]);
  });

  it("can clear couponCode with null", async () => {
    const updated = { ...mockDiscount, couponCode: null };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ couponCode: null });
    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(200);
  });

  it("converts startsAt date string to Date object", async () => {
    const updated = { ...mockDiscount, startsAt: new Date("2025-06-01T00:00:00.000Z") };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ startsAt: "2025-06-01T00:00:00.000Z" });
    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.planDiscount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startsAt: expect.any(Date),
        }),
      }),
    );
  });

  it("converts endsAt date string to Date object", async () => {
    const updated = { ...mockDiscount, endsAt: new Date("2025-12-31T23:59:59.000Z") };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ endsAt: "2025-12-31T23:59:59.000Z" });
    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.planDiscount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endsAt: expect.any(Date),
        }),
      }),
    );
  });

  it("returns 500 when database throws during update", async () => {
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockRejectedValue(new Error("DB error"));

    const req = makePatchReq({ name: "Updated" });
    const res = await PATCH(req, makeParams("d-1"));

    expect(res.status).toBe(500);
  });

  it("logs audit entry on success", async () => {
    const updated = { ...mockDiscount, name: "Summer Sale Updated" };
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue(updated);

    const req = makePatchReq({ name: "Summer Sale Updated" });
    await PATCH(req, makeParams("d-1"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_DISCOUNT_UPDATED",
        userId: "sa-1",
        entityType: "PlanDiscount",
      }),
    );
  });
});

describe("DELETE /api/v1/super-admin/discounts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await DELETE(makeDeleteReq("d-1"), makeParams("d-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 on successful deactivation", async () => {
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue({ ...mockDiscount, isActive: false });

    const req = makeDeleteReq("d-1");
    const res = await DELETE(req, makeParams("d-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("sets isActive=false (soft delete)", async () => {
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue({ ...mockDiscount, isActive: false });

    const req = makeDeleteReq("d-1");
    await DELETE(req, makeParams("d-1"));

    expect(mockPrisma.planDiscount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it("returns 404 when discount not found", async () => {
    mockPrisma.planDiscount.findUnique.mockResolvedValue(null);

    const req = makeDeleteReq("missing");
    const res = await DELETE(req, makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Discount not found");
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.planDiscount.findUnique.mockRejectedValue(new Error("DB error"));

    const req = makeDeleteReq("d-1");
    const res = await DELETE(req, makeParams("d-1"));

    expect(res.status).toBe(500);
  });

  it("logs audit entry on success", async () => {
    mockPrisma.planDiscount.findUnique.mockResolvedValue(mockDiscount);
    mockPrisma.planDiscount.update.mockResolvedValue({ ...mockDiscount, isActive: false });

    const req = makeDeleteReq("d-1");
    await DELETE(req, makeParams("d-1"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_DISCOUNT_DEACTIVATED",
        userId: "sa-1",
        entityType: "PlanDiscount",
      }),
    );
  });
});
