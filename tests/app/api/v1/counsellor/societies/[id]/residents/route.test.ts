import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockAssertAccess = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/counsellor/access", () => ({ assertCounsellorSocietyAccess: mockAssertAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/societies/[id]/residents/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

const makeReq = (url = "http://localhost/api/v1/counsellor/societies/s-1/residents") =>
  new Request(url) as never;
const params = { params: Promise.resolve({ id: "s-1" }) };

const row = {
  id: "u-1",
  name: "Asha",
  email: "asha@x.com",
  mobile: "+91 9876543210",
  photoUrl: null,
  status: "ACTIVE_PAID",
  role: "RESIDENT",
  ownershipType: "OWNER",
  userUnits: [{ unit: { displayLabel: "A-101" } }],
};

describe("GET /api/v1/counsellor/societies/[id]/residents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(authedContext);
    mockAssertAccess.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([row]);
    mockPrisma.user.count.mockResolvedValue(1);
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

  it("returns residents with unit label and defaults", async () => {
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.residents[0]).toMatchObject({ id: "u-1", unitLabel: "A-101" });
  });

  it("returns null unitLabel when resident has no primary active unit", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ ...row, userUnits: [] }]);
    const res = await GET(makeReq(), params);
    const body = await res.json();
    expect(body.residents[0].unitLabel).toBeNull();
  });

  it("applies search filter and pagination", async () => {
    const res = await GET(
      makeReq(
        "http://localhost/api/v1/counsellor/societies/s-1/residents?search=asha&page=2&pageSize=10",
      ),
      params,
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: "s-1",
          role: "RESIDENT",
          OR: expect.any(Array),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it("clamps invalid pagination inputs", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/counsellor/societies/s-1/residents?page=0&pageSize=500"),
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(100);
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(500);
  });
});
