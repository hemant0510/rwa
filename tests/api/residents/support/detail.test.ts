import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/residents/me/support/[id]/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

function makeReq() {
  return new Request("http://localhost/api/v1/residents/me/support/t-1");
}

function makeParams(id = "t-1") {
  return { params: Promise.resolve({ id }) };
}

describe("Resident Support Detail API — GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns ticket detail with messages and user info", async () => {
    const ticket = {
      id: "t-1",
      subject: "Leak issue",
      createdByUser: { name: "John" },
      petition: null,
      messages: [{ id: "m-1", content: "Details here", isInternal: false, attachments: [] }],
    };
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("t-1");
    expect(body.createdByUser.name).toBe("John");
    expect(body.messages).toHaveLength(1);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams("t-missing"));
    expect(res.status).toBe(404);
  });

  it("scopes query to society", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    await GET(makeReq(), makeParams());
    expect(mockPrisma.residentTicket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1", societyId: "soc-1" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });
});
