import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { update: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "@/app/api/v1/counsellor/mfa-status/route";

const counsellorContext = {
  data: {
    counsellorId: "c-1",
    authUserId: "auth-1",
    email: "asha@x.com",
    name: "Asha",
    isSuperAdmin: false,
  },
  error: null,
};

function makeReq(body: unknown) {
  return new Request("http://localhost/api/v1/counsellor/mfa-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("PATCH /api/v1/counsellor/mfa-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(counsellorContext);
    mockPrisma.counsellor.update.mockResolvedValue({});
  });

  it("returns 403 when guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: forbidden });
    const res = await PATCH(makeReq({ enrolled: true }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is super admin", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: { ...counsellorContext.data, isSuperAdmin: true },
      error: null,
    });
    const res = await PATCH(makeReq({ enrolled: true }));
    expect(res.status).toBe(403);
    expect(mockPrisma.counsellor.update).not.toHaveBeenCalled();
  });

  it("returns 422 for invalid body", async () => {
    const res = await PATCH(makeReq({ enrolled: "not-a-bool" }));
    expect(res.status).toBe(422);
  });

  it("stamps mfaEnrolledAt=now when enrolled=true", async () => {
    const res = await PATCH(makeReq({ enrolled: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrolled).toBe(true);
    expect(mockPrisma.counsellor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ mfaEnrolledAt: expect.any(Date) }),
      }),
    );
  });

  it("clears mfaEnrolledAt when enrolled=false", async () => {
    const res = await PATCH(makeReq({ enrolled: false }));
    expect(res.status).toBe(200);
    expect(mockPrisma.counsellor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: { mfaEnrolledAt: null },
      }),
    );
  });

  it("returns 500 when prisma update throws", async () => {
    mockPrisma.counsellor.update.mockRejectedValue(new Error("db"));
    const res = await PATCH(makeReq({ enrolled: true }));
    expect(res.status).toBe(500);
  });
});
