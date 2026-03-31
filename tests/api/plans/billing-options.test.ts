import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

/* eslint-disable import/order */
import { mockPrisma } from "../../__mocks__/prisma";
import { DELETE, PATCH } from "@/app/api/v1/super-admin/plans/[id]/billing-options/[bid]/route";
import { POST } from "@/app/api/v1/super-admin/plans/[id]/billing-options/route";
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

function makePostReq(body: unknown, planId = "plan-1") {
  return new NextRequest(`http://localhost/api/v1/super-admin/plans/${planId}/billing-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchReq(body: unknown, planId = "plan-1", bid = "opt-1") {
  return new NextRequest(
    `http://localhost/api/v1/super-admin/plans/${planId}/billing-options/${bid}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makePostParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePatchParams(id: string, bid: string) {
  return { params: Promise.resolve({ id, bid }) };
}

function makeDeleteReq(planId = "plan-1", bid = "opt-1") {
  return new NextRequest(
    `http://localhost/api/v1/super-admin/plans/${planId}/billing-options/${bid}`,
    { method: "DELETE" },
  );
}

const mockOption = {
  id: "opt-1",
  planId: "plan-1",
  billingCycle: "ANNUAL",
  price: 9990,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("POST /api/v1/super-admin/plans/[id]/billing-options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await POST(
      makePostReq({ billingCycle: "ANNUAL", price: 9990 }),
      makePostParams("plan-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 201 on successful creation", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(null); // no duplicate
    mockPrisma.planBillingOption.create.mockResolvedValue(mockOption);

    const req = makePostReq({ billingCycle: "ANNUAL", price: 9990 });
    const res = await POST(req, makePostParams("plan-1"));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.billingCycle).toBe("ANNUAL");
    expect(typeof body.price).toBe("number");
  });

  it("returns 404 when plan not found", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);

    const req = makePostReq({ billingCycle: "ANNUAL", price: 9990 });
    const res = await POST(req, makePostParams("missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Plan not found");
  });

  it("returns 500 when billing cycle already exists for the plan", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.planBillingOption.findUnique.mockResolvedValue({ id: "existing-opt" });

    const req = makePostReq({ billingCycle: "ANNUAL", price: 9990 });
    const res = await POST(req, makePostParams("plan-1"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toContain("ANNUAL");
  });

  it("returns 422 with validation error for invalid payload", async () => {
    const req = makePostReq({ billingCycle: "WEEKLY", price: 100 }); // invalid cycle

    const res = await POST(req, makePostParams("plan-1"));

    expect(res.status).toBe(422);
  });

  it("returns 422 for non-positive price", async () => {
    const req = makePostReq({ billingCycle: "ANNUAL", price: -100 });

    const res = await POST(req, makePostParams("plan-1"));

    expect(res.status).toBe(422);
  });

  it("returns 500 when database throws during creation", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(null);
    mockPrisma.planBillingOption.create.mockRejectedValue(new Error("DB error"));

    const req = makePostReq({ billingCycle: "ANNUAL", price: 9990 });
    const res = await POST(req, makePostParams("plan-1"));

    expect(res.status).toBe(500);
  });

  it("logs audit entry on success", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(null);
    mockPrisma.planBillingOption.create.mockResolvedValue(mockOption);

    const req = makePostReq({ billingCycle: "ANNUAL", price: 9990 });
    await POST(req, makePostParams("plan-1"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_BILLING_OPTION_CREATED",
        userId: "sa-1",
        entityType: "PlanBillingOption",
      }),
    );
  });
});

describe("PATCH /api/v1/super-admin/plans/[id]/billing-options/[bid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await PATCH(makePatchReq({ price: 9990 }), makePatchParams("plan-1", "opt-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with updated billing option", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockResolvedValue({ ...mockOption, price: 10990 });

    const req = makePatchReq({ price: 10990 });
    const res = await PATCH(req, makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.price).toBe("number");
    expect(body.price).toBe(10990);
  });

  it("returns 404 when billing option not found", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(null);

    const req = makePatchReq({ price: 10990 });
    const res = await PATCH(req, makePatchParams("plan-1", "missing-opt"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Billing option not found");
  });

  it("returns 404 when billing option belongs to a different plan", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue({
      ...mockOption,
      planId: "another-plan", // wrong plan
    });

    const req = makePatchReq({ price: 10990 });
    const res = await PATCH(req, makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(404);
  });

  it("returns 422 for non-positive price", async () => {
    const req = makePatchReq({ price: 0 });

    const res = await PATCH(req, makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(422);
  });

  it("can update isActive flag", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockResolvedValue({ ...mockOption, isActive: false });

    const req = makePatchReq({ price: 9990, isActive: false });
    const res = await PATCH(req, makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isActive).toBe(false);
  });

  it("returns 500 when database throws during update", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockRejectedValue(new Error("DB error"));

    const req = makePatchReq({ price: 9990 });
    const res = await PATCH(req, makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(500);
  });

  it("logs audit entry on success", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockResolvedValue({ ...mockOption, price: 10990 });

    const req = makePatchReq({ price: 10990 });
    await PATCH(req, makePatchParams("plan-1", "opt-1"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_BILLING_OPTION_UPDATED",
        userId: "sa-1",
        entityType: "PlanBillingOption",
      }),
    );
  });
});

describe("DELETE /api/v1/super-admin/plans/[id]/billing-options/[bid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await DELETE(makeDeleteReq(), makePatchParams("plan-1", "opt-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 on successful deactivation", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockResolvedValue({ ...mockOption, isActive: false });

    const res = await DELETE(makeDeleteReq(), makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 when billing option not found", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeDeleteReq(), makePatchParams("plan-1", "missing-opt"));

    expect(res.status).toBe(404);
  });

  it("returns 404 when billing option belongs to a different plan", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue({
      ...mockOption,
      planId: "another-plan",
    });

    const res = await DELETE(makeDeleteReq("plan-1", "opt-1"), makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(404);
  });

  it("logs audit entry on success", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockResolvedValue({ ...mockOption, isActive: false });

    await DELETE(makeDeleteReq(), makePatchParams("plan-1", "opt-1"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_BILLING_OPTION_DELETED",
        userId: "sa-1",
        entityType: "PlanBillingOption",
        entityId: "opt-1",
      }),
    );
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.planBillingOption.findUnique.mockResolvedValue(mockOption);
    mockPrisma.planBillingOption.update.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(makeDeleteReq(), makePatchParams("plan-1", "opt-1"));

    expect(res.status).toBe(500);
  });
});
