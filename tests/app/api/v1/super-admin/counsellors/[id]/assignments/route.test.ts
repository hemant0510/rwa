import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { findUnique: vi.fn() },
  counsellorSocietyAssignment: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET, POST } from "@/app/api/v1/super-admin/counsellors/[id]/assignments/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const makeParams = (id = "c-1") => ({ params: Promise.resolve({ id }) });
const SOC_1 = "550e8400-e29b-41d4-a716-446655440001";
const SOC_2 = "550e8400-e29b-41d4-a716-446655440002";

const makePost = (body: unknown) =>
  new Request("http://localhost/api/v1/super-admin/counsellors/c-1/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

describe("GET /api/v1/super-admin/counsellors/[id]/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns active assignments with society details", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({ id: "c-1" });
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([
      { id: "a-1", society: { id: SOC_1, name: "S1" }, isActive: true },
    ]);
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignments).toHaveLength(1);
    expect(mockPrisma.counsellorSocietyAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { counsellorId: "c-1", isActive: true } }),
    );
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/super-admin/counsellors/[id]/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "asha@x.com",
      mobile: "+919876543210",
      nationalId: null,
      isActive: true,
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma);
    });
    mockPrisma.counsellorSocietyAssignment.create.mockResolvedValue({ id: "a-new" });
    mockPrisma.counsellorSocietyAssignment.update.mockResolvedValue({ id: "a-up" });
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid payload", async () => {
    const res = await POST(makePost({ societyIds: [] }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when counsellor is suspended", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "a@x.com",
      mobile: null,
      nationalId: null,
      isActive: false,
    });
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("COUNSELLOR_SUSPENDED");
  });

  it("blocks with 409 when COI match is found in target society", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      societyId: SOC_1,
      email: "asha@x.com",
      mobile: null,
    });
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT_OF_INTEREST");
  });

  it("creates new assignments as primary when no prior counsellor exists", async () => {
    const res = await POST(
      makePost({ societyIds: [SOC_1, SOC_2], notes: "east zone" }),
      makeParams(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assigned).toBe(2);
    expect(mockPrisma.counsellorSocietyAssignment.create).toHaveBeenCalledTimes(2);
    // First call should be primary=true
    expect(mockPrisma.counsellorSocietyAssignment.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ isPrimary: true }) }),
    );
  });

  it("creates new assignment as secondary when another counsellor is already primary", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.isPrimary === true && where.isActive === true) {
          return [{ societyId: SOC_1 }];
        }
        return [];
      },
    );
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.counsellorSocietyAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isPrimary: false }) }),
    );
  });

  it("reactivates a previously revoked assignment", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        // Not filtering isPrimary: return existing inactive row
        if (where.isPrimary === undefined) {
          return [{ id: "a-old", societyId: SOC_1, isActive: false }];
        }
        return [];
      },
    );
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reactivated).toBe(1);
    expect(mockPrisma.counsellorSocietyAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "a-old" },
        data: expect.objectContaining({ isActive: true, revokedAt: null }),
      }),
    );
  });

  it("skips idempotent re-assign when existing assignment is still active", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.isPrimary === undefined) {
          return [{ id: "a-cur", societyId: SOC_1, isActive: true }];
        }
        return [];
      },
    );
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.alreadyActive).toBe(1);
    expect(mockPrisma.counsellorSocietyAssignment.create).not.toHaveBeenCalled();
    expect(mockPrisma.counsellorSocietyAssignment.update).not.toHaveBeenCalled();
  });

  it("deduplicates duplicate societyIds in input", async () => {
    await POST(makePost({ societyIds: [SOC_1, SOC_1, SOC_2] }), makeParams());
    expect(mockPrisma.counsellorSocietyAssignment.create).toHaveBeenCalledTimes(2);
  });

  it("skips COI query when counsellor has no email or mobile", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "",
      mobile: null,
      nationalId: null,
      isActive: true,
    });
    await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 500 on prisma failure during transaction", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("tx fail"));
    const res = await POST(makePost({ societyIds: [SOC_1] }), makeParams());
    expect(res.status).toBe(500);
  });
});
