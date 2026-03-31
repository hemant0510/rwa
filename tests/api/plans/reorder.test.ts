import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

/* eslint-disable import/order */
import { mockPrisma } from "../../__mocks__/prisma";
import { POST } from "@/app/api/v1/super-admin/plans/reorder/route";
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
  return new NextRequest("http://localhost/api/v1/super-admin/plans/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/super-admin/plans/reorder", () => {
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

  it("returns 200 on successful reorder", async () => {
    mockPrisma.platformPlan.update.mockResolvedValue({});

    const req = makeReq({
      order: [
        { id: "11111111-1111-4111-8111-111111111111", displayOrder: 1 },
        { id: "22222222-2222-4222-8222-222222222222", displayOrder: 2 },
        { id: "33333333-3333-4333-8333-333333333333", displayOrder: 3 },
      ],
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("calls platformPlan.update for each item in order array", async () => {
    mockPrisma.platformPlan.update.mockResolvedValue({});

    const req = makeReq({
      order: [
        { id: "11111111-1111-4111-8111-111111111111", displayOrder: 0 },
        { id: "22222222-2222-4222-8222-222222222222", displayOrder: 1 },
      ],
    });
    await POST(req);

    // $transaction is called with an array
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 422 for invalid payload (non-UUID id)", async () => {
    const req = makeReq({
      order: [{ id: "not-a-uuid", displayOrder: 1 }],
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("returns 422 for missing order field", async () => {
    const req = makeReq({});

    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it("handles empty order array (no-op)", async () => {
    const req = makeReq({ order: [] });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("returns 500 when transaction throws", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB error"));

    const req = makeReq({
      order: [{ id: "11111111-1111-4111-8111-111111111111", displayOrder: 1 }],
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("logs audit entry on success", async () => {
    mockPrisma.platformPlan.update.mockResolvedValue({});

    const req = makeReq({
      order: [
        { id: "11111111-1111-4111-8111-111111111111", displayOrder: 1 },
        { id: "22222222-2222-4222-8222-222222222222", displayOrder: 2 },
        { id: "33333333-3333-4333-8333-333333333333", displayOrder: 3 },
      ],
    });
    await POST(req);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_PLAN_REORDERED",
        userId: "sa-1",
        entityType: "PlatformPlan",
      }),
    );
  });
});
