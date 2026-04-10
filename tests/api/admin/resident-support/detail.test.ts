import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/resident-support/[id]/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
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
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockGetCurrentUser).toHaveBeenCalledWith("RWA_ADMIN");
  });

  it("returns ticket detail with all messages", async () => {
    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("t-1");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].isInternal).toBe(true);
    expect(body.createdByUser.name).toBe("Resident One");
    expect(mockPrisma.residentTicket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1", societyId: "soc-1" },
      }),
    );
  });

  it("returns 404 when not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), makeParams("t-999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB fail"));

    const res = await GET(new Request("http://localhost"), makeParams("t-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
