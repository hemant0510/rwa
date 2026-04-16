import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getAdminContext: mockGetAdminContext }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/support/[id]/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: false,
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
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    // Reset to clear any leftover mockResolvedValueOnce queue, then set up chain
    mockPrisma.serviceRequest.findUnique.mockReset();
    // First call: entity lookup. Second call: full detail.
    mockPrisma.serviceRequest.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce({
        id: "r-1",
        subject: "Bug",
        messages: [{ id: "msg-1", content: "Public", isInternal: false }],
      });
  });

  it("returns request detail with non-internal messages", async () => {
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject).toBe("Bug");
  });

  it("returns 404 when entity not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockReset();
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not admin of that society", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
    expect(mockGetAdminContext).toHaveBeenCalledWith("soc-1");
  });

  it("returns ticket detail for Super Admin", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("returns 404 when full detail query returns null", async () => {
    mockPrisma.serviceRequest.findUnique.mockReset();
    mockPrisma.serviceRequest.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce(null);
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findUnique.mockReset();
    mockPrisma.serviceRequest.findUnique.mockRejectedValue(new Error("DB"));
    const [req, ctx] = makeReq("r-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
  });

  it("filters internal messages via Prisma where clause", async () => {
    const [req, ctx] = makeReq("r-1");
    await GET(req, ctx);
    // Second call should be the full query with include
    expect(mockPrisma.serviceRequest.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({ where: { isInternal: false } }),
        }),
      }),
    );
  });
});
