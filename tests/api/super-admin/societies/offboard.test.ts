import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendSocietyOffboarded = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn(), update: vi.fn() },
  societySubscription: { update: vi.fn() },
  societyStatusChange: { create: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/whatsapp", () => ({ sendSocietyOffboarded: mockSendSocietyOffboarded }));

import { POST } from "@/app/api/v1/super-admin/societies/[id]/offboard/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockSociety = {
  id: "soc-1",
  societyCode: "EDEN001",
  name: "Eden Estate",
  status: "ACTIVE",
  users: [{ id: "user-1", name: "Admin User", mobile: "9876543210" }],
  subscriptions: [{ id: "sub-1" }],
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/societies/soc-1/offboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/super-admin/societies/[id]/offboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.society.update.mockResolvedValue({ ...mockSociety, status: "OFFBOARDED" });
    mockPrisma.societySubscription.update.mockResolvedValue({ id: "sub-1", status: "CANCELLED" });
    mockPrisma.societyStatusChange.create.mockResolvedValue({ id: "sc-1" });
    mockLogAudit.mockResolvedValue(undefined);
    mockSendSocietyOffboarded.mockResolvedValue({ success: true });
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "EDEN001" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("offboards society with correct code → status = OFFBOARDED", async () => {
    const res = await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "EDEN001" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "OFFBOARDED" } }),
    );
  });

  it("cancels active subscription on offboard", async () => {
    await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "EDEN001" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(mockPrisma.societySubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
  });

  it("returns 400 when confirmation code does not match", async () => {
    const res = await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "WRONG" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CONFIRMATION");
  });

  it("returns 422 when reason is missing", async () => {
    const res = await POST(makeReq({ confirmationCode: "EDEN001" }), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("logs audit entry with SA_SOCIETY_OFFBOARDED", async () => {
    await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "EDEN001" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_SOCIETY_OFFBOARDED" }),
    );
  });

  it("skips subscription cancel when no active subscription", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ ...mockSociety, subscriptions: [] });
    const res = await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "EDEN001" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.societySubscription.update).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(
      makeReq({ reason: "Society permanently closed down", confirmationCode: "EDEN001" }),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});
