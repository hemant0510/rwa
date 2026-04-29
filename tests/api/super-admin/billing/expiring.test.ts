import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  societySubscription: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/billing/expiring/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const mockSubscription = {
  societyId: "soc-1",
  society: { id: "soc-1", name: "Greenwood Residency", societyCode: "GRNW" },
  plan: { name: "Community" },
  currentPeriodEnd: new Date("2026-04-15"),
};

function makeReq(days?: string) {
  const url = days
    ? `http://localhost/api/v1/super-admin/billing/expiring?days=${days}`
    : `http://localhost/api/v1/super-admin/billing/expiring`;
  return new NextRequest(url);
}

describe("GET /api/v1/super-admin/billing/expiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.societySubscription.findMany.mockResolvedValue([mockSubscription]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with expiring subscriptions (default 30 days)", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].societyName).toBe("Greenwood Residency");
    expect(body[0].societyCode).toBe("GRNW");
    expect(body[0].planName).toBe("Community");
  });

  it("uses custom days param when provided", async () => {
    await GET(makeReq("7"));
    expect(mockPrisma.societySubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });

  it("falls back to 30 days when days param is NaN", async () => {
    const res = await GET(makeReq("notanumber"));
    expect(res.status).toBe(200);
  });

  it("returns 'Trial' for plan when plan is null", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { ...mockSubscription, plan: null },
    ]);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body[0].planName).toBe("Trial");
  });

  it("returns empty array when no subscriptions are expiring", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it("returns 500 when database throws", async () => {
    mockPrisma.societySubscription.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
