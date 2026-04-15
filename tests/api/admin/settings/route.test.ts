import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  feeSession: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/get-current-user", () => ({
  getAdminContext: mockGetAdminContext,
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, PATCH } from "@/app/api/v1/admin/settings/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
  name: "Admin",
  isSuperAdmin: false,
};

const mockSociety = {
  emailVerificationRequired: true,
  joiningFee: 500,
  annualFee: 2000,
  gracePeriodDays: 30,
  feeSessionStartMonth: 4,
};

const mockSession = {
  id: "sess-1",
  sessionYear: "2025-26",
  annualFee: 2000,
  joiningFee: 500,
  sessionStart: new Date("2025-04-01"),
  sessionEnd: new Date("2026-03-31"),
  gracePeriodEnd: new Date("2026-04-30"),
  status: "ACTIVE",
};

const getReq = (url = "http://test/api/v1/admin/settings") => new NextRequest(url);
const patchReq = (body: Record<string, unknown>) =>
  new NextRequest("http://test/api/v1/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

describe("GET /api/v1/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.feeSession.findMany.mockResolvedValue([mockSession]);
  });

  it("returns 403 when no admin context", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(mockGetAdminContext).toHaveBeenCalledWith(null);
  });

  it("returns 403 when admin lacks FULL_ACCESS and is not Super Admin", async () => {
    mockGetAdminContext.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("allows Super Admin with FULL_ACCESS even though permission comes synthetic", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      role: "SUPER_ADMIN" as const,
      isSuperAdmin: true,
      societyId: "soc-other",
    });
    const res = await GET(getReq("http://test/api/v1/admin/settings?societyId=soc-other"));
    expect(res.status).toBe(200);
    expect(mockGetAdminContext).toHaveBeenCalledWith("soc-other");
    expect(mockPrisma.society.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "soc-other" } }),
    );
  });

  it("returns 403 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("returns settings with fee sessions", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailVerificationRequired).toBe(true);
    expect(body.joiningFee).toBe(500);
    expect(body.annualFee).toBe(2000);
    expect(body.gracePeriodDays).toBe(30);
    expect(body.feeSessionStartMonth).toBe(4);
    expect(body.feeSessions).toHaveLength(1);
    expect(body.feeSessions[0].annualFee).toBe(2000);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB fail"));
    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/v1/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.society.update.mockResolvedValue(mockSociety);
  });

  it("returns 403 when no FULL_ACCESS admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await PATCH(patchReq({ joiningFee: 600 }));
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid body (out of range)", async () => {
    const res = await PATCH(patchReq({ joiningFee: -10 }));
    expect(res.status).toBe(422);
  });

  it("applies emailVerificationRequired when provided", async () => {
    const res = await PATCH(patchReq({ emailVerificationRequired: false }));
    expect(res.status).toBe(200);
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailVerificationRequired: false }),
      }),
    );
  });

  it("applies joiningFee when provided", async () => {
    await PATCH(patchReq({ joiningFee: 700 }));
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ joiningFee: 700 }) }),
    );
  });

  it("applies annualFee when provided", async () => {
    await PATCH(patchReq({ annualFee: 3000 }));
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ annualFee: 3000 }) }),
    );
  });

  it("applies gracePeriodDays when provided", async () => {
    await PATCH(patchReq({ gracePeriodDays: 45 }));
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gracePeriodDays: 45 }) }),
    );
  });

  it("applies feeSessionStartMonth when provided", async () => {
    await PATCH(patchReq({ feeSessionStartMonth: 6 }));
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ feeSessionStartMonth: 6 }) }),
    );
  });

  it("returns updated settings", async () => {
    mockPrisma.society.update.mockResolvedValue({
      emailVerificationRequired: false,
      joiningFee: 700,
      annualFee: 2500,
      gracePeriodDays: 45,
      feeSessionStartMonth: 6,
    });
    const res = await PATCH(patchReq({ joiningFee: 700 }));
    const body = await res.json();
    expect(body.joiningFee).toBe(700);
    expect(body.annualFee).toBe(2500);
    expect(body.emailVerificationRequired).toBe(false);
    expect(body.message).toBe("Settings updated successfully");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.update.mockRejectedValue(new Error("DB fail"));
    const res = await PATCH(patchReq({ joiningFee: 700 }));
    expect(res.status).toBe(500);
  });
});
