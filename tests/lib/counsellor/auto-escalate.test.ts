import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  residentTicketEscalationVote: { count: vi.fn(), updateMany: vi.fn() },
  residentTicketEscalation: { findFirst: vi.fn(), create: vi.fn() },
  counsellorSocietyAssignment: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

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

import { maybeAutoEscalate } from "@/lib/counsellor/auto-escalate";

const ticket = {
  id: "t-1",
  societyId: "soc-1",
  society: { counsellorEscalationThreshold: 10 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maybeAutoEscalate", () => {
  it("returns NO_COUNSELLOR when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const outcome = await maybeAutoEscalate("t-1");
    expect(outcome).toEqual({ created: false, reason: "NO_COUNSELLOR" });
  });

  it("returns ALREADY_ESCALATED when an open escalation exists", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(10);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({ id: "e-1" });

    const outcome = await maybeAutoEscalate("t-1");
    expect(outcome).toEqual({ created: false, reason: "ALREADY_ESCALATED" });
  });

  it("returns THRESHOLD_NOT_MET when vote count < threshold", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(5);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);

    const outcome = await maybeAutoEscalate("t-1");
    expect(outcome).toEqual({ created: false, reason: "THRESHOLD_NOT_MET" });
  });

  it("returns NO_COUNSELLOR when no counsellor assigned", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(10);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue(null);

    const outcome = await maybeAutoEscalate("t-1");
    expect(outcome).toEqual({ created: false, reason: "NO_COUNSELLOR" });
  });

  it("creates escalation in transaction and backfills vote escalationId", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(10);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ counsellorId: "c-1" });

    const tx = {
      residentTicketEscalation: { create: vi.fn().mockResolvedValue({ id: "e-42" }) },
      residentTicketEscalationVote: { updateMany: vi.fn().mockResolvedValue({ count: 10 }) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(tx));

    const outcome = await maybeAutoEscalate("t-1");
    expect(outcome).toEqual({ created: true, escalationId: "e-42", counsellorId: "c-1" });
    expect(tx.residentTicketEscalation.create).toHaveBeenCalledWith({
      data: {
        ticketId: "t-1",
        counsellorId: "c-1",
        source: "RESIDENT_VOTE",
        status: "PENDING",
      },
      select: { id: true },
    });
    expect(tx.residentTicketEscalationVote.updateMany).toHaveBeenCalledWith({
      where: { ticketId: "t-1", escalationId: null },
      data: { escalationId: "e-42" },
    });
  });

  it("returns ALREADY_ESCALATED when transaction raises P2002", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(10);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ counsellorId: "c-1" });

    const dupErr = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "test",
    });
    mockPrisma.$transaction.mockRejectedValue(dupErr);

    const outcome = await maybeAutoEscalate("t-1");
    expect(outcome).toEqual({ created: false, reason: "ALREADY_ESCALATED" });
  });

  it("re-throws non-P2002 errors from transaction", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(ticket);
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(10);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ counsellorId: "c-1" });

    mockPrisma.$transaction.mockRejectedValue(new Error("boom"));

    await expect(maybeAutoEscalate("t-1")).rejects.toThrow("boom");
  });
});
