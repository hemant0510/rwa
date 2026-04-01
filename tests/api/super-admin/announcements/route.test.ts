import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  platformAnnouncement: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET, POST } from "@/app/api/v1/super-admin/announcements/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/super-admin/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/v1/super-admin/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.platformAnnouncement.findMany.mockResolvedValue([]);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists all announcements newest first", async () => {
    mockPrisma.platformAnnouncement.findMany.mockResolvedValue([
      { id: "ann-1", subject: "Update v2.0", priority: "NORMAL", _count: { reads: 5 } },
      { id: "ann-2", subject: "Maintenance", priority: "URGENT", _count: { reads: 0 } },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].subject).toBe("Update v2.0");
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.platformAnnouncement.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/super-admin/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await POST(makePostRequest({ subject: "Test", body: "Test body text" }));
    expect(res.status).toBe(403);
  });

  it("creates announcement with ALL scope", async () => {
    const created = {
      id: "ann-1",
      subject: "Feature Update",
      body: "New features are live",
      priority: "NORMAL",
      scope: "ALL",
      societyIds: [],
      sentVia: ["IN_APP"],
      createdBy: "sa-1",
    };
    mockPrisma.platformAnnouncement.create.mockResolvedValue(created);

    const res = await POST(
      makePostRequest({
        subject: "Feature Update",
        body: "New features are live",
        scope: "ALL",
        sentVia: ["IN_APP"],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.subject).toBe("Feature Update");
    expect(body.scope).toBe("ALL");
  });

  it("creates targeted announcement with specific societies", async () => {
    mockPrisma.platformAnnouncement.create.mockResolvedValue({
      id: "ann-2",
      scope: "TARGETED",
      societyIds: ["soc-1", "soc-2"],
    });

    const uuid1 = "a0000000-0000-4000-8000-000000000001";
    const uuid2 = "b0000000-0000-4000-8000-000000000002";

    const res = await POST(
      makePostRequest({
        subject: "Billing Issue",
        body: "Please update your payment info",
        scope: "TARGETED",
        societyIds: [uuid1, uuid2],
      }),
    );
    expect(res.status).toBe(201);

    // Verify create was called with the societyIds
    expect(mockPrisma.platformAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: "TARGETED",
          societyIds: [uuid1, uuid2],
        }),
      }),
    );
  });

  it("creates announcement with URGENT priority", async () => {
    mockPrisma.platformAnnouncement.create.mockResolvedValue({
      id: "ann-3",
      priority: "URGENT",
    });

    const res = await POST(
      makePostRequest({
        subject: "Urgent Notice",
        body: "Critical maintenance tonight",
        priority: "URGENT",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.priority).toBe("URGENT");
  });

  it("returns 422 when subject is too short", async () => {
    const res = await POST(makePostRequest({ subject: "Hi", body: "This is a valid body" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when body is too short", async () => {
    const res = await POST(makePostRequest({ subject: "Valid Subject", body: "Short" }));
    expect(res.status).toBe(422);
  });

  it("clears societyIds when scope is ALL", async () => {
    mockPrisma.platformAnnouncement.create.mockResolvedValue({ id: "ann-4" });

    await POST(
      makePostRequest({
        subject: "All Societies",
        body: "Message for everyone",
        scope: "ALL",
        societyIds: ["a0000000-0000-4000-8000-000000000001"],
      }),
    );

    expect(mockPrisma.platformAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: "ALL",
          societyIds: [],
        }),
      }),
    );
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.platformAnnouncement.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(
      makePostRequest({ subject: "Valid Subject", body: "Valid body text here" }),
    );
    expect(res.status).toBe(500);
  });
});
