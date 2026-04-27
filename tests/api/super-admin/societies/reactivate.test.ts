import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendSocietyReactivated = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn(), update: vi.fn() },
  societyStatusChange: { create: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/whatsapp", () => ({ sendSocietyReactivated: mockSendSocietyReactivated }));

import { POST } from "@/app/api/v1/super-admin/societies/[id]/reactivate/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockSociety = {
  id: "soc-1",
  societyCode: "EDEN001",
  name: "Greenwood Residency",
  status: "SUSPENDED",
  users: [{ id: "user-1", name: "Admin User", mobile: "9876543210" }],
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/societies/soc-1/reactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/super-admin/societies/[id]/reactivate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.society.update.mockResolvedValue({ ...mockSociety, status: "ACTIVE" });
    mockPrisma.societyStatusChange.create.mockResolvedValue({ id: "sc-1" });
    mockLogAudit.mockResolvedValue(undefined);
    mockSendSocietyReactivated.mockResolvedValue({ success: true });
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await POST(makeReq({}), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(403);
  });

  it("reactivates SUSPENDED society → status = ACTIVE", async () => {
    const res = await POST(makeReq({ notifyAdmin: false }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } }),
    );
  });

  it("returns 400 when society is not SUSPENDED", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ ...mockSociety, status: "ACTIVE" });
    const res = await POST(makeReq({}), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATE");
  });

  it("sends WhatsApp notification to admin on reactivation", async () => {
    await POST(makeReq({ notifyAdmin: true }), { params: Promise.resolve({ id: "soc-1" }) });
    expect(mockSendSocietyReactivated).toHaveBeenCalledWith(
      "9876543210",
      "Admin User",
      "Greenwood Residency",
    );
  });

  it("logs audit entry with SA_SOCIETY_REACTIVATED", async () => {
    await POST(makeReq({ notifyAdmin: false }), { params: Promise.resolve({ id: "soc-1" }) });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_SOCIETY_REACTIVATED" }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq({}), { params: Promise.resolve({ id: "soc-1" }) });
    expect(res.status).toBe(500);
  });
});
