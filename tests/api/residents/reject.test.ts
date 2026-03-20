import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getFullAccessAdmin: mockGetFullAccessAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { PATCH } from "@/app/api/v1/residents/[id]/reject/route";

function makeReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockPendingUser = {
  id: "r1",
  name: "Rajesh Kumar",
  email: "rajesh@eden.com",
  status: "PENDING_APPROVAL",
  societyId: "soc-1",
};

const validBody = { reason: "Incomplete documentation" };

describe("PATCH /api/v1/residents/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);
    mockPrisma.user.update.mockResolvedValue({ ...mockPendingUser, status: "REJECTED" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(res.status).toBe(401);
  });

  it("returns 422 when reason is missing", async () => {
    const res = await PATCH(makeReq("r1", {}), makeParams("r1"));
    expect(res.status).toBe(422);
  });

  it("returns 422 when reason is empty string", async () => {
    const res = await PATCH(makeReq("r1", { reason: "" }), makeParams("r1"));
    expect(res.status).toBe(422);
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when resident is not PENDING_APPROVAL", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockPendingUser, status: "ACTIVE_PAID" });
    const res = await PATCH(makeReq("r1", validBody), makeParams("r1"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("rejects resident and returns success message", async () => {
    const res = await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("rejected");
  });

  it("updates user status to REJECTED with reason", async () => {
    await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: validBody.reason,
        }),
      }),
    );
  });

  it("fires audit log with RESIDENT_REJECTED after success", async () => {
    await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_REJECTED",
        userId: "admin-1",
        entityType: "User",
        entityId: "r1",
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeReq("r1", validBody), makeParams("r1"));
    expect(res.status).toBe(500);
  });
});
