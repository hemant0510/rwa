import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockGetSubscriptionReminderEmailHtml = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/subscription", () => ({
  getSubscriptionReminderEmailHtml: mockGetSubscriptionReminderEmailHtml,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/v1/super-admin/billing/send-bulk-reminders/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const SOC_ID_1 = "00000000-0000-4000-8000-000000000001";
const SOC_ID_2 = "00000000-0000-4000-8000-000000000002";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/billing/send-bulk-reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/super-admin/billing/send-bulk-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
    mockPrisma.society.findMany.mockResolvedValue([
      { id: SOC_ID_1, name: "Eden Estate" },
      { id: SOC_ID_2, name: "Green Park" },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { email: "admin1@eden.com", societyId: SOC_ID_1 },
      { email: "admin2@green.com", societyId: SOC_ID_2 },
    ]);
    mockSendEmail.mockResolvedValue(undefined);
    mockGetSubscriptionReminderEmailHtml.mockReturnValue("<html>email</html>");
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await POST(makeReq({ societyIds: [SOC_ID_1], templateKey: "expiry-reminder" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 and sends reminders to all admins", async () => {
    const res = await POST(
      makeReq({ societyIds: [SOC_ID_1, SOC_ID_2], templateKey: "expiry-reminder" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(body.failed).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it("reports partial failures when some emails fail", async () => {
    mockSendEmail.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("SMTP error"));

    const res = await POST(
      makeReq({ societyIds: [SOC_ID_1, SOC_ID_2], templateKey: "overdue-reminder" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
  });

  it("logs audit entry on success", async () => {
    await POST(makeReq({ societyIds: [SOC_ID_1], templateKey: "trial-ending" }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_BULK_REMINDERS_SENT",
        userId: "sa-1",
        entityType: "Society",
      }),
    );
  });

  it("returns 422 for empty societyIds array", async () => {
    const res = await POST(makeReq({ societyIds: [], templateKey: "expiry-reminder" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid templateKey", async () => {
    const res = await POST(makeReq({ societyIds: [SOC_ID_1], templateKey: "bad-key" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for non-uuid societyId", async () => {
    const res = await POST(makeReq({ societyIds: ["not-a-uuid"], templateKey: "expiry-reminder" }));
    expect(res.status).toBe(422);
  });

  it("returns 200 with 0 sent when no admins found", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await POST(makeReq({ societyIds: [SOC_ID_1], templateKey: "expiry-reminder" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(0);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockPrisma.society.findMany.mockRejectedValue(new Error("DB crash"));

    const res = await POST(makeReq({ societyIds: [SOC_ID_1], templateKey: "expiry-reminder" }));
    expect(res.status).toBe(500);
  });
});
