import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  communityEvent: { findMany: vi.fn() },
  petition: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/super-admin/operations/activity/route";

const mockSAContext = {
  data: {
    superAdminId: "sa-1",
    authUserId: "auth-sa-1",
    email: "sa@rwa.com",
  },
  error: null,
};

describe("GET /api/v1/super-admin/operations/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.communityEvent.findMany.mockResolvedValue([]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN", message: "Super admin access required" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: forbiddenResponse,
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns empty activities when no data exists", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toEqual([]);
  });

  it("groups resident approvals by society", async () => {
    // First findMany call = recentApprovals, second = inactiveAdmins
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        {
          societyId: "soc-1",
          approvedAt: new Date("2026-03-31T10:00:00Z"),
          society: { id: "soc-1", name: "Greenwood Residency" },
        },
        {
          societyId: "soc-1",
          approvedAt: new Date("2026-03-31T09:00:00Z"),
          society: { id: "soc-1", name: "Greenwood Residency" },
        },
        {
          societyId: "soc-1",
          approvedAt: new Date("2026-03-30T08:00:00Z"),
          society: { id: "soc-1", name: "Greenwood Residency" },
        },
      ])
      .mockResolvedValueOnce([]); // inactive admins

    const res = await GET();
    const body = await res.json();

    const approvalItems = body.activities.filter(
      (a: { type: string }) => a.type === "resident_approved",
    );
    expect(approvalItems).toHaveLength(1);
    expect(approvalItems[0].message).toContain("3 new residents");
    expect(approvalItems[0].severity).toBe("info");
  });

  it("creates activity items for recent events", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // approvals
      .mockResolvedValueOnce([]); // inactive admins

    mockPrisma.communityEvent.findMany.mockResolvedValue([
      {
        title: "Holi Celebration",
        createdAt: new Date("2026-03-30T10:00:00Z"),
        society: { id: "soc-1", name: "Greenwood Residency" },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    const eventItems = body.activities.filter((a: { type: string }) => a.type === "event_created");
    expect(eventItems).toHaveLength(1);
    expect(eventItems[0].message).toContain("Holi Celebration");
    expect(eventItems[0].societyName).toBe("Greenwood Residency");
  });

  it("creates activity items for recent petitions", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // approvals
      .mockResolvedValueOnce([]); // inactive admins

    mockPrisma.petition.findMany.mockResolvedValue([
      {
        title: "Water Tank Issue",
        type: "COMPLAINT",
        createdAt: new Date("2026-03-30T10:00:00Z"),
        society: { id: "soc-2", name: "Green Valley" },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    const petitionItems = body.activities.filter(
      (a: { type: string }) => a.type === "petition_created",
    );
    expect(petitionItems).toHaveLength(1);
    expect(petitionItems[0].message).toContain("complaint");
    expect(petitionItems[0].message).toContain("Water Tank Issue");
  });

  it("flags inactive admins with alert severity", async () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // approvals
      .mockResolvedValueOnce([
        {
          societyId: "soc-3",
          updatedAt: fifteenDaysAgo,
          society: { id: "soc-3", name: "Palm Heights" },
        },
      ]); // inactive admins

    const res = await GET();
    const body = await res.json();

    const alertItems = body.activities.filter((a: { type: string }) => a.type === "admin_inactive");
    expect(alertItems).toHaveLength(1);
    expect(alertItems[0].severity).toBe("alert");
    expect(alertItems[0].message).toContain("Palm Heights");
    expect(alertItems[0].message).toContain("hasn't logged in");
  });

  it("deduplicates inactive admin alerts per society", async () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // approvals
      .mockResolvedValueOnce([
        {
          societyId: "soc-3",
          updatedAt: twentyDaysAgo,
          society: { id: "soc-3", name: "Palm Heights" },
        },
        {
          societyId: "soc-3",
          updatedAt: twentyDaysAgo,
          society: { id: "soc-3", name: "Palm Heights" },
        },
      ]);

    const res = await GET();
    const body = await res.json();

    const alertItems = body.activities.filter((a: { type: string }) => a.type === "admin_inactive");
    expect(alertItems).toHaveLength(1);
  });

  it("skips approvals with null society", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        {
          societyId: null,
          approvedAt: new Date(),
          society: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    const approvalItems = body.activities.filter(
      (a: { type: string }) => a.type === "resident_approved",
    );
    expect(approvalItems).toHaveLength(0);
  });

  it("skips inactive admins with null society", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([]) // approvals
      .mockResolvedValueOnce([
        {
          societyId: null,
          updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          society: null,
        },
      ]);

    const res = await GET();
    const body = await res.json();

    const alertItems = body.activities.filter((a: { type: string }) => a.type === "admin_inactive");
    expect(alertItems).toHaveLength(0);
  });

  it("handles approval with null approvedAt", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        {
          societyId: "soc-1",
          approvedAt: null,
          society: { id: "soc-1", name: "Greenwood Residency" },
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    const approvalItems = body.activities.filter(
      (a: { type: string }) => a.type === "resident_approved",
    );
    expect(approvalItems).toHaveLength(1);
    expect(approvalItems[0].message).toContain("1 new resident");
  });

  it("sorts all activities by timestamp descending", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        {
          societyId: "soc-1",
          approvedAt: new Date("2026-03-28T10:00:00Z"),
          society: { id: "soc-1", name: "Greenwood" },
        },
      ])
      .mockResolvedValueOnce([]); // inactive

    mockPrisma.communityEvent.findMany.mockResolvedValue([
      {
        title: "Recent Event",
        createdAt: new Date("2026-03-31T10:00:00Z"),
        society: { id: "soc-2", name: "Green Valley" },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.activities[0].type).toBe("event_created");
    expect(body.activities[1].type).toBe("resident_approved");
  });

  it("limits activities to 50", async () => {
    const manyEvents = Array.from({ length: 20 }, (_, i) => ({
      title: `Event ${i}`,
      createdAt: new Date(Date.now() - i * 3600000),
      society: { id: `soc-${i}`, name: `Society ${i}` },
    }));

    const manyPetitions = Array.from({ length: 20 }, (_, i) => ({
      title: `Petition ${i}`,
      type: "PETITION",
      createdAt: new Date(Date.now() - i * 3600000),
      society: { id: `soc-${i + 20}`, name: `Society ${i + 20}` },
    }));

    const manyApprovals = Array.from({ length: 20 }, (_, i) => ({
      societyId: `soc-a-${i}`,
      approvedAt: new Date(Date.now() - i * 3600000),
      society: { id: `soc-a-${i}`, name: `Society A${i}` },
    }));

    mockPrisma.user.findMany.mockResolvedValueOnce(manyApprovals).mockResolvedValueOnce([]);
    mockPrisma.communityEvent.findMany.mockResolvedValue(manyEvents);
    mockPrisma.petition.findMany.mockResolvedValue(manyPetitions);

    const res = await GET();
    const body = await res.json();

    expect(body.activities.length).toBeLessThanOrEqual(50);
  });

  it("does not call Prisma when auth fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: forbiddenResponse,
    });

    await GET();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.communityEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
