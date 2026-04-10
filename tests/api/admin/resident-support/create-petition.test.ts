import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn(), update: vi.fn() },
  petition: { create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST } from "@/app/api/v1/admin/resident-support/[id]/create-petition/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) }) as never;

function makeReq(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockTicket = {
  id: "t-1",
  societyId: "soc-1",
  subject: "Water leak",
  description: "There is a water leak in the basement parking area near block C.",
};

const mockPetition = {
  id: "p-1",
  societyId: "soc-1",
  title: "Water leak",
  description: "There is a water leak in the basement parking area near block C.",
  type: "COMPLAINT",
  status: "DRAFT",
  createdBy: "u-1",
};

const mockUpdatedTicket = {
  id: "t-1",
  petitionId: "p-1",
  petition: { id: "p-1", title: "Water leak", type: "COMPLAINT", status: "DRAFT" },
};

describe("POST /api/v1/admin/resident-support/[id]/create-petition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    mockPrisma.petition.create.mockResolvedValue(mockPetition);
    mockPrisma.residentTicket.update.mockResolvedValue(mockUpdatedTicket);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST(makeReq({ type: "COMPLAINT" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for READ_NOTIFY", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });

    const res = await POST(makeReq({ type: "COMPLAINT" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ type: "COMPLAINT" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Ticket not found");
  });

  it("returns 422 on invalid type", async () => {
    const res = await POST(makeReq({ type: "INVALID_TYPE" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates petition and auto-links to ticket", async () => {
    const res = await POST(makeReq({ type: "COMPLAINT" }), makeParams());

    expect(res.status).toBe(201);

    expect(mockPrisma.petition.create).toHaveBeenCalledWith({
      data: {
        societyId: "soc-1",
        title: "Water leak",
        description: mockTicket.description,
        type: "COMPLAINT",
        status: "DRAFT",
        createdBy: "u-1",
      },
    });

    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
        data: { petitionId: "p-1" },
      }),
    );

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_CREATED",
        entityType: "Petition",
        entityId: "p-1",
        newValue: { title: "Water leak", type: "COMPLAINT", fromTicket: "t-1" },
      }),
    );
  });

  it("returns 201 with both petition and ticket", async () => {
    const res = await POST(makeReq({ type: "PETITION" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.petition).toBeDefined();
    expect(body.petition.id).toBe("p-1");
    expect(body.petition.status).toBe("DRAFT");
    expect(body.ticket).toBeDefined();
    expect(body.ticket.id).toBe("t-1");
    expect(body.ticket.petitionId).toBe("p-1");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB fail"));

    const res = await POST(makeReq({ type: "COMPLAINT" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
