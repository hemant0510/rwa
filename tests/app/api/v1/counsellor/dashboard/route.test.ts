import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { findUnique: vi.fn() },
  counsellorSocietyAssignment: { findMany: vi.fn() },
  residentTicketEscalation: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/dashboard/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

const society = (id: string, name: string) => ({
  id,
  name,
  societyCode: id.toUpperCase().slice(0, 6),
  city: "Pune",
  state: "MH",
  totalUnits: 100,
  _count: { users: 42 },
});

describe("GET /api/v1/counsellor/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(authedContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      name: "Counsellor",
      email: "c@x.com",
      photoUrl: null,
    });
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([
      { isPrimary: true, society: society("s-1", "Alpha") },
      { isPrimary: false, society: society("s-2", "Beta") },
    ]);
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([
      { status: "PENDING", ticket: { societyId: "s-1" } },
      { status: "ACKNOWLEDGED", ticket: { societyId: "s-1" } },
      { status: "REVIEWING", ticket: { societyId: "s-2" } },
    ]);
  });

  it("returns 403 when guard rejects", async () => {
    const res403 = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: res403 });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("aggregates totals and per-society open escalation counts", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.counsellor.id).toBe("c-1");
    expect(body.totals).toEqual({
      societies: 2,
      residents: 84,
      openEscalations: 3,
      pendingAck: 1,
    });
    expect(body.societies).toHaveLength(2);
    const s1 = body.societies.find((s: { id: string }) => s.id === "s-1");
    expect(s1.openEscalations).toBe(2);
    expect(s1.isPrimary).toBe(true);
    const s2 = body.societies.find((s: { id: string }) => s.id === "s-2");
    expect(s2.openEscalations).toBe(1);
  });

  it("returns zeros when counsellor has no assignments or escalations", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toEqual({
      societies: 0,
      residents: 0,
      openEscalations: 0,
      pendingAck: 0,
    });
    expect(body.societies).toEqual([]);
  });

  it("shows 0 open escalations for assigned societies with no open escalations", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([
      { isPrimary: true, society: society("s-1", "Alpha") },
    ]);
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body.societies[0].openEscalations).toBe(0);
  });

  it("returns 500 when prisma throws", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
