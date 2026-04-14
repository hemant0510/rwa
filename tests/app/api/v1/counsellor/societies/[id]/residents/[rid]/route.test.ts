import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockAssertAccess = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/counsellor/access", () => ({ assertCounsellorSocietyAccess: mockAssertAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/societies/[id]/residents/[rid]/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

const makeReq = () =>
  new Request("http://localhost/api/v1/counsellor/societies/s-1/residents/u-1") as never;
const params = { params: Promise.resolve({ id: "s-1", rid: "u-1" }) };

const mockResident = {
  id: "u-1",
  name: "Asha",
  email: "asha@x.com",
  mobile: "+91 9876543210",
  photoUrl: null,
  role: "RESIDENT",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  registeredAt: new Date("2025-10-01"),
  approvedAt: new Date("2025-10-05"),
  society: { id: "s-1", name: "Alpha" },
  userUnits: [
    {
      isPrimary: true,
      relationship: "OWNER",
      unit: { id: "un-1", displayLabel: "A-101", towerBlock: "A", floorNo: "1" },
    },
  ],
};

describe("GET /api/v1/counsellor/societies/[id]/residents/[rid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(authedContext);
    mockAssertAccess.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
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

  it("returns 404 when resident does not belong to the society", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(404);
  });

  it("returns resident profile with flattened units", async () => {
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("u-1");
    expect(body.units).toHaveLength(1);
    expect(body.units[0]).toMatchObject({
      id: "un-1",
      displayLabel: "A-101",
      relationship: "OWNER",
      isPrimary: true,
    });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u-1", societyId: "s-1", role: "RESIDENT" },
      }),
    );
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.user.findFirst.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(500);
  });
});
