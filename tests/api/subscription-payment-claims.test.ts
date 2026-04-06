import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));

// eslint-disable-next-line import/order
import { mockPrisma } from "../__mocks__/prisma";

import {
  GET as adminGet,
  POST as adminPost,
} from "@/app/api/v1/societies/[id]/subscription-payment-claims/route";
import { PATCH as rejectPatch } from "@/app/api/v1/super-admin/subscription-payment-claims/[claimId]/reject/route";
import { PATCH as verifyPatch } from "@/app/api/v1/super-admin/subscription-payment-claims/[claimId]/verify/route";
import { GET as pendingCountGet } from "@/app/api/v1/super-admin/subscription-payment-claims/pending-count/route";
import { GET as saGet } from "@/app/api/v1/super-admin/subscription-payment-claims/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCIETY_ID = "soc-uuid-1";
const ADMIN_ID = "admin-uuid-1";
const CLAIM_ID = "claim-uuid-1";
const SUB_ID = "sub-uuid-1";

const mockAdmin = {
  userId: ADMIN_ID,
  authUserId: "auth-1",
  societyId: SOCIETY_ID,
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const SA_CONTEXT = {
  superAdminId: "sa-uuid-1",
  authUserId: "auth-sa-1",
  email: "sa@example.com",
};

const today = new Date().toISOString().split("T")[0];

const validClaimBody = {
  amount: 1799,
  utrNumber: "UTR428756123456",
  paymentDate: today,
  periodStart: "2026-04-01",
  periodEnd: "2026-05-01",
};

const mockSubscription = {
  id: SUB_ID,
  societyId: SOCIETY_ID,
  status: "ACTIVE",
  createdAt: new Date(),
};

const mockClaim = {
  id: CLAIM_ID,
  societyId: SOCIETY_ID,
  subscriptionId: SUB_ID,
  amount: 1799,
  utrNumber: "UTR428756123456",
  paymentDate: new Date(today),
  status: "PENDING",
  periodStart: new Date("2026-04-01"),
  periodEnd: new Date("2026-05-01"),
  society: { name: "Eden Estate", societyCode: "EE" },
  subscription: { planId: "plan-1" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminParams(id = SOCIETY_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeClaimParams(claimId = CLAIM_ID) {
  return { params: Promise.resolve({ claimId }) };
}

function makeJsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
  mockRequireSuperAdmin.mockResolvedValue({ data: SA_CONTEXT, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// Admin Submit Routes (POST/GET /societies/[id]/subscription-payment-claims)
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /societies/[id]/subscription-payment-claims", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "GET",
    );
    const res = await adminGet(req, makeAdminParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 for society mismatch", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "GET",
    );
    const res = await adminGet(req, makeAdminParams());
    expect(res.status).toBe(401);
  });

  it("returns 200 with claims list", async () => {
    mockPrisma.subscriptionPaymentClaim.findMany.mockResolvedValue([mockClaim]);
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "GET",
    );
    const res = await adminGet(req, makeAdminParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claims).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.subscriptionPaymentClaim.findMany.mockRejectedValue(new Error("DB error"));
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "GET",
    );
    const res = await adminGet(req, makeAdminParams());
    expect(res.status).toBe(500);
  });
});

describe("POST /societies/[id]/subscription-payment-claims", () => {
  beforeEach(() => {
    mockPrisma.societySubscription.findFirst.mockResolvedValue(mockSubscription);
    mockPrisma.subscriptionPaymentClaim.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptionPaymentClaim.create.mockResolvedValue({
      id: "new-claim",
      ...validClaimBody,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(401);
  });

  it("returns 422 on invalid body", async () => {
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      {},
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when UTR too short", async () => {
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      { ...validClaimBody, utrNumber: "SHORT" },
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(422);
  });

  it("returns 400 when no active subscription", async () => {
    mockPrisma.societySubscription.findFirst.mockResolvedValue(null);
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("NO_ACTIVE_SUBSCRIPTION");
  });

  it("returns 409 when UTR is duplicate", async () => {
    mockPrisma.subscriptionPaymentClaim.findFirst.mockResolvedValueOnce({
      id: "existing",
      utrNumber: "UTR428756123456",
    }); // UTR check
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("UTR_DUPLICATE");
  });

  it("returns 400 when pending claim already exists", async () => {
    mockPrisma.subscriptionPaymentClaim.findFirst
      .mockResolvedValueOnce(null) // UTR check
      .mockResolvedValueOnce({ id: "existing-pending", status: "PENDING" }); // pending check
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("CLAIM_ALREADY_PENDING");
  });

  it("returns 201 with claim on success", async () => {
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.claim).toBeDefined();
  });

  it("stores UTR as uppercase", async () => {
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      {
        ...validClaimBody,
        utrNumber: "utr428756abcdef",
      },
    );
    await adminPost(req, makeAdminParams());
    expect(mockPrisma.subscriptionPaymentClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ utrNumber: "UTR428756ABCDEF" }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.subscriptionPaymentClaim.create.mockRejectedValue(new Error("DB error"));
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(500);
  });

  it("returns 401 for society mismatch", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });
    const req = makeJsonRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      "POST",
      validClaimBody,
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(401);
  });

  it("returns 500 on invalid JSON body", async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      },
    );
    const res = await adminPost(req, makeAdminParams());
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SA Routes
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /super-admin/subscription-payment-claims", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });
    const req = new NextRequest("http://localhost/api/v1/super-admin/subscription-payment-claims");
    const res = await saGet(req);
    expect(res.status).toBe(401);
  });

  it("returns paginated claims", async () => {
    mockPrisma.subscriptionPaymentClaim.findMany.mockResolvedValue([mockClaim]);
    mockPrisma.subscriptionPaymentClaim.count.mockResolvedValue(1);
    const req = new NextRequest("http://localhost/api/v1/super-admin/subscription-payment-claims");
    const res = await saGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claims).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("filters by status", async () => {
    mockPrisma.subscriptionPaymentClaim.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionPaymentClaim.count.mockResolvedValue(0);
    const req = new NextRequest(
      "http://localhost/api/v1/super-admin/subscription-payment-claims?status=PENDING",
    );
    await saGet(req);
    expect(mockPrisma.subscriptionPaymentClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } }),
    );
  });

  it("respects page and pageSize params", async () => {
    mockPrisma.subscriptionPaymentClaim.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionPaymentClaim.count.mockResolvedValue(0);
    const req = new NextRequest(
      "http://localhost/api/v1/super-admin/subscription-payment-claims?page=2&pageSize=10",
    );
    const res = await saGet(req);
    const data = await res.json();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(10);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.subscriptionPaymentClaim.findMany.mockRejectedValue(new Error("DB error"));
    const req = new NextRequest("http://localhost/api/v1/super-admin/subscription-payment-claims");
    const res = await saGet(req);
    expect(res.status).toBe(500);
  });
});

describe("GET /super-admin/subscription-payment-claims/pending-count", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });
    const res = await pendingCountGet();
    expect(res.status).toBe(401);
  });

  it("returns pending count", async () => {
    mockPrisma.subscriptionPaymentClaim.count.mockResolvedValue(5);
    const res = await pendingCountGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(5);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.subscriptionPaymentClaim.count.mockRejectedValue(new Error("DB error"));
    const res = await pendingCountGet();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /super-admin/subscription-payment-claims/[claimId]/verify", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });
    const req = new Request("http://localhost", { method: "PATCH" });
    const res = await verifyPatch(req, makeClaimParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when claim not found", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost", { method: "PATCH" });
    const res = await verifyPatch(req, makeClaimParams());
    expect(res.status).toBe(404);
  });

  it("returns 409 when claim already processed", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      status: "VERIFIED",
    });
    const req = new Request("http://localhost", { method: "PATCH" });
    const res = await verifyPatch(req, makeClaimParams());
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("CLAIM_ALREADY_PROCESSED");
  });

  it("returns 400 when period dates missing", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      periodStart: null,
      periodEnd: null,
    });
    const req = new Request("http://localhost", { method: "PATCH" });
    const res = await verifyPatch(req, makeClaimParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("PERIOD_REQUIRED");
  });

  it("returns 200 and creates subscription payment on success", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockResolvedValue({
      ...mockClaim,
      status: "VERIFIED",
    });
    mockPrisma.subscriptionPayment.count.mockResolvedValue(10);
    mockPrisma.subscriptionPayment.create.mockResolvedValue({});
    mockPrisma.societySubscription.update.mockResolvedValue({});
    mockPrisma.societySubscriptionHistory.create.mockResolvedValue({});

    const req = new Request("http://localhost", { method: "PATCH" });
    const res = await verifyPatch(req, makeClaimParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claim.status).toBe("VERIFIED");
  });

  it("creates SubscriptionPayment with UPI mode", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockResolvedValue({
      ...mockClaim,
      status: "VERIFIED",
    });
    mockPrisma.subscriptionPayment.count.mockResolvedValue(0);
    mockPrisma.subscriptionPayment.create.mockResolvedValue({});
    mockPrisma.societySubscription.update.mockResolvedValue({});
    mockPrisma.societySubscriptionHistory.create.mockResolvedValue({});

    const req = new Request("http://localhost", { method: "PATCH" });
    await verifyPatch(req, makeClaimParams());

    expect(mockPrisma.subscriptionPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMode: "UPI",
          referenceNo: "UTR428756123456",
        }),
      }),
    );
  });

  it("extends subscription period to claim.periodEnd", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockResolvedValue({
      ...mockClaim,
      status: "VERIFIED",
    });
    mockPrisma.subscriptionPayment.count.mockResolvedValue(0);
    mockPrisma.subscriptionPayment.create.mockResolvedValue({});
    mockPrisma.societySubscription.update.mockResolvedValue({});
    mockPrisma.societySubscriptionHistory.create.mockResolvedValue({});

    const req = new Request("http://localhost", { method: "PATCH" });
    await verifyPatch(req, makeClaimParams());

    expect(mockPrisma.societySubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentPeriodEnd: mockClaim.periodEnd },
      }),
    );
  });

  it("creates SocietySubscriptionHistory with PAYMENT_RECORDED", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockResolvedValue({
      ...mockClaim,
      status: "VERIFIED",
    });
    mockPrisma.subscriptionPayment.count.mockResolvedValue(0);
    mockPrisma.subscriptionPayment.create.mockResolvedValue({});
    mockPrisma.societySubscription.update.mockResolvedValue({});
    mockPrisma.societySubscriptionHistory.create.mockResolvedValue({});

    const req = new Request("http://localhost", { method: "PATCH" });
    await verifyPatch(req, makeClaimParams());

    expect(mockPrisma.societySubscriptionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: "PAYMENT_RECORDED",
          subscriptionId: SUB_ID,
        }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockRejectedValue(new Error("TX error"));
    const req = new Request("http://localhost", { method: "PATCH" });
    const res = await verifyPatch(req, makeClaimParams());
    expect(res.status).toBe(500);
  });
});

describe("PATCH /super-admin/subscription-payment-claims/[claimId]/reject", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "UTR not matching bank records" }),
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(401);
  });

  it("returns 422 when rejection reason too short", async () => {
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "short" }),
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when claim not found", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "UTR not matching bank records" }),
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(404);
  });

  it("returns 409 when claim already processed", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      status: "REJECTED",
    });
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "UTR not matching bank records" }),
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(409);
  });

  it("returns 200 with rejected claim on success", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockResolvedValue({
      ...mockClaim,
      status: "REJECTED",
      rejectionReason: "UTR not matching bank records",
    });
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "UTR not matching bank records" }),
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claim.status).toBe("REJECTED");
  });

  it("stores rejection reason", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockResolvedValue({});
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "UTR not matching bank records" }),
    });
    await rejectPatch(req, makeClaimParams());

    expect(mockPrisma.subscriptionPaymentClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "UTR not matching bank records",
        }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.subscriptionPaymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.subscriptionPaymentClaim.update.mockRejectedValue(new Error("DB error"));
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: "UTR not matching bank records" }),
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 on invalid JSON body", async () => {
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    const res = await rejectPatch(req, makeClaimParams());
    expect(res.status).toBe(500);
  });
});
