import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  membershipFee: { updateMany: vi.fn() },
}));

const mockVerifyCronSecret = vi.hoisted(() => vi.fn().mockReturnValue(true));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mockVerifyCronSecret }));

import { POST } from "@/app/api/cron/fee-overdue-check/route";

function makeReq() {
  return new NextRequest("http://localhost/api/cron/fee-overdue-check", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("POST /api/cron/fee-overdue-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(true);
    mockPrisma.membershipFee.updateMany.mockResolvedValue({ count: 2 });
  });

  it("returns 403 when cron secret is invalid", async () => {
    mockVerifyCronSecret.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });

  it("updates PENDING fees past grace period to OVERDUE", async () => {
    await POST(makeReq());
    expect(mockPrisma.membershipFee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
        data: { status: "OVERDUE" },
      }),
    );
  });

  it("filters by gracePeriodEnd < today", async () => {
    await POST(makeReq());
    expect(mockPrisma.membershipFee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gracePeriodEnd: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it("returns count of overdue fees marked", async () => {
    mockPrisma.membershipFee.updateMany.mockResolvedValue({ count: 7 });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.markedOverdue).toBe(7);
  });

  it("returns 0 when no fees to mark overdue", async () => {
    mockPrisma.membershipFee.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.markedOverdue).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.membershipFee.updateMany.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});
