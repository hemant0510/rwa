import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/support/[id]/route";

const mockSA = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeReq(id: string) {
  return [
    new Request(`http://localhost/api/v1/super-admin/support/${id}`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("SA Support Detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSA);
  });

  it("returns request detail with ALL messages (including internal)", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: "r-1",
      subject: "Bug",
      messages: [
        { id: "msg-1", isInternal: false },
        { id: "msg-2", isInternal: true },
      ],
    });

    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
  });

  it("returns 404 when request not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not SA", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findUnique.mockRejectedValue(new Error("DB"));
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
  });
});
