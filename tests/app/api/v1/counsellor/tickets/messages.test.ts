import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicketEscalation: { findFirst: vi.fn() },
  residentTicketMessage: { create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogCounsellorAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/counsellor/audit", () => ({ logCounsellorAudit: mockLogCounsellorAudit }));

import { POST } from "@/app/api/v1/counsellor/tickets/[id]/messages/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "C" },
  error: null,
};

const makeParams = (id = "e-1") => ({ params: Promise.resolve({ id }) });
const makeReq = (body: unknown) =>
  new Request("http://localhost/api/v1/counsellor/tickets/e-1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCounsellor.mockResolvedValue(authedContext);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/v1/counsellor/tickets/[id]/messages", () => {
  it("returns 403 when guard rejects", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: null,
      error: new Response("{}", { status: 403 }),
    });
    const res = await POST(
      makeReq({ content: "hello", kind: "PRIVATE_NOTE" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid body (empty content)", async () => {
    const res = await POST(makeReq({ content: "", kind: "PRIVATE_NOTE" }) as never, makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when escalation not found", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({ content: "hello", kind: "PRIVATE_NOTE" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when escalation is RESOLVED_BY_COUNSELLOR", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "RESOLVED_BY_COUNSELLOR",
      ticket: { id: "t-1", societyId: "soc-1" },
    });
    const res = await POST(
      makeReq({ content: "hello", kind: "ADVISORY_TO_ADMIN" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when escalation is WITHDRAWN", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "WITHDRAWN",
      ticket: { id: "t-1", societyId: "soc-1" },
    });
    const res = await POST(
      makeReq({ content: "hello", kind: "PRIVATE_NOTE" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(400);
  });

  it("creates PRIVATE_NOTE message (isInternal=true) and logs note audit", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "ACKNOWLEDGED",
      ticket: { id: "t-1", societyId: "soc-1" },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({
      id: "m-1",
      authorRole: "COUNSELLOR",
      content: "internal",
      kind: "PRIVATE_NOTE",
      isInternal: true,
      createdAt: new Date(),
    });
    const res = await POST(
      makeReq({ content: "internal", kind: "PRIVATE_NOTE" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: "t-1",
          authorRole: "COUNSELLOR",
          counsellorId: "c-1",
          kind: "PRIVATE_NOTE",
          isInternal: true,
        }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "TICKET_COUNSELLOR_NOTE_POSTED" }),
    );
    expect(mockLogCounsellorAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        counsellorId: "c-1",
        actionType: "COUNSELLOR_POST_PRIVATE_NOTE",
        entityType: "ResidentTicketMessage",
      }),
    );
  });

  it("creates ADVISORY_TO_ADMIN message (isInternal=false) and logs advisory audit", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "REVIEWING",
      ticket: { id: "t-1", societyId: "soc-1" },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({
      id: "m-2",
      authorRole: "COUNSELLOR",
      content: "advisory",
      kind: "ADVISORY_TO_ADMIN",
      isInternal: false,
      createdAt: new Date(),
    });
    const res = await POST(
      makeReq({ content: "advisory", kind: "ADVISORY_TO_ADMIN" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "ADVISORY_TO_ADMIN", isInternal: false }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "TICKET_ADVISORY_POSTED" }),
    );
    expect(mockLogCounsellorAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        counsellorId: "c-1",
        actionType: "COUNSELLOR_POST_ADVISORY",
        entityType: "ResidentTicketMessage",
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq({ content: "x", kind: "PRIVATE_NOTE" }) as never, makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 403 for super admin", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: {
        counsellorId: "__super_admin__",
        authUserId: "auth-sa",
        email: "sa@x.com",
        name: "SA",
        isSuperAdmin: true,
      },
      error: null,
    });
    const res = await POST(
      makeReq({ content: "hello", kind: "PRIVATE_NOTE" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain("Super Admin");
  });
});
