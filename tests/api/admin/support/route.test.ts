import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
  getAdminContext: mockGetAdminContext,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, POST } from "@/app/api/v1/admin/support/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  name: "Admin",
  isSuperAdmin: false,
};

function makeGetReq(params = "") {
  return new Request(`http://localhost/api/v1/admin/support${params}`);
}
function makePostReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/admin/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Admin Support API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);
  });

  it("GET returns 403 when not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(403);
  });

  it("GET scopes to ?societyId param (Super Admin)", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      isSuperAdmin: true,
      role: "SUPER_ADMIN",
      societyId: "soc-other",
    });
    await GET(makeGetReq("?societyId=soc-other") as never);
    expect(mockGetAdminContext).toHaveBeenCalledWith("soc-other");
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "soc-other" }) }),
    );
  });

  it("GET lists society-scoped requests", async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([{ id: "r-1", subject: "Bug" }]);
    mockPrisma.serviceRequest.count.mockResolvedValue(1);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "soc-1" }) }),
    );
  });

  it("GET filters by status", async () => {
    await GET(makeGetReq("?status=OPEN") as never);
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "OPEN" }) }),
    );
  });

  it("GET returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(500);
  });

  it("POST creates request with status OPEN", async () => {
    mockPrisma.serviceRequest.create.mockResolvedValue({
      id: "r-new",
      requestNumber: 1,
      status: "OPEN",
    });
    const res = await POST(
      makePostReq({
        type: "BUG_REPORT",
        priority: "HIGH",
        subject: "Login not working",
        description: "I cannot log in since morning today consistently",
      }),
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.serviceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "soc-1",
          createdBy: "u-1",
          type: "BUG_REPORT",
        }),
      }),
    );
  });

  it("POST returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makePostReq({
        type: "BUG_REPORT",
        subject: "Test subject here",
        description: "Test description that is long enough",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST returns 422 when subject too short", async () => {
    const res = await POST(
      makePostReq({
        type: "BUG_REPORT",
        subject: "Hi",
        description: "Long enough description here",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("POST returns 422 when description too short", async () => {
    const res = await POST(
      makePostReq({ type: "BUG_REPORT", subject: "Valid subject", description: "Short" }),
    );
    expect(res.status).toBe(422);
  });

  it("POST returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.create.mockRejectedValue(new Error("DB"));
    const res = await POST(
      makePostReq({
        type: "BUG_REPORT",
        subject: "Valid subject here",
        description: "Valid description that is long enough",
      }),
    );
    expect(res.status).toBe(500);
  });

  it("READ_NOTIFY admins can also create", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });
    mockPrisma.serviceRequest.create.mockResolvedValue({ id: "r-2" });
    const res = await POST(
      makePostReq({
        type: "FEATURE_REQUEST",
        subject: "Add dark mode please",
        description: "Would love a dark mode option in the dashboard",
      }),
    );
    expect(res.status).toBe(201);
  });
});
