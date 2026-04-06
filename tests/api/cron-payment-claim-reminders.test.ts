import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockSend24h, mockSend48h, mockVerifyCronSecret } = vi.hoisted(() => ({
  mockPrisma: {
    paymentClaim: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
  },
  mockSend24h: vi.fn(),
  mockSend48h: vi.fn(),
  mockVerifyCronSecret: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/whatsapp", () => ({
  sendAdminClaimReminder24h: mockSend24h,
  sendAdminClaimReminder48h: mockSend48h,
}));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mockVerifyCronSecret }));

import { POST } from "@/app/api/cron/payment-claim-reminders/route";

function makeRequest(authorized = true): Request {
  return new Request("http://localhost/api/cron/payment-claim-reminders", {
    method: "POST",
    headers: authorized ? { authorization: "Bearer test-secret" } : {},
  });
}

describe("POST /api/cron/payment-claim-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(true);
    mockPrisma.paymentClaim.findMany.mockResolvedValue([]);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockSend24h.mockResolvedValue({ success: true });
    mockSend48h.mockResolvedValue({ success: true });
  });

  // --- Auth ---

  it("returns 403 when cron secret is invalid", async () => {
    mockVerifyCronSecret.mockReturnValue(false);
    const res = await POST(makeRequest(false) as never);
    expect(res.status).toBe(403);
  });

  it("proceeds when cron secret is valid", async () => {
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(200);
  });

  // --- No pending claims ---

  it("returns notified24h: 0 and notified48h: 0 when no pending claims", async () => {
    mockPrisma.paymentClaim.findMany.mockResolvedValue([]);
    const res = await POST(makeRequest() as never);
    const body = await res.json();
    expect(body.notified24h).toBe(0);
    expect(body.notified48h).toBe(0);
  });

  it("does not call sendAdminClaimReminder24h when no 24h claims", async () => {
    mockPrisma.paymentClaim.findMany.mockResolvedValue([]);
    await POST(makeRequest() as never);
    expect(mockSend24h).not.toHaveBeenCalled();
  });

  // --- 24h reminders ---

  it("sends 24h reminder when admin has mobile", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([{ societyId: "soc-1" }]) // 24h batch
      .mockResolvedValueOnce([]); // 48h batch
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: "9876543210" });

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend24h).toHaveBeenCalledWith("9876543210", "1");
    expect(body.notified24h).toBe(1);
  });

  it("groups multiple 24h claims from same society into one notification", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([
        { societyId: "soc-1" },
        { societyId: "soc-1" },
        { societyId: "soc-1" },
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: "9876543210" });

    await POST(makeRequest() as never);

    expect(mockSend24h).toHaveBeenCalledTimes(1);
    expect(mockSend24h).toHaveBeenCalledWith("9876543210", "3");
  });

  it("sends separate 24h notifications for different societies", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([{ societyId: "soc-1" }, { societyId: "soc-2" }])
      .mockResolvedValueOnce([]);
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ mobile: "9876543210" })
      .mockResolvedValueOnce({ mobile: "9876543211" });

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend24h).toHaveBeenCalledTimes(2);
    expect(body.notified24h).toBe(2);
  });

  it("skips 24h notification when admin has no mobile", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([{ societyId: "soc-1" }])
      .mockResolvedValueOnce([]);
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: null });

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend24h).not.toHaveBeenCalled();
    expect(body.notified24h).toBe(0);
  });

  it("skips 24h notification when no admin found for society", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([{ societyId: "soc-1" }])
      .mockResolvedValueOnce([]);
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend24h).not.toHaveBeenCalled();
    expect(body.notified24h).toBe(0);
  });

  // --- 48h reminders ---

  it("sends 48h reminder when admin has mobile", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([]) // 24h batch
      .mockResolvedValueOnce([{ societyId: "soc-1" }]); // 48h batch
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: "9876543210" });

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend48h).toHaveBeenCalledWith("9876543210", "1");
    expect(body.notified48h).toBe(1);
  });

  it("groups multiple 48h claims from same society into one notification", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ societyId: "soc-1" }, { societyId: "soc-1" }]);
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: "9876543210" });

    await POST(makeRequest() as never);

    expect(mockSend48h).toHaveBeenCalledTimes(1);
    expect(mockSend48h).toHaveBeenCalledWith("9876543210", "2");
  });

  it("skips 48h notification when admin has no mobile", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ societyId: "soc-1" }]);
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: null });

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend48h).not.toHaveBeenCalled();
    expect(body.notified48h).toBe(0);
  });

  // --- Both batches ---

  it("handles both 24h and 48h batches in the same run", async () => {
    mockPrisma.paymentClaim.findMany
      .mockResolvedValueOnce([{ societyId: "soc-1" }])
      .mockResolvedValueOnce([{ societyId: "soc-2" }]);
    mockPrisma.user.findFirst.mockResolvedValue({ mobile: "9876543210" });

    const res = await POST(makeRequest() as never);
    const body = await res.json();

    expect(mockSend24h).toHaveBeenCalledTimes(1);
    expect(mockSend48h).toHaveBeenCalledTimes(1);
    expect(body.notified24h).toBe(1);
    expect(body.notified48h).toBe(1);
  });

  // --- Error handling ---

  it("returns 500 when prisma throws", async () => {
    mockPrisma.paymentClaim.findMany.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(500);
  });
});
