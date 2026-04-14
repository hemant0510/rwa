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

import { POST } from "@/app/api/v1/super-admin/counsellors/[id]/transfer-portfolio/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const SRC = "550e8400-e29b-41d4-a716-446655440001";
const TGT = "550e8400-e29b-41d4-a716-446655440002";
const SOC = "550e8400-e29b-41d4-a716-446655440099";

const makeParams = () => ({ params: Promise.resolve({ id: SRC }) });
const makePost = (body: unknown) =>
  new Request("http://localhost/api/v1/super-admin/counsellors/c/transfer-portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

describe("POST /api/v1/super-admin/counsellors/[id]/transfer-portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === SRC) return { id: SRC, name: "Src", email: "src@x.com" };
        if (where.id === TGT)
          return { id: TGT, name: "Tgt", email: "tgt@x.com", mobile: null, isActive: true };
        return null;
      },
    );
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma);
    });
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid payload", async () => {
    const res = await POST(makePost({ targetCounsellorId: "bad" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 400 when source and target are the same", async () => {
    const res = await POST(makePost({ targetCounsellorId: SRC }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSFER");
  });

  it("returns 404 when source counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === TGT)
          return { id: TGT, name: "Tgt", email: "tgt@x.com", mobile: null, isActive: true };
        return null;
      },
    );
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when target counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === SRC) return { id: SRC, name: "Src", email: "src@x.com" };
        return null;
      },
    );
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when target counsellor is suspended", async () => {
    mockPrisma.counsellor.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === SRC) return { id: SRC, name: "Src", email: "src@x.com" };
        if (where.id === TGT)
          return { id: TGT, name: "Tgt", email: "tgt@x.com", mobile: null, isActive: false };
        return null;
      },
    );
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TARGET_SUSPENDED");
  });

  it("returns transferred=0 when source has no active assignments", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transferred).toBe(0);
  });

  it("blocks transfer with 409 on COI match", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValueOnce([
      { id: "a1", societyId: SOC, isPrimary: true, notes: null },
    ]);
    mockPrisma.user.findFirst.mockResolvedValue({ societyId: SOC });
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(409);
  });

  it("transfers assignments by creating target + revoking source", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.counsellorId === SRC) {
          return [{ id: "src-a", societyId: SOC, isPrimary: true, notes: "zone-A" }];
        }
        return [];
      },
    );
    mockPrisma.counsellorSocietyAssignment.create.mockResolvedValue({});
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transferred).toBe(1);
    expect(mockPrisma.counsellorSocietyAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "src-a" },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
    expect(mockPrisma.counsellorSocietyAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          counsellorId: TGT,
          societyId: SOC,
          isPrimary: true,
          notes: "zone-A",
        }),
      }),
    );
  });

  it("reactivates target assignment if previously revoked", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.counsellorId === SRC) {
          return [{ id: "src-a", societyId: SOC, isPrimary: true, notes: null }];
        }
        if (where.counsellorId === TGT) {
          return [{ id: "tgt-old", societyId: SOC, isActive: false }];
        }
        return [];
      },
    );
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.counsellorSocietyAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tgt-old" },
        data: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it("skips when target is already actively assigned", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.counsellorId === SRC) {
          return [{ id: "src-a", societyId: SOC, isPrimary: true, notes: null }];
        }
        if (where.counsellorId === TGT) {
          return [{ id: "tgt-active", societyId: SOC, isActive: true }];
        }
        return [];
      },
    );
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(body.transferred).toBe(0);
  });

  it("filters transfer to specific societyIds when provided", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    await POST(makePost({ targetCounsellorId: TGT, societyIds: [SOC] }), makeParams());
    expect(mockPrisma.counsellorSocietyAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: { in: [SOC] } }),
      }),
    );
  });

  it("skips COI check when target has no email/mobile", async () => {
    mockPrisma.counsellor.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === SRC) return { id: SRC, name: "Src", email: "src@x.com" };
        if (where.id === TGT)
          return { id: TGT, name: "Tgt", email: "", mobile: null, isActive: true };
        return null;
      },
    );
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValueOnce([
      { id: "a1", societyId: SOC, isPrimary: false, notes: null },
    ]);
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 500 on transaction failure", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValueOnce([
      { id: "src-a", societyId: SOC, isPrimary: true, notes: null },
    ]);
    mockPrisma.$transaction.mockRejectedValue(new Error("tx"));
    const res = await POST(makePost({ targetCounsellorId: TGT }), makeParams());
    expect(res.status).toBe(500);
  });
});
