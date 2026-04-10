import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { PATCH } from "@/app/api/v1/admin/resident-support/[id]/priority/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });

function makeReq(body: Record<string, unknown>, id = "t-1") {
  return new Request(`http://localhost/api/v1/admin/resident-support/${id}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Admin Resident Support - PATCH Priority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeReq({ priority: "HIGH" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for READ_NOTIFY admin", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });
    const res = await PATCH(makeReq({ priority: "HIGH" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ priority: "HIGH" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 on invalid priority", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", priority: "MEDIUM" });
    const res = await PATCH(makeReq({ priority: "SUPER_URGENT" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("successfully updates priority", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", priority: "MEDIUM" });
    const updatedTicket = { id: "t-1", priority: "HIGH" };
    mockPrisma.residentTicket.update.mockResolvedValue(updatedTicket);

    const res = await PATCH(makeReq({ priority: "HIGH" }), makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
        data: { priority: "HIGH" },
      }),
    );
    const json = await res.json();
    expect(json.priority).toBe("HIGH");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await PATCH(makeReq({ priority: "HIGH" }), makeParams());
    expect(res.status).toBe(500);
  });
});
