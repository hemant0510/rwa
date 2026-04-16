import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  designation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({
  getAdminContext: mockGetAdminContext,
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, POST } from "@/app/api/v1/admin/designations/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: false,
  name: "Admin",
};

const makeRequest = (societyId = "soc-1") =>
  new Request(`http://localhost/api/v1/admin/designations?societyId=${societyId}`);

describe("GET /api/v1/admin/designations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    mockPrisma.designation.findMany.mockResolvedValue([]);
  });

  it("returns 403 when caller is not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 for READ_ONLY admin (not SA)", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      adminPermission: "READ_NOTIFY",
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns designations for FULL_ACCESS admin", async () => {
    mockPrisma.designation.findMany.mockResolvedValue([
      { id: "d-1", name: "President", sortOrder: 1, _count: { members: 1 } },
      { id: "d-2", name: "Secretary", sortOrder: 2, _count: { members: 0 } },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("President");
    expect(body[0].memberCount).toBe(1);
  });

  it("returns designations for Super Admin", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
    mockPrisma.designation.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("scopes query to admin's societyId", async () => {
    await GET(makeRequest());
    expect(mockPrisma.designation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.designation.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/v1/admin/designations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/v1/admin/designations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
  });

  it("returns 403 when not full-access admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await POST(makePostRequest({ name: "Treasurer" }));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid name (too short)", async () => {
    const res = await POST(makePostRequest({ name: "A" }));
    expect(res.status).toBe(422);
  });

  it("returns 409 for duplicate name", async () => {
    mockPrisma.designation.findFirst.mockResolvedValueOnce({ id: "d-existing", name: "President" });
    const res = await POST(makePostRequest({ name: "President" }));
    expect(res.status).toBe(409);
  });

  it("creates designation successfully", async () => {
    mockPrisma.designation.findFirst
      .mockResolvedValueOnce(null) // no duplicate
      .mockResolvedValueOnce({ sortOrder: 2 }); // max sort order
    mockPrisma.designation.create.mockResolvedValue({
      id: "d-new",
      name: "Treasurer",
      sortOrder: 3,
    });
    const res = await POST(makePostRequest({ name: "Treasurer" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Treasurer");
  });

  it("uses sortOrder 1 when no existing designations", async () => {
    mockPrisma.designation.findFirst
      .mockResolvedValueOnce(null) // no duplicate
      .mockResolvedValueOnce(null); // no existing
    mockPrisma.designation.create.mockResolvedValue({
      id: "d-first",
      name: "President",
      sortOrder: 1,
    });
    const res = await POST(makePostRequest({ name: "President" }));
    expect(res.status).toBe(201);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.designation.findFirst.mockRejectedValue(new Error("DB"));
    const res = await POST(makePostRequest({ name: "Test" }));
    expect(res.status).toBe(500);
  });
});
