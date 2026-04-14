import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { findUnique: vi.fn() },
  counsellorSocietyAssignment: { findMany: vi.fn() },
  society: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/counsellors/[id]/available-societies/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const makeParams = () => ({ params: Promise.resolve({ id: "c-1" }) });
const makeReq = (q = "") =>
  new Request(
    `http://localhost/api/v1/super-admin/counsellors/c-1/available-societies${q}`,
  ) as never;

describe("GET /api/v1/super-admin/counsellors/[id]/available-societies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue({ id: "c-1" });
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    mockPrisma.society.findMany.mockResolvedValue([]);
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("lists societies excluding currently assigned ones", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([
      { societyId: "soc-assigned" },
    ]);
    mockPrisma.society.findMany.mockResolvedValue([
      { id: "soc-free", name: "Free", societyCode: "FREE" },
    ]);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.societies).toHaveLength(1);
    expect(mockPrisma.society.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ["soc-assigned"] } }),
      }),
    );
  });

  it("does not add notIn filter when no assignments exist", async () => {
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const callArgs = mockPrisma.society.findMany.mock.calls[0][0];
    expect(callArgs.where.id).toBeUndefined();
  });

  it("applies search filter across name/code/city", async () => {
    await GET(makeReq("?search=delhi"), makeParams());
    expect(mockPrisma.society.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });
});
