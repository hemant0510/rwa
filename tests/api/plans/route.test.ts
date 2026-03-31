import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

/* eslint-disable import/order */
import { mockPrisma } from "../../__mocks__/prisma";
import { GET, POST } from "@/app/api/v1/super-admin/plans/route";
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

function makeReq(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/v1/super-admin/plans", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validFeatures = {
  resident_management: true,
  fee_collection: true,
  expense_tracking: true,
  basic_reports: true,
  advanced_reports: false,
  whatsapp: false,
  elections: false,
  ai_insights: false,
  api_access: false,
  multi_admin: false,
};

const validCreatePayload = {
  name: "Basic Plan",
  slug: "basic-plan",
  planType: "FLAT_FEE",
  featuresJson: validFeatures,
  billingOptions: [{ billingCycle: "MONTHLY", price: 999 }],
};

const mockPlan = {
  id: "plan-1",
  name: "Basic Plan",
  slug: "basic-plan",
  planType: "FLAT_FEE",
  pricePerUnit: null,
  featuresJson: validFeatures,
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

describe("GET /api/v1/super-admin/plans", () => {
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

  it("returns 200 with serialized plans", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue([mockPlan]);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("plan-1");
    expect(body[0].activeSubscribers).toBe(0);
  });

  it("pricePerUnit is returned as number for PER_UNIT plans", async () => {
    const planWithPrice = {
      ...mockPlan,
      planType: "PER_UNIT",
      pricePerUnit: 8,
    };
    mockPrisma.platformPlan.findMany.mockResolvedValue([planWithPrice]);

    const res = await GET();
    const body = await res.json();

    expect(typeof body[0].pricePerUnit).toBe("number");
    expect(body[0].pricePerUnit).toBe(8);
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.platformPlan.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns empty array when no plans exist", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual([]);
  });
});

describe("POST /api/v1/super-admin/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await POST(makeReq(validCreatePayload));
    expect(res.status).toBe(403);
  });

  it("returns 201 with created plan", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null); // slug not taken
    mockPrisma.platformPlan.create.mockResolvedValue({
      ...mockPlan,
      billingOptions: [
        { id: "opt-1", planId: "plan-1", billingCycle: "MONTHLY", price: 999, isActive: true },
      ],
    });

    const req = makeReq(validCreatePayload);
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("plan-1");
    expect(body.slug).toBe("basic-plan");
  });

  it("returns 404 when slug is already taken", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: "existing-plan" });

    const req = makeReq(validCreatePayload);
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("slug already exists");
  });

  it("returns 422 with validation error for invalid payload", async () => {
    const req = makeReq({ name: "X", slug: "Invalid Slug" }); // missing required fields

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 422 when billingOptions array is empty", async () => {
    const req = makeReq({ ...validCreatePayload, billingOptions: [] });

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 500 when database throws during create", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);
    mockPrisma.platformPlan.create.mockRejectedValue(new Error("DB error"));

    const req = makeReq(validCreatePayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("creates plan with explicit isActive=false on billing option", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);
    mockPrisma.platformPlan.create.mockResolvedValue({
      ...mockPlan,
      billingOptions: [
        { id: "opt-1", planId: "plan-1", billingCycle: "MONTHLY", price: 999, isActive: false },
      ],
    });

    const req = makeReq({
      ...validCreatePayload,
      billingOptions: [{ billingCycle: "MONTHLY", price: 999, isActive: false }],
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("creates plan with PER_UNIT type and pricePerUnit", async () => {
    const perUnitPlan = {
      ...mockPlan,
      planType: "PER_UNIT",
      pricePerUnit: 8,
      billingOptions: [
        { id: "opt-1", planId: "plan-1", billingCycle: "MONTHLY", price: 80, isActive: true },
      ],
    };
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);
    mockPrisma.platformPlan.create.mockResolvedValue(perUnitPlan);

    const req = makeReq({
      ...validCreatePayload,
      slug: "flex",
      planType: "PER_UNIT",
      pricePerUnit: 8,
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.planType).toBe("PER_UNIT");
  });

  it("logs audit entry on success", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);
    mockPrisma.platformPlan.create.mockResolvedValue({
      ...mockPlan,
      billingOptions: [
        { id: "opt-1", planId: "plan-1", billingCycle: "MONTHLY", price: 999, isActive: true },
      ],
    });

    const req = makeReq(validCreatePayload);
    await POST(req);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_PLAN_CREATED",
        userId: "sa-1",
        entityType: "PlatformPlan",
      }),
    );
  });
});
