import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
const mockAdminDeleteUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: mockAdminDeleteUser } },
  }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET, PATCH, DELETE } from "@/app/api/v1/super-admin/counsellors/[id]/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const makeParams = (id = "c-1") => ({ params: Promise.resolve({ id }) });

const makePatchRequest = (body: unknown) =>
  new Request(`http://localhost/api/v1/super-admin/counsellors/c-1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

describe("GET /api/v1/super-admin/counsellors/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns counsellor detail on success", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "asha@x.com",
      name: "Asha",
      isActive: true,
    });
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("c-1");
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/v1/super-admin/counsellors/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      name: "Old",
      email: "old@x.com",
      isActive: true,
    });
    mockPrisma.counsellor.update.mockResolvedValue({
      id: "c-1",
      name: "New",
      email: "old@x.com",
      isActive: true,
    });
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await PATCH(makePatchRequest({ name: "New" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid input", async () => {
    const res = await PATCH(makePatchRequest({ mobile: "bad" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ name: "New" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("logs SA_COUNSELLOR_UPDATED on name change", async () => {
    const res = await PATCH(makePatchRequest({ name: "New" }), makeParams());
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_COUNSELLOR_UPDATED" }),
    );
  });

  it("logs SA_COUNSELLOR_SUSPENDED when isActive flips true→false", async () => {
    mockPrisma.counsellor.update.mockResolvedValue({
      id: "c-1",
      name: "Old",
      email: "old@x.com",
      isActive: false,
    });
    const res = await PATCH(makePatchRequest({ isActive: false }), makeParams());
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_COUNSELLOR_SUSPENDED" }),
    );
  });

  it("logs SA_COUNSELLOR_REACTIVATED when isActive flips false→true", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      name: "Old",
      email: "old@x.com",
      isActive: false,
    });
    mockPrisma.counsellor.update.mockResolvedValue({
      id: "c-1",
      name: "Old",
      email: "old@x.com",
      isActive: true,
    });
    const res = await PATCH(makePatchRequest({ isActive: true }), makeParams());
    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_COUNSELLOR_REACTIVATED" }),
    );
  });

  it("returns 500 on prisma update failure", async () => {
    mockPrisma.counsellor.update.mockRejectedValue(new Error("DB"));
    const res = await PATCH(makePatchRequest({ name: "New" }), makeParams());
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/v1/super-admin/counsellors/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      authUserId: "auth-c-1",
      name: "Asha",
      email: "asha@x.com",
    });
    mockPrisma.counsellor.delete.mockResolvedValue({});
    mockAdminDeleteUser.mockResolvedValue({ error: null });
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await DELETE(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("deletes counsellor and disables auth user", async () => {
    const res = await DELETE(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.counsellor.delete).toHaveBeenCalledWith({ where: { id: "c-1" } });
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("auth-c-1");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_COUNSELLOR_DELETED" }),
    );
  });

  it("swallows auth deleteUser failure (best-effort)", async () => {
    mockAdminDeleteUser.mockRejectedValue(new Error("auth fail"));
    const res = await DELETE(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(200);
  });

  it("returns 500 on prisma delete failure", async () => {
    mockPrisma.counsellor.delete.mockRejectedValue(new Error("DB"));
    const res = await DELETE(new Request("http://x") as never, makeParams());
    expect(res.status).toBe(500);
  });
});
