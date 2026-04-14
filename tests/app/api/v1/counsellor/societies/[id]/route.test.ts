import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockAssertAccess = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  counsellorSocietyAssignment: { findFirst: vi.fn() },
  user: { count: vi.fn() },
  governingBodyMember: { count: vi.fn() },
  residentTicketEscalation: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/counsellor/access", () => ({ assertCounsellorSocietyAccess: mockAssertAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/societies/[id]/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

const makeReq = () => new Request("http://localhost/api/v1/counsellor/societies/s-1") as never;
const params = { params: Promise.resolve({ id: "s-1" }) };

describe("GET /api/v1/counsellor/societies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(authedContext);
    mockAssertAccess.mockResolvedValue(null);
    mockPrisma.society.findUnique.mockResolvedValue({
      id: "s-1",
      name: "Alpha",
      societyCode: "ALPHA",
      city: "Pune",
      state: "MH",
      pincode: "411001",
      totalUnits: 120,
      registrationNo: "REG-1",
      registrationDate: new Date("2020-01-01"),
      counsellorEscalationThreshold: 10,
      onboardingDate: new Date("2023-05-01"),
    });
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({
      assignedAt: new Date("2026-01-01"),
      isPrimary: true,
    });
    mockPrisma.user.count.mockResolvedValue(42);
    mockPrisma.governingBodyMember.count.mockResolvedValue(5);
    mockPrisma.residentTicketEscalation.count.mockResolvedValue(2);
  });

  it("returns 403 when guard rejects", async () => {
    const res403 = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: res403 });
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(403);
  });

  it("returns 403 when counsellor has no assignment to society", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockAssertAccess.mockResolvedValue(forbidden);
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(403);
  });

  it("returns society detail with counts", async () => {
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("s-1");
    expect(body.isPrimary).toBe(true);
    expect(body.counts).toEqual({
      residents: 42,
      governingBodyMembers: 5,
      openEscalations: 2,
    });
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(500);
  });
});
