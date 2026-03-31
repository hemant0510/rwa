import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockGetSubscriptionReminderEmailHtml = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/subscription", () => ({
  getSubscriptionReminderEmailHtml: mockGetSubscriptionReminderEmailHtml,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/v1/super-admin/billing/send-reminder/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const mockSociety = { id: "soc-1", name: "Eden Estate" };
const mockAdmin = { email: "admin@eden.com" };

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/billing/send-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/super-admin/billing/send-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.user.findMany.mockResolvedValue([mockAdmin]);
    mockSendEmail.mockResolvedValue(undefined);
    mockGetSubscriptionReminderEmailHtml.mockReturnValue("<html>email</html>");
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "expiry-reminder",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and sends reminder for expiry-reminder template", async () => {
    const res = await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "expiry-reminder",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 200 for overdue-reminder template", async () => {
    const res = await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "overdue-reminder",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "admin@eden.com",
      "Subscription Payment Overdue",
      expect.any(String),
    );
  });

  it("returns 200 for trial-ending template", async () => {
    const res = await POST(
      makeReq({ societyId: "00000000-0000-4000-8000-000000000001", templateKey: "trial-ending" }),
    );
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "admin@eden.com",
      "Your Trial Is Ending Soon",
      expect.any(String),
    );
  });

  it("logs audit entry on success", async () => {
    await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "expiry-reminder",
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_REMINDER_SENT",
        userId: "sa-1",
        entityType: "Society",
      }),
    );
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "expiry-reminder",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when no RWA admin email found for society", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "expiry-reminder",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid templateKey", async () => {
    const res = await POST(
      makeReq({ societyId: "00000000-0000-4000-8000-000000000001", templateKey: "unknown-key" }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid societyId (not uuid)", async () => {
    const res = await POST(makeReq({ societyId: "not-a-uuid", templateKey: "expiry-reminder" }));
    expect(res.status).toBe(422);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB crash"));

    const res = await POST(
      makeReq({
        societyId: "00000000-0000-4000-8000-000000000001",
        templateKey: "expiry-reminder",
      }),
    );
    expect(res.status).toBe(500);
  });
});
