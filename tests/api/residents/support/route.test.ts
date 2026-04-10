import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendResidentTicketCreated = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/whatsapp", () => ({ sendResidentTicketCreated: mockSendResidentTicketCreated }));

import { GET, POST } from "@/app/api/v1/residents/me/support/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
  name: "Priya Sharma",
};

function makeGetReq(params = "") {
  return new Request(`http://localhost/api/v1/residents/me/support${params}`);
}
function makePostReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/residents/me/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Resident Support API — GET + POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.residentTicket.findMany.mockResolvedValue([]);
    mockPrisma.residentTicket.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockLogAudit.mockResolvedValue(undefined);
    mockSendResidentTicketCreated.mockResolvedValue({ success: true });
  });

  // ── GET ──────────────────────────────────────────────────────────

  it("GET returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(401);
  });

  it("GET lists society-scoped tickets with pagination", async () => {
    mockPrisma.residentTicket.findMany.mockResolvedValue([{ id: "t-1", subject: "Leak" }]);
    mockPrisma.residentTicket.count.mockResolvedValue(1);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-1" }),
        skip: 0,
        take: 20,
      }),
    );
  });

  it("GET filters by status query param", async () => {
    await GET(makeGetReq("?status=OPEN") as never);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
      }),
    );
  });

  it("GET filters by type query param", async () => {
    await GET(makeGetReq("?type=MAINTENANCE_ISSUE") as never);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "MAINTENANCE_ISSUE" }),
      }),
    );
  });

  it("GET filters by mine=true (createdBy = userId)", async () => {
    await GET(makeGetReq("?mine=true") as never);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdBy: "u-1" }),
      }),
    );
  });

  it("GET returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(500);
  });

  // ── POST ─────────────────────────────────────────────────────────

  it("POST returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makePostReq({
        type: "MAINTENANCE_ISSUE",
        subject: "Water leak in bathroom",
        description: "There is a constant water leak under the sink in the master bathroom",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST creates ticket with status OPEN + priority MEDIUM", async () => {
    const created = { id: "t-new", status: "OPEN", priority: "MEDIUM" };
    mockPrisma.residentTicket.create.mockResolvedValue(created);
    const res = await POST(
      makePostReq({
        type: "MAINTENANCE_ISSUE",
        subject: "Water leak in bathroom",
        description: "There is a constant water leak under the sink in the master bathroom",
      }),
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "soc-1",
          createdBy: "u-1",
          type: "MAINTENANCE_ISSUE",
          subject: "Water leak in bathroom",
        }),
      }),
    );
  });

  it("POST returns 422 on validation error (missing type)", async () => {
    const res = await POST(
      makePostReq({
        subject: "Water leak in bathroom",
        description: "There is a constant water leak under the sink in the master bathroom",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("POST returns 422 on short subject", async () => {
    const res = await POST(
      makePostReq({
        type: "MAINTENANCE_ISSUE",
        subject: "Hi",
        description: "There is a constant water leak under the sink in the master bathroom",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("POST returns 422 on short description", async () => {
    const res = await POST(
      makePostReq({
        type: "MAINTENANCE_ISSUE",
        subject: "Water leak in bathroom",
        description: "Short",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("POST calls logAudit on success", async () => {
    mockPrisma.residentTicket.create.mockResolvedValue({ id: "t-new" });
    await POST(
      makePostReq({
        type: "SECURITY_CONCERN",
        subject: "Gate left open overnight",
        description: "The main gate was left open overnight without any guard present",
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_CREATED",
        userId: "u-1",
        societyId: "soc-1",
        entityType: "ResidentTicket",
        entityId: "t-new",
      }),
    );
  });

  it("POST sends WhatsApp notification to admins with mobile + consent", async () => {
    mockPrisma.residentTicket.create.mockResolvedValue({ id: "t-new" });
    mockPrisma.user.findMany.mockResolvedValue([
      { name: "Admin One", mobile: "9876543210" },
      { name: "Admin Two", mobile: "9123456789" },
    ]);
    await POST(
      makePostReq({
        type: "MAINTENANCE_ISSUE",
        subject: "Water leak in bathroom",
        description: "There is a constant water leak under the sink in the master bathroom",
      }),
    );
    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendResidentTicketCreated).toHaveBeenCalledTimes(2);
    expect(mockSendResidentTicketCreated).toHaveBeenCalledWith(
      "9876543210",
      "Priya Sharma",
      "Water leak in bathroom",
      "MAINTENANCE_ISSUE",
    );
  });

  it("POST returns 500 on DB error", async () => {
    mockPrisma.residentTicket.create.mockRejectedValue(new Error("DB"));
    const res = await POST(
      makePostReq({
        type: "MAINTENANCE_ISSUE",
        subject: "Water leak in bathroom",
        description: "There is a constant water leak under the sink in the master bathroom",
      }),
    );
    expect(res.status).toBe(500);
  });
});
