import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicketEscalation: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogCounsellorAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/counsellor/audit", () => ({ logCounsellorAudit: mockLogCounsellorAudit }));

import { POST } from "@/app/api/v1/counsellor/tickets/[id]/defer/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "C" },
  error: null,
};

const makeParams = (id = "e-1") => ({ params: Promise.resolve({ id }) });
const makeReq = (body: unknown) =>
  new Request("http://localhost/api/v1/counsellor/tickets/e-1/defer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCounsellor.mockResolvedValue(authedContext);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/v1/counsellor/tickets/[id]/defer", () => {
  it("returns 403 when guard rejects", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: null,
      error: new Response("{}", { status: 403 }),
    });
    const res = await POST(makeReq({ reason: "a".repeat(20) }) as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid body", async () => {
    const res = await POST(makeReq({ reason: "x" }) as never, makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when escalation not found", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ reason: "a".repeat(20) }) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid transition from PENDING", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "PENDING",
      ticket: { id: "t-1", societyId: "soc-1" },
    });
    const res = await POST(makeReq({ reason: "a".repeat(20) }) as never, makeParams());
    expect(res.status).toBe(400);
  });

  it("transacts update + advisory and logs audit", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "REVIEWING",
      ticket: { id: "t-1", societyId: "soc-1" },
    });

    const tx = {
      residentTicketEscalation: {
        update: vi.fn().mockResolvedValue({ id: "e-1", status: "DEFERRED_TO_ADMIN" }),
      },
      residentTicketMessage: {
        create: vi.fn().mockResolvedValue({ id: "m-1" }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

    const res = await POST(
      makeReq({ reason: "Requires admin action for enforcement" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(tx.residentTicketEscalation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: { status: "DEFERRED_TO_ADMIN" },
      }),
    );
    expect(tx.residentTicketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "ADVISORY_TO_ADMIN",
          content: "Requires admin action for enforcement",
        }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "TICKET_ESCALATION_DEFERRED",
        newValue: expect.objectContaining({ advisoryMessageId: "m-1" }),
      }),
    );
    expect(mockLogCounsellorAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        counsellorId: "c-1",
        actionType: "COUNSELLOR_DEFER_ESCALATION",
        entityId: "e-1",
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq({ reason: "a".repeat(20) }) as never, makeParams());
    expect(res.status).toBe(500);
  });
});
