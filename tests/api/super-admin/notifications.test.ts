import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  societySubscription: { findMany: vi.fn() },
  subscriptionInvoice: { findMany: vi.fn() },
  society: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/notifications/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const now = new Date("2026-04-01T12:00:00Z");

// Trial subscription expiring in 2 days
const trialExpiringSub = {
  id: "sub-trial-1",
  status: "TRIAL",
  currentPeriodEnd: new Date("2026-04-03T12:00:00Z"),
  createdAt: new Date("2026-03-01T12:00:00Z"),
  society: { id: "soc-1", name: "Trial Society" },
};

// Expired subscription (15 days ago)
const expiredSub = {
  id: "sub-exp-1",
  status: "EXPIRED",
  currentPeriodEnd: new Date("2026-03-17T12:00:00Z"),
  createdAt: new Date("2026-01-01T12:00:00Z"),
  society: { id: "soc-2", name: "Expired Society" },
};

// Overdue invoice
const overdueInvoice = {
  id: "inv-1",
  invoiceNo: "INV-2026-001",
  status: "OVERDUE",
  dueDate: new Date("2026-03-15T12:00:00Z"),
  society: { id: "soc-3", name: "Overdue Society" },
};

// Recently registered society (3 days ago)
const recentSociety = {
  id: "soc-4",
  name: "New Society",
  createdAt: new Date("2026-03-29T12:00:00Z"),
};

function makeReq() {
  return new NextRequest("http://localhost/api/v1/super-admin/notifications");
}

describe("GET /api/v1/super-admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(now);
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.societySubscription.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
    mockPrisma.society.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns trials expiring within 3 days", async () => {
    mockPrisma.societySubscription.findMany.mockImplementation(
      (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "TRIAL") return Promise.resolve([trialExpiringSub]);
        return Promise.resolve([]);
      },
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const trialAlert = body.find((a: { type: string }) => a.type === "TRIAL_EXPIRING");
    expect(trialAlert).toBeDefined();
    expect(trialAlert.societyName).toBe("Trial Society");
    expect(trialAlert.priority).toBe("HIGH");
  });

  it("returns expired subscriptions from last 30 days", async () => {
    mockPrisma.societySubscription.findMany.mockImplementation(
      (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "EXPIRED") return Promise.resolve([expiredSub]);
        return Promise.resolve([]);
      },
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const expiredAlert = body.find((a: { type: string }) => a.type === "SUBSCRIPTION_EXPIRED");
    expect(expiredAlert).toBeDefined();
    expect(expiredAlert.societyName).toBe("Expired Society");
    expect(expiredAlert.priority).toBe("HIGH");
  });

  it("returns overdue invoices", async () => {
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([overdueInvoice]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const overdueAlert = body.find((a: { type: string }) => a.type === "PAYMENT_OVERDUE");
    expect(overdueAlert).toBeDefined();
    expect(overdueAlert.societyName).toBe("Overdue Society");
    expect(overdueAlert.priority).toBe("MEDIUM");
  });

  it("returns recently registered societies (7 days)", async () => {
    mockPrisma.society.findMany.mockResolvedValue([recentSociety]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const regAlert = body.find((a: { type: string }) => a.type === "SOCIETY_REGISTERED");
    expect(regAlert).toBeDefined();
    expect(regAlert.societyName).toBe("New Society");
    expect(regAlert.priority).toBe("LOW");
  });

  it("alerts sorted by priority (HIGH first) then date desc", async () => {
    mockPrisma.societySubscription.findMany.mockImplementation(
      (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "TRIAL") return Promise.resolve([trialExpiringSub]);
        if (args?.where?.status === "EXPIRED") return Promise.resolve([expiredSub]);
        return Promise.resolve([]);
      },
    );
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([overdueInvoice]);
    mockPrisma.society.findMany.mockResolvedValue([recentSociety]);

    const res = await GET(makeReq());
    const body = await res.json();

    // HIGH alerts first
    expect(body[0].priority).toBe("HIGH");
    expect(body[1].priority).toBe("HIGH");
    // MEDIUM next
    expect(body[2].priority).toBe("MEDIUM");
    // LOW last
    expect(body[3].priority).toBe("LOW");
  });

  it("returns empty array when no alerts", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.societySubscription.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
