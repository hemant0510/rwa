import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { findUnique: vi.fn() },
  counsellorAuditLog: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/counsellors/[id]/audit/route";

const saContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const VALID_ID = "11111111-1111-1111-1111-111111111111";

const makeParams = (id = VALID_ID) => ({ params: Promise.resolve({ id }) });
const makeReq = (url = `http://localhost/api/v1/super-admin/counsellors/${VALID_ID}/audit`) =>
  new Request(url) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperAdmin.mockResolvedValue(saContext);
  mockPrisma.counsellor.findUnique.mockResolvedValue({ id: VALID_ID });
  mockPrisma.counsellorAuditLog.findMany.mockResolvedValue([]);
  mockPrisma.counsellorAuditLog.count.mockResolvedValue(0);
});

describe("GET /api/v1/super-admin/counsellors/[id]/audit", () => {
  it("returns 403 when SA guard rejects", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response("{}", { status: 403 }),
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when id is not a UUID", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/counsellors/not-a-uuid/audit"),
      makeParams("not-a-uuid"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns logs and total with default pagination", async () => {
    const rows = [
      {
        id: "l-1",
        counsellorId: VALID_ID,
        actionType: "COUNSELLOR_ACKNOWLEDGE_ESCALATION",
        entityType: "ResidentTicketEscalation",
        entityId: "e-1",
        societyId: "s-1",
        metadata: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      },
    ];
    mockPrisma.counsellorAuditLog.findMany.mockResolvedValue(rows);
    mockPrisma.counsellorAuditLog.count.mockResolvedValue(1);

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(25);
    expect(mockPrisma.counsellorAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { counsellorId: VALID_ID },
        skip: 0,
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("honors page and pageSize query params", async () => {
    const res = await GET(
      makeReq(
        `http://localhost/api/v1/super-admin/counsellors/${VALID_ID}/audit?page=2&pageSize=50`,
      ),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(50);
    expect(mockPrisma.counsellorAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 50 }),
    );
  });

  it("clamps invalid page params to defaults", async () => {
    const res = await GET(
      makeReq(
        `http://localhost/api/v1/super-admin/counsellors/${VALID_ID}/audit?page=abc&pageSize=500`,
      ),
      makeParams(),
    );
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(25);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("db"));
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });
});
