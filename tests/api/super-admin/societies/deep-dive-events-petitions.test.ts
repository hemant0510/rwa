import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  communityEvent: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  expense: { aggregate: vi.fn() },
  eventPayment: { aggregate: vi.fn() },
  petition: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  petitionSignature: { findMany: vi.fn() },
  society: { findUnique: vi.fn() },
}));

// Mock ReactPDF and the PetitionReportDocument — PDF generation is not under test
const mockRenderToStream = vi.hoisted(() => vi.fn());
vi.mock("@react-pdf/renderer", () => ({ default: { renderToStream: mockRenderToStream } }));
vi.mock("@/app/api/v1/societies/[id]/reports/report-document", () => ({
  PetitionReportDocument: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------
import { GET as GET_EVENT_DETAIL } from "@/app/api/v1/super-admin/societies/[id]/events/[eid]/route";
import { GET as GET_EVENTS } from "@/app/api/v1/super-admin/societies/[id]/events/route";
import { GET as GET_PETITION_REPORT } from "@/app/api/v1/super-admin/societies/[id]/petitions/[pid]/report/route";
import { GET as GET_PETITION_DETAIL } from "@/app/api/v1/super-admin/societies/[id]/petitions/[pid]/route";
import { GET as GET_PETITIONS } from "@/app/api/v1/super-admin/societies/[id]/petitions/route";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const saForbidden = {
  data: null,
  error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
};

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const mockEvent = {
  id: "event-1",
  societyId: "soc-1",
  title: "Annual Meeting",
  status: "PUBLISHED",
  category: "MEETING",
  eventDate: new Date("2026-05-01"),
  feeModel: "FREE",
  createdBy: "user-1",
  creator: { name: "Admin" },
  registrations: [],
  _count: { registrations: 5 },
};

const mockPetition = {
  id: "petition-1",
  societyId: "soc-1",
  title: "Speed Breaker Request",
  status: "PUBLISHED",
  type: "COMPLAINT",
  createdAt: new Date("2026-03-01"),
  description: "We need speed breakers",
  targetAuthority: "Municipality",
  submittedAt: new Date("2026-03-05"),
  documentUrl: null,
  minSignatures: 50,
  deadline: null,
  createdBy: "user-1",
  creator: { name: "Admin" },
  _count: { signatures: 10 },
};

const mockSignature = {
  id: "sig-1",
  petitionId: "petition-1",
  userId: "user-2",
  method: "DIGITAL",
  signedAt: new Date("2026-03-10"),
  signatureUrl: "https://example.com/sig.png",
  user: { name: "Resident", mobile: "9876543210" },
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function makeReq(url = "http://localhost/api/v1/super-admin/societies/soc-1/events") {
  return new NextRequest(url);
}

// ===========================================================================
// GET_EVENTS — list all events for a society
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.communityEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.communityEvent.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_EVENTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated events with defaults", async () => {
    const res = await GET_EVENTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("event-1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "soc-1" }, skip: 0, take: 20 }),
    );
  });

  it("filters by status query param", async () => {
    const res = await GET_EVENTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events?status=PUBLISHED"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", status: "PUBLISHED" },
      }),
    );
    expect(mockPrisma.communityEvent.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "soc-1", status: "PUBLISHED" } }),
    );
  });

  it("filters by category query param", async () => {
    const res = await GET_EVENTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events?category=MEETING"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", category: "MEETING" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.communityEvent.findMany.mockRejectedValue(new Error("DB failure"));
    const res = await GET_EVENTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ===========================================================================
// GET_EVENT_DETAIL — single event with financial summary
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/events/[eid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockEvent);
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_EVENT_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events/event-1"),
      { params: Promise.resolve({ id: "soc-1", eid: "event-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns event detail with financial summary", async () => {
    const res = await GET_EVENT_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events/event-1"),
      { params: Promise.resolve({ id: "soc-1", eid: "event-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("event-1");
    expect(body.title).toBe("Annual Meeting");
    expect(body.financeSummary).toEqual({
      totalCollected: 1000,
      totalExpenses: 500,
      netAmount: 500,
    });
    expect(mockPrisma.communityEvent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "event-1" } }),
    );
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await GET_EVENT_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events/event-1"),
      { params: Promise.resolve({ id: "soc-1", eid: "event-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when event belongs to a different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      societyId: "soc-other",
    });
    const res = await GET_EVENT_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events/event-1"),
      { params: Promise.resolve({ id: "soc-1", eid: "event-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await GET_EVENT_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/events/event-1"),
      { params: Promise.resolve({ id: "soc-1", eid: "event-1" }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ===========================================================================
// GET_PETITIONS — list all petitions for a society
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/petitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.petition.findMany.mockResolvedValue([mockPetition]);
    mockPrisma.petition.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_PETITIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated petitions with defaults", async () => {
    const res = await GET_PETITIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("petition-1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "soc-1" }, skip: 0, take: 20 }),
    );
  });

  it("filters by status query param", async () => {
    const res = await GET_PETITIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions?status=PUBLISHED"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", status: "PUBLISHED" },
      }),
    );
    expect(mockPrisma.petition.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "soc-1", status: "PUBLISHED" } }),
    );
  });

  it("filters by type query param", async () => {
    const res = await GET_PETITIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions?type=COMPLAINT"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", type: "COMPLAINT" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.petition.findMany.mockRejectedValue(new Error("DB failure"));
    const res = await GET_PETITIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ===========================================================================
// GET_PETITION_DETAIL — single petition with signatories
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/petitions/[pid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPetition);
    mockPrisma.petitionSignature.findMany.mockResolvedValue([mockSignature]);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_PETITION_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns petition detail with signatories", async () => {
    const res = await GET_PETITION_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("petition-1");
    expect(body.title).toBe("Speed Breaker Request");
    expect(body.signatureCount).toBe(10);
    expect(body.signatories).toHaveLength(1);
    expect(body.signatories[0].id).toBe("sig-1");
    expect(mockPrisma.petition.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "petition-1" } }),
    );
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { petitionId: "petition-1" } }),
    );
  });

  it("returns 404 when petition not found", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET_PETITION_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      societyId: "soc-other",
    });
    const res = await GET_PETITION_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await GET_PETITION_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ===========================================================================
// GET_PETITION_REPORT — PDF report for a petition
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/petitions/[pid]/report", () => {
  const pdfStreamMock = {
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from("%PDF-mock");
    },
  };

  // The report route selects user.userUnits (different shape from the detail route)
  const mockReportSignature = {
    id: "sig-1",
    petitionId: "petition-1",
    userId: "user-2",
    method: "DIGITAL",
    signedAt: new Date("2026-03-10"),
    user: {
      name: "Resident",
      userUnits: [{ unit: { displayLabel: "A-101" } }],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      _count: { signatures: 10 },
    });
    mockPrisma.society.findUnique.mockResolvedValue({ name: "Eden Estate" });
    mockPrisma.petitionSignature.findMany.mockResolvedValue([mockReportSignature]);
    mockRenderToStream.mockResolvedValue(pdfStreamMock);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_PETITION_REPORT(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1/report"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns PDF response when petition has signatures", async () => {
    const res = await GET_PETITION_REPORT(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1/report"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("petition-report-");
    expect(mockRenderToStream).toHaveBeenCalledOnce();
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { petitionId: "petition-1" } }),
    );
  });

  it("returns 400 when petition has no signatures", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      _count: { signatures: 0 },
    });
    const res = await GET_PETITION_REPORT(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1/report"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_SIGNATURES");
    // PDF renderer must not be called
    expect(mockRenderToStream).not.toHaveBeenCalled();
  });

  it("returns 404 when petition not found", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET_PETITION_REPORT(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1/report"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await GET_PETITION_REPORT(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/petitions/petition-1/report"),
      { params: Promise.resolve({ id: "soc-1", pid: "petition-1" }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
