import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  membershipFee: { updateMany: vi.fn() },
}));

const mockVerifyCronSecret = vi.hoisted(() => vi.fn().mockReturnValue(true));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mockVerifyCronSecret }));

import { POST } from "@/app/api/cron/fee-status-activate/route";

function makeReq() {
  return new NextRequest("http://localhost/api/cron/fee-status-activate", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("POST /api/cron/fee-status-activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(true);
    mockPrisma.membershipFee.updateMany.mockResolvedValue({ count: 3 });
  });

  it("returns 403 when cron secret is invalid", async () => {
    mockVerifyCronSecret.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });

  it("updates NOT_YET_DUE fees to PENDING", async () => {
    await POST(makeReq());
    expect(mockPrisma.membershipFee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "NOT_YET_DUE" }),
        data: { status: "PENDING" },
      }),
    );
  });

  it("filters by sessionStart <= today", async () => {
    await POST(makeReq());
    expect(mockPrisma.membershipFee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionStart: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("returns count of activated fees", async () => {
    mockPrisma.membershipFee.updateMany.mockResolvedValue({ count: 5 });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activated).toBe(5);
  });

  it("returns 0 when no fees to activate", async () => {
    mockPrisma.membershipFee.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.activated).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.membershipFee.updateMany.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});
