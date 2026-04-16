import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  feeSession: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  society: { findUnique: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({
  getAdminContext: mockGetAdminContext,
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
const mockGetSessionDates = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    start: new Date("2026-04-01"),
    end: new Date("2027-03-31"),
  }),
);
const mockSafeParse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fee-calculator", () => ({ getSessionDates: mockGetSessionDates }));
vi.mock("@/lib/validations/society", () => ({
  createFeeSessionSchema: { safeParse: mockSafeParse },
}));

import { GET, POST } from "@/app/api/v1/admin/fee-sessions/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: false,
  name: "Admin",
};

const makeRequest = (societyId = "soc-1") =>
  new Request(`http://localhost/api/v1/admin/fee-sessions?societyId=${societyId}`);

describe("GET /api/v1/admin/fee-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    mockPrisma.feeSession.findMany.mockResolvedValue([]);
  });

  it("returns 403 when caller is not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 for READ_ONLY admin (not SA)", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      adminPermission: "READ_NOTIFY",
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns fee sessions for FULL_ACCESS admin", async () => {
    mockPrisma.feeSession.findMany.mockResolvedValue([
      {
        id: "fs-1",
        sessionYear: "2025-26",
        annualFee: BigInt(12000),
        joiningFee: BigInt(5000),
        sessionStart: new Date("2025-04-01"),
        sessionEnd: new Date("2026-03-31"),
        gracePeriodEnd: new Date("2025-04-30"),
        status: "ACTIVE",
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].sessionYear).toBe("2025-26");
    expect(body[0].annualFee).toBe(12000);
  });

  it("returns fee sessions for Super Admin", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
    mockPrisma.feeSession.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("scopes query to admin's societyId", async () => {
    await GET(makeRequest());
    expect(mockPrisma.feeSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.feeSession.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/v1/admin/fee-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/v1/admin/fee-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockSafeParse.mockReturnValue({ success: true, data: { year: 2026 } });
  });

  it("returns 403 when not full-access admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await POST(makePostRequest({ year: 2026 }));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid body", async () => {
    mockSafeParse.mockReturnValue({ success: false });
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(422);
  });

  it("returns 403 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await POST(makePostRequest({ year: 2026 }));
    expect(res.status).toBe(403);
  });

  it("returns 409 for duplicate session", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      gracePeriodDays: 30,
      feeSessionStartMonth: 4,
    });
    mockPrisma.feeSession.findUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(makePostRequest({ year: 2026 }));
    expect(res.status).toBe(409);
  });

  it("creates fee session successfully", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      gracePeriodDays: 30,
      feeSessionStartMonth: 4,
    });
    mockPrisma.feeSession.findUnique.mockResolvedValue(null);
    mockPrisma.feeSession.create.mockResolvedValue({
      id: "fs-new",
      sessionYear: "2026-27",
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      sessionStart: new Date("2026-04-01"),
      sessionEnd: new Date("2027-03-31"),
      gracePeriodEnd: new Date("2026-05-01"),
      status: "UPCOMING",
    });
    const res = await POST(makePostRequest({ year: 2026 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionYear).toBe("2026-27");
  });

  it("creates session with UPCOMING status when start is in the future", async () => {
    const futureStart = new Date();
    futureStart.setFullYear(futureStart.getFullYear() + 2);
    const futureEnd = new Date(futureStart);
    futureEnd.setFullYear(futureEnd.getFullYear() + 1);
    mockGetSessionDates.mockReturnValue({ start: futureStart, end: futureEnd });
    mockPrisma.society.findUnique.mockResolvedValue({
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      gracePeriodDays: 30,
      feeSessionStartMonth: 4,
    });
    mockPrisma.feeSession.findUnique.mockResolvedValue(null);
    mockPrisma.feeSession.create.mockResolvedValue({
      id: "fs-u",
      sessionYear: "2028-29",
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      sessionStart: futureStart,
      sessionEnd: futureEnd,
      gracePeriodEnd: futureStart,
      status: "UPCOMING",
    });
    const res = await POST(makePostRequest({ year: 2028 }));
    expect(res.status).toBe(201);
    expect(mockPrisma.feeSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "UPCOMING" }) }),
    );
  });

  it("creates session with COMPLETED status when end is in the past", async () => {
    const pastStart = new Date("2020-04-01");
    const pastEnd = new Date("2021-03-31");
    mockGetSessionDates.mockReturnValue({ start: pastStart, end: pastEnd });
    mockPrisma.society.findUnique.mockResolvedValue({
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      gracePeriodDays: 30,
      feeSessionStartMonth: 4,
    });
    mockPrisma.feeSession.findUnique.mockResolvedValue(null);
    mockPrisma.feeSession.create.mockResolvedValue({
      id: "fs-c",
      sessionYear: "2020-21",
      annualFee: BigInt(12000),
      joiningFee: BigInt(5000),
      sessionStart: pastStart,
      sessionEnd: pastEnd,
      gracePeriodEnd: pastStart,
      status: "COMPLETED",
    });
    const res = await POST(makePostRequest({ year: 2020 }));
    expect(res.status).toBe(201);
    expect(mockPrisma.feeSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB"));
    const res = await POST(makePostRequest({ year: 2026 }));
    expect(res.status).toBe(500);
  });
});
