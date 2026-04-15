import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyCronSecret = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicketEscalation: { findMany: vi.fn() },
  notificationLog: { findUnique: vi.fn(), create: vi.fn() },
}));
const mockSendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mockVerifyCronSecret }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));

import { POST } from "@/app/api/cron/counsellor-sla-breach/route";

const makeReq = () =>
  new Request("http://localhost/api/cron/counsellor-sla-breach", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });

const breachedEscalation = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "e-1",
  slaDeadline: new Date(Date.now() - 60 * 60 * 1000), // 1h overdue
  counsellor: { id: "c-1", name: "Alice", email: "alice@x.com" },
  ticket: {
    id: "t-1",
    ticketNumber: "TKT-1",
    subject: "Noise",
    societyId: "soc-1",
    society: { name: "Alpha" },
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyCronSecret.mockReturnValue(true);
  mockSendEmail.mockResolvedValue(undefined);
  mockPrisma.notificationLog.findUnique.mockResolvedValue(null);
  mockPrisma.notificationLog.create.mockResolvedValue({ id: "nl-1" });
});

describe("Cron Counsellor SLA Breach", () => {
  it("returns 403 without valid cron secret", async () => {
    mockVerifyCronSecret.mockReturnValue(false);
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(403);
  });

  it("returns 0 notified when no breaches found", async () => {
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([]);
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ breaches: 0, notified: 0 });
  });

  it("sends email and logs notification for each breach", async () => {
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([breachedEscalation()]);

    const res = await POST(makeReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ breaches: 1, notified: 1 });
    expect(mockSendEmail).toHaveBeenCalledWith(
      "alice@x.com",
      expect.stringContaining("TKT-1"),
      expect.stringContaining("Alpha"),
    );
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: {
        societyId: "soc-1",
        templateKey: "counsellor-sla-breach",
        periodKey: "e-1",
      },
    });
  });

  it("skips notification when notificationLog entry already exists", async () => {
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([breachedEscalation()]);
    mockPrisma.notificationLog.findUnique.mockResolvedValue({ id: "already" });

    const res = await POST(makeReq() as never);
    const body = await res.json();
    expect(body.notified).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it("skips breach rows with null slaDeadline defensively", async () => {
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([
      breachedEscalation({ slaDeadline: null }),
    ]);
    const res = await POST(makeReq() as never);
    const body = await res.json();
    expect(body.notified).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected DB error", async () => {
    mockPrisma.residentTicketEscalation.findMany.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(500);
  });
});
