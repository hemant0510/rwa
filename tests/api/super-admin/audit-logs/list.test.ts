import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  user: { findMany: vi.fn() },
  superAdmin: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/audit-logs/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockLog = {
  id: "log-1",
  userId: "00000000-0000-4000-8000-000000000001",
  societyId: "00000000-0000-4000-8000-000000000002",
  actionType: "SOCIETY_UPDATED",
  entityType: "Society",
  entityId: "00000000-0000-4000-8000-000000000002",
  oldValue: { name: "Old Name" },
  newValue: { name: "New Name" },
  ipAddress: "127.0.0.1",
  createdAt: new Date("2026-03-01T10:00:00Z"),
  society: { id: "00000000-0000-4000-8000-000000000002", name: "Eden Estate" },
};

const mockUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Admin User",
  email: "admin@eden.com",
};

function makeReq(qs = "") {
  return new NextRequest(`http://localhost/api/v1/super-admin/audit-logs${qs ? `?${qs}` : ""}`);
}

describe("GET /api/v1/super-admin/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.auditLog.count.mockResolvedValue(1);
    mockPrisma.auditLog.findMany.mockResolvedValue([mockLog]);
    mockPrisma.user.findMany.mockResolvedValue([mockUser]);
    mockPrisma.superAdmin.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with paginated items", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.totalPages).toBe(1);
  });

  it("resolves user name and email", async () => {
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.items[0].userName).toBe("Admin User");
    expect(body.items[0].userEmail).toBe("admin@eden.com");
  });

  it("resolves super admin name when user not found in User table", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.superAdmin.findMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Super Admin",
        email: "admin@superadmin.com",
      },
    ]);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.items[0].userName).toBe("Super Admin");
  });

  it("returns null userName when userId not found in either table", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.superAdmin.findMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.items[0].userName).toBeNull();
    expect(body.items[0].userEmail).toBeNull();
  });

  it("filters by societyId=platform (null societyId)", async () => {
    await GET(makeReq("societyId=platform"));
    const [whereArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(whereArg.where.societyId).toBeNull();
  });

  it("filters by specific societyId", async () => {
    await GET(makeReq("societyId=00000000-0000-4000-8000-000000000002"));
    const [whereArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(whereArg.where.societyId).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("filters by actionType", async () => {
    await GET(makeReq("actionType=SOCIETY_UPDATED,SA_PLAN_CREATED"));
    const [whereArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(whereArg.where.actionType).toEqual({ in: ["SOCIETY_UPDATED", "SA_PLAN_CREATED"] });
  });

  it("filters by entityType", async () => {
    await GET(makeReq("entityType=Society"));
    const [whereArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(whereArg.where.entityType).toBe("Society");
  });

  it("filters by date range", async () => {
    await GET(makeReq("from=2026-03-01&to=2026-03-31"));
    const [whereArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(whereArg.where.createdAt).toBeDefined();
    expect(whereArg.where.createdAt.gte).toBeInstanceOf(Date);
    expect(whereArg.where.createdAt.lte).toBeInstanceOf(Date);
  });

  it("supports pagination params", async () => {
    mockPrisma.auditLog.count.mockResolvedValue(120);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("page=2&limit=50"));
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.totalPages).toBe(3);

    const [findManyArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(findManyArg.skip).toBe(50);
    expect(findManyArg.take).toBe(50);
  });

  it("clamps limit to MAX_PAGE_SIZE (100)", async () => {
    await GET(makeReq("limit=999"));
    const [findManyArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(findManyArg.take).toBe(100);
  });

  it("orders by createdAt asc when order=asc", async () => {
    await GET(makeReq("order=asc"));
    const [findManyArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(findManyArg.orderBy).toEqual({ createdAt: "asc" });
  });

  it("defaults to desc order", async () => {
    await GET(makeReq());
    const [findManyArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(findManyArg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("returns societyName from log.society", async () => {
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.items[0].societyName).toBe("Eden Estate");
  });

  it("returns null societyName for platform-level logs", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { ...mockLog, societyId: null, society: null },
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.items[0].societyName).toBeNull();
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.auditLog.count.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
