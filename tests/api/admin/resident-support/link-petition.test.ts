import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn(), update: vi.fn() },
  petition: { findUnique: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { PATCH } from "@/app/api/v1/admin/resident-support/[id]/link-petition/route";

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
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/admin/resident-support/[id]/link-petition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);

    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      societyId: "soc-1",
      petitionId: null,
    });

    mockPrisma.petition.findUnique.mockResolvedValue({
      id: "p-1",
      societyId: "soc-1",
    });

    mockPrisma.residentTicket.update.mockResolvedValue({
      id: "t-1",
      petitionId: "p-1",
      petition: { id: "p-1", title: "Water leak", type: "COMPLAINT", status: "DRAFT" },
    });
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await PATCH(makeReq({ petitionId: "p-1" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for READ_NOTIFY", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });

    const res = await PATCH(makeReq({ petitionId: "p-1" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);

    const res = await PATCH(makeReq({ petitionId: "p-1" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Ticket not found");
  });

  it("returns 422 on invalid petitionId", async () => {
    const res = await PATCH(makeReq({ petitionId: "not-a-uuid" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when petition not found", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);

    const validUuid = "a0000000-0000-4000-a000-000000000001";
    const res = await PATCH(makeReq({ petitionId: validUuid }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.message).toBe("Petition not found");
  });

  it("returns 400 when petition from different society", async () => {
    const validUuid = "a0000000-0000-4000-a000-000000000001";
    mockPrisma.petition.findUnique.mockResolvedValue({
      id: validUuid,
      societyId: "soc-other",
    });

    const res = await PATCH(makeReq({ petitionId: validUuid }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("Petition must belong to the same society");
  });

  it("successfully links petition (even DRAFT)", async () => {
    const validUuid = "a0000000-0000-4000-a000-000000000001";
    mockPrisma.petition.findUnique.mockResolvedValue({
      id: validUuid,
      societyId: "soc-1",
    });
    mockPrisma.residentTicket.update.mockResolvedValue({
      id: "t-1",
      petitionId: validUuid,
      petition: { id: validUuid, title: "Leak", type: "COMPLAINT", status: "DRAFT" },
    });

    const res = await PATCH(makeReq({ petitionId: validUuid }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.petitionId).toBe(validUuid);
    expect(body.petition.status).toBe("DRAFT");

    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
        data: { petitionId: validUuid },
      }),
    );

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_PETITION_LINKED",
        entityId: "t-1",
        newValue: { petitionId: validUuid },
      }),
    );
  });

  it("successfully unlinks (null)", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      societyId: "soc-1",
      petitionId: "p-old",
    });
    mockPrisma.residentTicket.update.mockResolvedValue({
      id: "t-1",
      petitionId: null,
      petition: null,
    });

    const res = await PATCH(makeReq({ petitionId: null }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.petitionId).toBeNull();

    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { petitionId: null },
      }),
    );

    // petition.findUnique should NOT be called when unlinking
    expect(mockPrisma.petition.findUnique).not.toHaveBeenCalled();

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: { petitionId: "p-old" },
        newValue: { petitionId: null },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB fail"));

    const res = await PATCH(makeReq({ petitionId: null }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
