import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  auditLog: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  superAdmin: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/audit-logs/export/route";

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
  oldValue: { name: "Old" },
  newValue: { name: "New" },
  ipAddress: "127.0.0.1",
  createdAt: new Date("2026-03-01T10:00:00Z"),
  society: { name: "Greenwood Residency" },
};

const mockUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Admin User",
  email: "admin@eden.com",
};

function makeReq(qs = "") {
  return new NextRequest(
    `http://localhost/api/v1/super-admin/audit-logs/export${qs ? `?${qs}` : ""}`,
  );
}

describe("GET /api/v1/super-admin/audit-logs/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
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

  it("returns CSV content-type", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
  });

  it("returns content-disposition attachment header", async () => {
    const res = await GET(makeReq());
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toMatch(/attachment; filename="audit-logs-/);
    expect(disposition).toMatch(/\.csv"/);
  });

  it("includes CSV header row", async () => {
    const res = await GET(makeReq());
    const text = await res.text();
    const firstLine = text.split("\n")[0];
    expect(firstLine).toContain("Timestamp");
    expect(firstLine).toContain("User Name");
    expect(firstLine).toContain("Action Type");
    expect(firstLine).toContain("Society");
  });

  it("includes data rows with user info resolved", async () => {
    const res = await GET(makeReq());
    const text = await res.text();
    const lines = text.split("\n");
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain("Admin User");
    expect(lines[1]).toContain("SOCIETY_UPDATED");
    expect(lines[1]).toContain("Greenwood Residency");
  });

  it("shows Platform for logs with no society", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { ...mockLog, societyId: null, society: null },
    ]);

    const res = await GET(makeReq());
    const text = await res.text();
    expect(text).toContain("Platform");
  });

  it("escapes CSV special characters in values", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { ...mockLog, society: { name: 'Society "A", Test' } },
    ]);

    const res = await GET(makeReq());
    const text = await res.text();
    expect(text).toContain('"Society ""A"", Test"');
  });

  it("resolves super admin name when user not in User table", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.superAdmin.findMany.mockResolvedValue([
      { id: "00000000-0000-4000-8000-000000000001", name: "Super Admin", email: "sa@rwa.com" },
    ]);

    const res = await GET(makeReq());
    const text = await res.text();
    expect(text).toContain("Super Admin");
  });

  it("returns empty CSV body with just header when no logs", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const res = await GET(makeReq());
    const text = await res.text();
    const lines = text.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });

  it("applies filters to the query", async () => {
    await GET(makeReq("actionType=SOCIETY_UPDATED&entityType=Society"));
    const [whereArg] = mockPrisma.auditLog.findMany.mock.calls[0];
    expect(whereArg.where.actionType).toEqual({ in: ["SOCIETY_UPDATED"] });
    expect(whereArg.where.entityType).toBe("Society");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.auditLog.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
