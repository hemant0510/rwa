import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  feePayment: { findMany: vi.fn() },
  communityEvent: { findMany: vi.fn() },
  petition: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/super-admin/search/route";

const mockSAContext = {
  data: {
    superAdminId: "sa-1",
    authUserId: "auth-sa-1",
    email: "sa@rwa.com",
  },
  error: null,
};

function makeRequest(q = "") {
  return new Request(`http://localhost/api/v1/super-admin/search?q=${encodeURIComponent(q)}`);
}

describe("GET /api/v1/super-admin/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.society.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.feePayment.findMany.mockResolvedValue([]);
    mockPrisma.communityEvent.findMany.mockResolvedValue([]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ error: { code: "FORBIDDEN", message: "Super admin access required" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET(makeRequest("eden") as never);
    expect(res.status).toBe(403);
  });

  it("returns empty results for empty query", async () => {
    const res = await GET(makeRequest("") as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.societies).toEqual([]);
    expect(body.residents).toEqual([]);
    expect(body.payments).toEqual([]);
    expect(body.events).toEqual([]);
    expect(body.petitions).toEqual([]);
    // Should not hit Prisma when query is empty
    expect(mockPrisma.society.findMany).not.toHaveBeenCalled();
  });

  it("returns empty results for whitespace-only query", async () => {
    const res = await GET(makeRequest("   ") as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.societies).toEqual([]);
    expect(mockPrisma.society.findMany).not.toHaveBeenCalled();
  });

  it('search "Eden" returns matching society and residents', async () => {
    mockPrisma.society.findMany.mockResolvedValue([
      {
        id: "soc-1",
        name: "Eden Estate",
        societyCode: "EDEN01",
        status: "ACTIVE",
        city: "Gurgaon",
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u-1",
        name: "Eden Resident",
        email: "eden@test.com",
        status: "ACTIVE",
        societyId: "soc-1",
        society: { name: "Eden Estate" },
      },
    ]);

    const res = await GET(makeRequest("Eden") as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.societies).toHaveLength(1);
    expect(body.societies[0].name).toBe("Eden Estate");
    expect(body.residents).toHaveLength(1);
    expect(body.residents[0].name).toBe("Eden Resident");
  });

  it("search by phone number returns matching residents", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u-2",
        name: "John Doe",
        email: "john@test.com",
        status: "ACTIVE",
        societyId: "soc-1",
        society: { name: "Eden Estate" },
      },
    ]);

    const res = await GET(makeRequest("9876") as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.residents).toHaveLength(1);
    expect(body.residents[0].name).toBe("John Doe");
  });

  it("search by reference number returns matching payment", async () => {
    mockPrisma.feePayment.findMany.mockResolvedValue([
      {
        id: "pay-1",
        amount: 5000,
        receiptNo: "REC-001",
        referenceNo: "REF-123",
        paymentDate: "2026-03-15",
        societyId: "soc-1",
        user: { name: "John Doe" },
        society: { name: "Eden Estate" },
      },
    ]);

    const res = await GET(makeRequest("REF-123") as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.payments).toHaveLength(1);
    expect(body.payments[0].receiptNo).toBe("REC-001");
  });

  it("returns max 5 results per category (enforced by take: 5)", async () => {
    // Mock returning exactly 5 items (the max take)
    const fiveSocieties = Array.from({ length: 5 }, (_, i) => ({
      id: `soc-${i}`,
      name: `Society ${i}`,
      societyCode: `SOC${i}`,
      status: "ACTIVE",
      city: "Test",
    }));
    mockPrisma.society.findMany.mockResolvedValue(fiveSocieties);

    const res = await GET(makeRequest("Society") as never);
    const body = await res.json();
    expect(body.societies).toHaveLength(5);

    // Verify findMany was called with take: 5
    expect(mockPrisma.society.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(mockPrisma.feePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it("searches events by title", async () => {
    mockPrisma.communityEvent.findMany.mockResolvedValue([
      {
        id: "ev-1",
        title: "Holi Celebration",
        status: "PUBLISHED",
        societyId: "soc-1",
        society: { name: "Eden Estate" },
      },
    ]);

    const res = await GET(makeRequest("Holi") as never);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].title).toBe("Holi Celebration");
  });

  it("searches petitions by title", async () => {
    mockPrisma.petition.findMany.mockResolvedValue([
      {
        id: "pet-1",
        title: "Speed breaker needed",
        status: "PUBLISHED",
        societyId: "soc-1",
        society: { name: "Eden Estate" },
      },
    ]);

    const res = await GET(makeRequest("speed breaker") as never);
    const body = await res.json();
    expect(body.petitions).toHaveLength(1);
    expect(body.petitions[0].title).toBe("Speed breaker needed");
  });

  it("runs all queries in parallel via Promise.all", async () => {
    const res = await GET(makeRequest("test") as never);
    expect(res.status).toBe(200);

    // All 5 Prisma queries should have been called
    expect(mockPrisma.society.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.feePayment.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.petition.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not call Prisma when auth fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    await GET(makeRequest("test") as never);
    expect(mockPrisma.society.findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.society.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(makeRequest("test") as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("handles missing q param gracefully", async () => {
    const req = new Request("http://localhost/api/v1/super-admin/search");
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.societies).toEqual([]);
  });

  it("searches societies by city", async () => {
    mockPrisma.society.findMany.mockResolvedValue([
      {
        id: "soc-1",
        name: "Eden Estate",
        societyCode: "EDEN01",
        status: "ACTIVE",
        city: "Gurgaon",
      },
    ]);

    const res = await GET(makeRequest("Gurgaon") as never);
    const body = await res.json();
    expect(body.societies).toHaveLength(1);
  });
});
