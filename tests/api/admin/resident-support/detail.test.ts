import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getAdminContext: mockGetAdminContext }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/resident-support/[id]/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: false,
};

const mockSAAdmin = {
  userId: null,
  authUserId: "auth-sa",
  societyId: "soc-1",
  role: "SUPER_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: true,
  name: "Super Admin",
};

const mockTicket = {
  id: "t-1",
  subject: "Broken pipe",
  societyId: "soc-1",
  createdByUser: {
    name: "Resident One",
    email: "r1@test.com",
    phone: "9999999999",
    units: [{ unit: { unitNumber: "A-101" } }],
  },
  petition: null,
  messages: [
    {
      id: "m-1",
      content: "Please fix",
      isInternal: false,
      createdAt: "2024-01-01T00:00:00Z",
      attachments: [],
    },
    {
      id: "m-2",
      content: "Internal note",
      isInternal: true,
      createdAt: "2024-01-01T01:00:00Z",
      attachments: [],
    },
  ],
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) } as never;
}

describe("GET /api/v1/admin/resident-support/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    // Reset to clear any leftover mockResolvedValueOnce queue, then set up chain
    mockPrisma.residentTicket.findUnique.mockReset();
    // First call: entity lookup (select societyId). Second call: full ticket.
    mockPrisma.residentTicket.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce(mockTicket);
  });

  it("returns 404 when ticket entity not found", async () => {
    mockPrisma.residentTicket.findUnique.mockReset();
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), makeParams("t-999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when caller is not admin of that society", async () => {
    mockGetAdminContext.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockGetAdminContext).toHaveBeenCalledWith("soc-1");
  });

  it("returns ticket detail for RWA admin of same society", async () => {
    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("t-1");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].isInternal).toBe(true);
    expect(body.createdByUser.name).toBe("Resident One");
    // Second call: full ticket query without societyId in where
    expect(mockPrisma.residentTicket.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
      }),
    );
  });

  it("returns ticket detail for Super Admin", async () => {
    mockGetAdminContext.mockResolvedValue(mockSAAdmin);

    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("t-1");
  });

  it("returns 404 when full ticket query returns null", async () => {
    mockPrisma.residentTicket.findUnique.mockReset();
    mockPrisma.residentTicket.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockReset();
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB fail"));

    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
