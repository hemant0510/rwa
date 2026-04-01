import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/support/[id]/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

function makeReq(id: string) {
  return [
    new Request(`http://localhost/api/v1/admin/support/${id}`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("Admin Support Detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
  });

  it("returns request detail with non-internal messages", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: "r-1",
      subject: "Bug",
      messages: [{ id: "msg-1", content: "Public", isInternal: false }],
    });

    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject).toBe("Bug");
  });

  it("returns 404 when request not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
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

  it("filters internal messages via Prisma where clause", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", messages: [] });
    const [req, ctx] = makeReq("r-1");
    await GET(req, ctx);
    expect(mockPrisma.serviceRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({ where: { isInternal: false } }),
        }),
      }),
    );
  });
});
