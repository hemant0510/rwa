import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  societyStatusChange: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/societies/[id]/status-history/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockChange = {
  id: "sc-1",
  societyId: "soc-1",
  fromStatus: "ACTIVE",
  toStatus: "SUSPENDED",
  reason: "Non-payment for 3 consecutive months",
  note: null,
  gracePeriodEnd: null,
  notifiedAdmin: true,
  performedBy: "sa-1",
  createdAt: new Date("2026-03-01T10:00:00Z"),
};

function makeReq() {
  return new NextRequest("http://localhost/api/v1/super-admin/societies/soc-1/status-history");
}

describe("GET /api/v1/super-admin/societies/[id]/status-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.society.findUnique.mockResolvedValue({ id: "soc-1" });
    mockPrisma.societyStatusChange.findMany.mockResolvedValue([mockChange]);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns all status changes ordered by date desc", async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].fromStatus).toBe("ACTIVE");
    expect(body[0].toStatus).toBe("SUSPENDED");
    expect(mockPrisma.societyStatusChange.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("returns empty array when no history", async () => {
    mockPrisma.societyStatusChange.findMany.mockResolvedValue([]);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(500);
  });
});
