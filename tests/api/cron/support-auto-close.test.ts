import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyCronSecret = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { updateMany: vi.fn() },
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mockVerifyCronSecret }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/cron/support-auto-close/route";

function makeReq() {
  return new Request("http://localhost/api/cron/support-auto-close", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("Cron Support Auto-Close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(true);
  });

  it("returns 401 without valid cron secret", async () => {
    mockVerifyCronSecret.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("closes RESOLVED requests older than 7 days", async () => {
    mockPrisma.serviceRequest.updateMany.mockResolvedValue({ count: 3 });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.closed).toBe(3);

    expect(mockPrisma.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RESOLVED",
          resolvedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: expect.objectContaining({
          status: "CLOSED",
          closedReason: expect.stringContaining("Auto-closed"),
        }),
      }),
    );
  });

  it("returns count 0 when no requests to close", async () => {
    mockPrisma.serviceRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.closed).toBe(0);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.updateMany.mockRejectedValue(new Error("DB"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});
