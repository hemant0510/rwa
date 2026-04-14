import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockAssertAccess = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  governingBodyMember: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/counsellor/access", () => ({ assertCounsellorSocietyAccess: mockAssertAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/societies/[id]/governing-body/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

const makeReq = () =>
  new Request("http://localhost/api/v1/counsellor/societies/s-1/governing-body") as never;
const params = { params: Promise.resolve({ id: "s-1" }) };

const row = {
  id: "gbm-1",
  assignedAt: new Date("2025-06-01"),
  designation: { name: "President" },
  user: {
    name: "Asha",
    email: "asha@x.com",
    mobile: "+91 9876543210",
    photoUrl: null,
  },
};

describe("GET /api/v1/counsellor/societies/[id]/governing-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(authedContext);
    mockAssertAccess.mockResolvedValue(null);
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([row]);
  });

  it("returns 403 when guard rejects", async () => {
    const res403 = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: res403 });
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(403);
  });

  it("returns 403 when access denied", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockAssertAccess.mockResolvedValue(forbidden);
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(403);
  });

  it("returns flattened governing body members", async () => {
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({
      id: "gbm-1",
      name: "Asha",
      email: "asha@x.com",
      mobile: "+91 9876543210",
      designation: "President",
      photoUrl: null,
    });
    expect(mockPrisma.governingBodyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "s-1" },
      }),
    );
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.governingBodyMember.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(500);
  });
});
