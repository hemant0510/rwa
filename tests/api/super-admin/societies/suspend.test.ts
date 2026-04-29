import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendSocietySuspended = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn(), update: vi.fn() },
  societyStatusChange: { create: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/whatsapp", () => ({ sendSocietySuspended: mockSendSocietySuspended }));

import { POST } from "@/app/api/v1/super-admin/societies/[id]/suspend/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockSociety = {
  id: "soc-1",
  societyCode: "EDEN001",
  name: "Greenwood Residency",
  status: "ACTIVE",
  users: [{ id: "user-1", name: "Admin User", mobile: "9876543210" }],
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/societies/soc-1/suspend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/super-admin/societies/[id]/suspend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.society.update.mockResolvedValue({ ...mockSociety, status: "SUSPENDED" });
    mockPrisma.societyStatusChange.create.mockResolvedValue({ id: "sc-1" });
    mockLogAudit.mockResolvedValue(undefined);
    mockSendSocietySuspended.mockResolvedValue({ success: true });
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await POST(makeReq({ reason: "Non-payment for 3 months" }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("suspends ACTIVE society with reason → status = SUSPENDED", async () => {
    const res = await POST(
      makeReq({
        reason: "Non-payment for 3 consecutive months",
        gracePeriodDays: 0,
        notifyAdmin: false,
      }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SUSPENDED" } }),
    );
    expect(mockPrisma.societyStatusChange.create).toHaveBeenCalled();
  });

  it("sets gracePeriodEnd when gracePeriodDays > 0", async () => {
    const before = Date.now();
    await POST(
      makeReq({
        reason: "Non-payment for 3 consecutive months",
        gracePeriodDays: 7,
        notifyAdmin: false,
      }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    const createCall = mockPrisma.societyStatusChange.create.mock.calls[0][0];
    const gpEnd: Date = createCall.data.gracePeriodEnd;
    expect(gpEnd).toBeInstanceOf(Date);
    const diffDays = (gpEnd.getTime() - before) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("sends WhatsApp notification when notifyAdmin=true and admin has mobile", async () => {
    await POST(
      makeReq({
        reason: "Non-payment for 3 consecutive months",
        gracePeriodDays: 0,
        notifyAdmin: true,
      }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(mockSendSocietySuspended).toHaveBeenCalledWith(
      "9876543210",
      "Admin User",
      "Greenwood Residency",
      "Non-payment for 3 consecutive months",
      null,
    );
  });

  it("skips notification when notifyAdmin=false", async () => {
    await POST(
      makeReq({
        reason: "Non-payment for 3 consecutive months",
        gracePeriodDays: 0,
        notifyAdmin: false,
      }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(mockSendSocietySuspended).not.toHaveBeenCalled();
  });

  it("returns 422 when reason is missing", async () => {
    const res = await POST(makeReq({ gracePeriodDays: 7 }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when reason is shorter than 10 chars", async () => {
    const res = await POST(makeReq({ reason: "Short" }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 400 when society is already SUSPENDED", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ ...mockSociety, status: "SUSPENDED" });
    const res = await POST(makeReq({ reason: "Non-payment for 3 consecutive months" }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATE");
  });

  it("returns 400 when society is OFFBOARDED", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ ...mockSociety, status: "OFFBOARDED" });
    const res = await POST(makeReq({ reason: "Non-payment for 3 consecutive months" }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATE");
  });

  it("logs audit entry with SA_SOCIETY_SUSPENDED", async () => {
    await POST(
      makeReq({
        reason: "Non-payment for 3 consecutive months",
        gracePeriodDays: 0,
        notifyAdmin: false,
      }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_SOCIETY_SUSPENDED" }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq({ reason: "Non-payment for 3 consecutive months" }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(500);
  });
});
