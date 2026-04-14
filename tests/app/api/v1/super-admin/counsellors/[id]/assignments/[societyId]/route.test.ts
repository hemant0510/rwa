import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellorSocietyAssignment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { DELETE } from "@/app/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const makeParams = (id = "c-1", societyId = "soc-1") => ({
  params: Promise.resolve({ id, societyId }),
});

const req = new Request("http://localhost") as never;

describe("DELETE /api/v1/super-admin/counsellors/[id]/assignments/[societyId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellorSocietyAssignment.update.mockResolvedValue({});
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when assignment not found", async () => {
    mockPrisma.counsellorSocietyAssignment.findUnique.mockResolvedValue(null);
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 idempotently when already revoked", async () => {
    mockPrisma.counsellorSocietyAssignment.findUnique.mockResolvedValue({
      id: "a-1",
      isActive: false,
      isPrimary: false,
    });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.counsellorSocietyAssignment.update).not.toHaveBeenCalled();
  });

  it("soft-revokes active assignment and logs audit", async () => {
    mockPrisma.counsellorSocietyAssignment.findUnique.mockResolvedValue({
      id: "a-1",
      isActive: true,
      isPrimary: false,
    });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.counsellorSocietyAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false, revokedById: "sa-1" }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it("promotes oldest secondary to primary when revoking primary", async () => {
    mockPrisma.counsellorSocietyAssignment.findUnique.mockResolvedValue({
      id: "a-1",
      isActive: true,
      isPrimary: true,
    });
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ id: "a-2" });
    await DELETE(req, makeParams());
    expect(mockPrisma.counsellorSocietyAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a-2" }, data: { isPrimary: true } }),
    );
  });

  it("does nothing when revoking primary with no secondary to promote", async () => {
    mockPrisma.counsellorSocietyAssignment.findUnique.mockResolvedValue({
      id: "a-1",
      isActive: true,
      isPrimary: true,
    });
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue(null);
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(200);
    // Only one update — the revoke itself
    expect(mockPrisma.counsellorSocietyAssignment.update).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.counsellorSocietyAssignment.findUnique.mockRejectedValue(new Error("DB"));
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(500);
  });
});
