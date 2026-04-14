import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  residentTicketEscalationVote: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  society: { findUnique: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockMaybeAutoEscalate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/counsellor/auto-escalate", () => ({ maybeAutoEscalate: mockMaybeAutoEscalate }));

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion = "test";
    constructor(message: string, opts: { code: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

import { Prisma } from "@prisma/client";

import { POST, DELETE } from "@/app/api/v1/residents/me/support/[id]/escalation-vote/route";

const resident = {
  userId: "u-2",
  authUserId: "auth-2",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });
const makeReq = (method: "POST" | "DELETE") => new Request("http://localhost/x", { method });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(resident);
  mockLogAudit.mockResolvedValue(undefined);
  mockMaybeAutoEscalate.mockResolvedValue({ created: false, reason: "THRESHOLD_NOT_MET" });
});

describe("Resident escalation vote POST", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when ticket is CLOSED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "CLOSED",
      createdBy: "u-3",
    });
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 403 when voter is the creator", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      createdBy: "u-2",
    });
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 409 when already voted (P2002)", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      createdBy: "u-3",
    });
    mockPrisma.residentTicketEscalationVote.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
    );
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("ALREADY_VOTED");
  });

  it("creates vote, triggers auto-escalate, returns 201 with status", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      createdBy: "u-3",
    });
    mockPrisma.residentTicketEscalationVote.create.mockResolvedValue({ id: "v-1" });
    mockMaybeAutoEscalate.mockResolvedValue({
      created: true,
      escalationId: "e-1",
      counsellorId: "c-1",
    });
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(10);
    mockPrisma.society.findUnique.mockResolvedValue({ counsellorEscalationThreshold: 10 });

    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({
      voteCount: 10,
      threshold: 10,
      hasVoted: true,
      escalationCreated: true,
    });
    expect(mockMaybeAutoEscalate).toHaveBeenCalledWith("t-1");
  });

  it("falls back to threshold 10 if society lookup returns null", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      createdBy: "u-3",
    });
    mockPrisma.residentTicketEscalationVote.create.mockResolvedValue({ id: "v-1" });
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(3);
    mockPrisma.society.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq("POST"), makeParams());
    const json = await res.json();
    expect(json.threshold).toBe(10);
  });

  it("rethrows non-P2002 errors from vote create", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      createdBy: "u-3",
    });
    mockPrisma.residentTicketEscalationVote.create.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq("POST"), makeParams());
    expect(res.status).toBe(500);
  });
});

describe("Resident escalation vote DELETE", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE"), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no withdrawable vote exists", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalationVote.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeReq("DELETE"), makeParams());
    expect(res.status).toBe(400);
  });

  it("withdraws vote and returns updated status", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalationVote.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(2);
    mockPrisma.society.findUnique.mockResolvedValue({ counsellorEscalationThreshold: 10 });

    const res = await DELETE(makeReq("DELETE"), makeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      voteCount: 2,
      threshold: 10,
      hasVoted: false,
      escalationCreated: false,
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "TICKET_ESCALATION_VOTE_WITHDRAWN" }),
    );
  });

  it("falls back to threshold 10 on null society", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalationVote.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(0);
    mockPrisma.society.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeReq("DELETE"), makeParams());
    const json = await res.json();
    expect(json.threshold).toBe(10);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("db"));
    const res = await DELETE(makeReq("DELETE"), makeParams());
    expect(res.status).toBe(500);
  });
});
