import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";

function makeReq(body: unknown, method = "PATCH") {
  return new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const mockPlan = {
  id: "plan-1",
  name: "Basic Plan",
  slug: "basic-plan",
  planType: "FLAT_FEE",
  pricePerUnit: null,
  isActive: true,
  isPublic: true,
  displayOrder: 0,
  badgeText: null,
  trialAccessLevel: false,
  billingOptions: [
    { id: "opt-1", planId: "plan-1", billingCycle: "MONTHLY", price: 999, isActive: true },
  ],
  _count: { subscriptions: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

import { GET, PATCH, DELETE } from "@/app/api/v1/super-admin/plans/[id]/route";

describe("GET /api/v1/super-admin/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with plan data", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(mockPlan);

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1");
    const res = await GET(req, makeParams("plan-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("plan-1");
    expect(body.activeSubscribers).toBe(0);
  });

  it("returns 404 when plan not found", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/missing");
    const res = await GET(req, makeParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Plan not found");
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.platformPlan.findUnique.mockRejectedValue(new Error("DB error"));

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1");
    const res = await GET(req, makeParams("plan-1"));

    expect(res.status).toBe(500);
  });

  it("includes activeSubscribers count from _count", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({
      ...mockPlan,
      _count: { subscriptions: 5 },
    });

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1");
    const res = await GET(req, makeParams("plan-1"));
    const body = await res.json();

    expect(body.activeSubscribers).toBe(5);
  });

  it("returns pricePerUnit as number for PER_UNIT plan", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({
      ...mockPlan,
      planType: "PER_UNIT",
      pricePerUnit: 8,
    });

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1");
    const res = await GET(req, makeParams("plan-1"));
    const body = await res.json();

    expect(typeof body.pricePerUnit).toBe("number");
    expect(body.pricePerUnit).toBe(8);
  });
});

describe("PATCH /api/v1/super-admin/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with updated plan", async () => {
    const updated = { ...mockPlan, name: "Basic Updated" };
    mockPrisma.platformPlan.findUnique.mockResolvedValue(mockPlan);
    mockPrisma.platformPlan.update.mockResolvedValue(updated);

    const req = makeReq({ name: "Basic Updated" });
    const res = await PATCH(req, makeParams("plan-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Basic Updated");
  });

  it("returns 404 when plan not found", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);

    const req = makeReq({ name: "Updated" });
    const res = await PATCH(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("returns 422 with validation error for invalid data", async () => {
    const req = makeReq({ name: "A" }); // too short

    const res = await PATCH(req, makeParams("plan-1"));

    expect(res.status).toBe(422);
  });

  it("can update isPublic field", async () => {
    const updated = { ...mockPlan, isPublic: false };
    mockPrisma.platformPlan.findUnique.mockResolvedValue(mockPlan);
    mockPrisma.platformPlan.update.mockResolvedValue(updated);

    const req = makeReq({ isPublic: false });
    const res = await PATCH(req, makeParams("plan-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPublic).toBe(false);
  });

  it("returns 500 when database throws during update", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(mockPlan);
    mockPrisma.platformPlan.update.mockRejectedValue(new Error("DB error"));

    const req = makeReq({ name: "Updated Plan" });
    const res = await PATCH(req, makeParams("plan-1"));

    expect(res.status).toBe(500);
  });

  it("returns pricePerUnit as number when updated plan has pricePerUnit", async () => {
    const perUnitPlan = { ...mockPlan, planType: "PER_UNIT", pricePerUnit: 10 };
    mockPrisma.platformPlan.findUnique.mockResolvedValue(perUnitPlan);
    mockPrisma.platformPlan.update.mockResolvedValue(perUnitPlan);

    const req = makeReq({ name: "Flex Plan" });
    const res = await PATCH(req, makeParams("plan-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.pricePerUnit).toBe("number");
    expect(body.pricePerUnit).toBe(10);
  });
});

describe("DELETE /api/v1/super-admin/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 on successful archive", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({
      ...mockPlan,
      _count: { subscriptions: 0 },
    });
    mockPrisma.platformPlan.update.mockResolvedValue({ ...mockPlan, isActive: false });

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("plan-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 when plan not found", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/missing", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("missing"));

    expect(res.status).toBe(404);
  });

  it("blocks archive when active subscribers exist", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({
      ...mockPlan,
      _count: { subscriptions: 3 },
    });

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("plan-1"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toContain("3 active subscriber");
  });

  it("sets both isActive=false and isPublic=false on archive", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({
      ...mockPlan,
      _count: { subscriptions: 0 },
    });
    mockPrisma.platformPlan.update.mockResolvedValue({
      ...mockPlan,
      isActive: false,
      isPublic: false,
    });

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1", {
      method: "DELETE",
    });
    await DELETE(req, makeParams("plan-1"));

    expect(mockPrisma.platformPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false, isPublic: false },
      }),
    );
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.platformPlan.findUnique.mockRejectedValue(new Error("DB error"));

    const req = new NextRequest("http://localhost/api/v1/super-admin/plans/plan-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("plan-1"));

    expect(res.status).toBe(500);
  });
});
