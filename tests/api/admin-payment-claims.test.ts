import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockGenerateReceiptNo = vi.hoisted(() => vi.fn());
const mockSendResidentPaymentConfirmed = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendResidentPaymentRejected = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: vi.fn(),
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/fee-calculator", () => ({
  generateReceiptNo: mockGenerateReceiptNo,
}));
vi.mock("@/lib/whatsapp", () => ({
  sendResidentPaymentConfirmed: mockSendResidentPaymentConfirmed,
  sendResidentPaymentRejected: mockSendResidentPaymentRejected,
}));

// eslint-disable-next-line import/order
import { mockPrisma } from "../__mocks__/prisma";

import { PATCH as rejectRoute } from "@/app/api/v1/societies/[id]/payment-claims/[claimId]/reject/route";
import { PATCH as verifyRoute } from "@/app/api/v1/societies/[id]/payment-claims/[claimId]/verify/route";
import { GET as getPendingCount } from "@/app/api/v1/societies/[id]/payment-claims/pending-count/route";
import { GET as getList } from "@/app/api/v1/societies/[id]/payment-claims/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCIETY_ID = "soc-uuid-1";
const OTHER_SOCIETY = "soc-uuid-2";
const ADMIN_ID = "admin-uuid-1";
const CLAIM_ID = "claim-uuid-1";
const FEE_ID = "fee-uuid-1";
const USER_ID = "user-uuid-1";

const mockAdmin = {
  userId: ADMIN_ID,
  authUserId: "auth-1",
  societyId: SOCIETY_ID,
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const mockClaim = {
  id: CLAIM_ID,
  societyId: SOCIETY_ID,
  userId: USER_ID,
  membershipFeeId: FEE_ID,
  claimedAmount: 2000,
  utrNumber: "UTR123456789012",
  paymentDate: new Date("2026-04-04"),
  screenshotUrl: null,
  status: "PENDING",
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  adminNotes: null,
  createdAt: new Date("2026-04-04T10:00:00Z"),
  updatedAt: new Date("2026-04-04T10:00:00Z"),
  user: { name: "Arjun Kapoor", userUnits: [{ unit: { displayLabel: "Flat 302" } }] },
  society: { societyCode: "EE" },
  membershipFee: { amountPaid: 0, amountDue: 2000 },
};

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makeParams(id = SOCIETY_ID) {
  return { params: Promise.resolve({ id }) };
}
function makeClaimParams(id = SOCIETY_ID, claimId = CLAIM_ID) {
  return { params: Promise.resolve({ id, claimId }) };
}
function makeGetRequest(url: string) {
  return new NextRequest(`http://localhost${url}`);
}
function makePatchRequest(body: unknown, url: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /payment-claims — list
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/payment-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.paymentClaim.findMany.mockResolvedValue([mockClaim]);
    mockPrisma.paymentClaim.count.mockResolvedValue(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims`),
      makeParams(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when society does not match", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: OTHER_SOCIETY });
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims`),
      makeParams(),
    );
    expect(res.status).toBe(401);
  });

  it("returns paginated list with defaults", async () => {
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims`),
      makeParams(),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claims).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(mockPrisma.paymentClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: "desc" } }),
    );
  });

  it("filters by status when provided", async () => {
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims?status=PENDING`),
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.paymentClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: SOCIETY_ID, status: "PENDING" } }),
    );
  });

  it("applies page and pageSize params", async () => {
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims?page=2&pageSize=5`),
      makeParams(),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(5);
    expect(mockPrisma.paymentClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it("maps user as undefined when claim has no user", async () => {
    mockPrisma.paymentClaim.findMany.mockResolvedValue([{ ...mockClaim, user: null }]);
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims`),
      makeParams(),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claims[0].user).toBeUndefined();
  });

  it("falls back to '—' when unit displayLabel is null", async () => {
    mockPrisma.paymentClaim.findMany.mockResolvedValue([
      {
        ...mockClaim,
        user: { name: "Test User", userUnits: [{ unit: { displayLabel: null } }] },
      },
    ]);
    const res = await getList(
      makeGetRequest(`/api/v1/societies/${SOCIETY_ID}/payment-claims`),
      makeParams(),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claims[0].user.unitNumber).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// GET /payment-claims/pending-count
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/payment-claims/pending-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.paymentClaim.count.mockResolvedValue(3);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await getPendingCount(new Request("http://localhost/"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when society does not match", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: OTHER_SOCIETY });
    const res = await getPendingCount(new Request("http://localhost/"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns pending count", async () => {
    const res = await getPendingCount(new Request("http://localhost/"), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(3);
    expect(mockPrisma.paymentClaim.count).toHaveBeenCalledWith({
      where: { societyId: SOCIETY_ID, status: "PENDING" },
    });
  });

  it("returns 0 when no pending claims", async () => {
    mockPrisma.paymentClaim.count.mockResolvedValue(0);
    const res = await getPendingCount(new Request("http://localhost/"), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PATCH /payment-claims/[claimId]/verify
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/societies/[id]/payment-claims/[claimId]/verify", () => {
  const verifiedClaim = {
    ...mockClaim,
    status: "VERIFIED",
    verifiedBy: ADMIN_ID,
    verifiedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockGenerateReceiptNo.mockReturnValue("EE-2026-R0001");
    mockPrisma.paymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.paymentClaim.update.mockResolvedValue(verifiedClaim);
    mockPrisma.feePayment.count.mockResolvedValue(0);
    mockPrisma.feePayment.create.mockResolvedValue({ id: "fp-1", receiptNo: "EE-2026-R0001" });
    mockPrisma.membershipFee.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when society does not match", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: OTHER_SOCIETY });
    const res = await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when claim not found", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue(null);
    const res = await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when claim belongs to different society", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      societyId: OTHER_SOCIETY,
    });
    const res = await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when claim already processed", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue({ ...mockClaim, status: "VERIFIED" });
    const res = await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CLAIM_ALREADY_PROCESSED");
  });

  it("verifies claim and creates FeePayment with receipt number", async () => {
    const res = await verifyRoute(
      makePatchRequest(
        { adminNotes: "Looks good" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`,
      ),
      makeClaimParams(),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receiptNo).toBe("EE-2026-R0001");
    expect(mockPrisma.paymentClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "VERIFIED",
          verifiedBy: ADMIN_ID,
          adminNotes: "Looks good",
        }),
      }),
    );
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feeId: FEE_ID,
          paymentMode: "UPI_CLAIM",
          receiptNo: "EE-2026-R0001",
          recordedBy: ADMIN_ID,
        }),
      }),
    );
  });

  it("sets user status to ACTIVE_PAID when fee fully paid", async () => {
    await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE_PAID" } }),
    );
  });

  it("sets user status to ACTIVE_PARTIAL when fee partially paid", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      claimedAmount: 1000,
      membershipFee: { amountPaid: 0, amountDue: 2000 },
    });
    await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE_PARTIAL" } }),
    );
  });

  it("returns 422 when adminNotes is not a string", async () => {
    const res = await verifyRoute(
      makePatchRequest(
        { adminNotes: 123 },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(422);
  });

  it("sends WhatsApp confirmation to resident when resident has mobile", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      user: { mobile: "9876543210" },
    });
    const res = await verifyRoute(
      makePatchRequest({}, `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`),
      makeClaimParams(),
    );
    expect(res.status).toBe(200);
    expect(mockSendResidentPaymentConfirmed).toHaveBeenCalledWith(
      "9876543210",
      expect.stringContaining("₹"),
      "EE-2026-R0001",
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /payment-claims/[claimId]/reject
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/societies/[id]/payment-claims/[claimId]/reject", () => {
  const rejectedClaim = {
    ...mockClaim,
    status: "REJECTED",
    rejectionReason: "UTR not found in bank statement",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.paymentClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.paymentClaim.update.mockResolvedValue(rejectedClaim);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "UTR not found" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when society does not match", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: OTHER_SOCIETY });
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "UTR not found in bank" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 422 when rejectionReason is too short", async () => {
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "Too short" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when claim not found", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue(null);
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "UTR not found in bank" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when claim already processed", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue({ ...mockClaim, status: "VERIFIED" });
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "UTR not found in bank" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(409);
  });

  it("rejects claim with reason", async () => {
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "UTR not found in bank statement" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.claim.status).toBe("REJECTED");
    expect(mockPrisma.paymentClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "UTR not found in bank statement",
          verifiedBy: ADMIN_ID,
        }),
      }),
    );
  });

  it("sends WhatsApp rejection to resident when resident has mobile", async () => {
    mockPrisma.paymentClaim.findUnique.mockResolvedValue({
      ...mockClaim,
      user: { mobile: "9876543210" },
    });
    const res = await rejectRoute(
      makePatchRequest(
        { rejectionReason: "UTR not found in bank statement" },
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
      ),
      makeClaimParams(),
    );
    expect(res.status).toBe(200);
    expect(mockSendResidentPaymentRejected).toHaveBeenCalledWith(
      "9876543210",
      expect.stringContaining("₹"),
      "UTR not found in bank statement",
    );
  });
});
