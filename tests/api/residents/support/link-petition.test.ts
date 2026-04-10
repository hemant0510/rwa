import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  petition: {
    findUnique: vi.fn(),
  },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { PATCH } from "@/app/api/v1/residents/me/support/[id]/link-petition/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });

function makePatchReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/residents/me/support/t-1/link-petition", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PETITION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockTicket = {
  id: "t-1",
  societyId: "soc-1",
  createdBy: "u-1",
  status: "OPEN",
  petitionId: null,
};

const mockPetition = {
  id: VALID_PETITION_ID,
  societyId: "soc-1",
  status: "PUBLISHED",
};

describe("Resident Support Link Petition API — PATCH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when not ticket creator", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      ...mockTicket,
      createdBy: "u-other",
    });
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 400 when ticket is CLOSED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      ...mockTicket,
      status: "CLOSED",
    });
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("closed");
  });

  it("returns 422 on invalid petitionId (non-UUID string)", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    const res = await PATCH(makePatchReq({ petitionId: "not-a-uuid" }) as never, makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when petition not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain("Petition not found");
  });

  it("returns 400 when petition from different society", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      societyId: "soc-other",
    });
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("same society");
  });

  it("returns 400 when petition status is DRAFT", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      status: "DRAFT",
    });
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("published or submitted");
  });

  it("successfully links PUBLISHED petition", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPetition);
    const updated = { id: "t-1", petitionId: VALID_PETITION_ID, petition: mockPetition };
    mockPrisma.residentTicket.update.mockResolvedValue(updated);

    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { petitionId: VALID_PETITION_ID },
      include: {
        petition: { select: { id: true, title: true, type: true, status: true } },
      },
    });
  });

  it("successfully unlinks (petitionId: null)", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      ...mockTicket,
      petitionId: VALID_PETITION_ID,
    });
    const updated = { id: "t-1", petitionId: null, petition: null };
    mockPrisma.residentTicket.update.mockResolvedValue(updated);

    const res = await PATCH(makePatchReq({ petitionId: null }) as never, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { petitionId: null },
      include: {
        petition: { select: { id: true, title: true, type: true, status: true } },
      },
    });
  });

  it("calls logAudit on success", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(mockTicket);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPetition);
    mockPrisma.residentTicket.update.mockResolvedValue({
      id: "t-1",
      petitionId: VALID_PETITION_ID,
    });

    await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_PETITION_LINKED",
        userId: "u-1",
        societyId: "soc-1",
        entityType: "ResidentTicket",
        entityId: "t-1",
        oldValue: { petitionId: null },
        newValue: { petitionId: VALID_PETITION_ID },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB"));
    const res = await PATCH(makePatchReq({ petitionId: VALID_PETITION_ID }) as never, makeParams());
    expect(res.status).toBe(500);
  });
});
