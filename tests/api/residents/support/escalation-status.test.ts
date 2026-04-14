import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  residentTicketEscalationVote: { count: vi.fn(), findFirst: vi.fn() },
  residentTicketEscalation: { findFirst: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/residents/me/support/[id]/escalation-status/route";

const resident = {
  userId: "u-2",
  authUserId: "auth-2",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });
const makeReq = () => new Request("http://localhost/x", { method: "GET" });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(resident);
});

describe("Resident escalation-status GET", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns status with counts when voter has voted and escalation exists", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      society: { counsellorEscalationThreshold: 10 },
    });
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(7);
    mockPrisma.residentTicketEscalationVote.findFirst.mockResolvedValue({ id: "v-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({ id: "e-1" });

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ticketId: "t-1",
      threshold: 10,
      voteCount: 7,
      hasVoted: true,
      escalationCreated: true,
    });
  });

  it("returns hasVoted=false and escalationCreated=false when neither present", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      society: { counsellorEscalationThreshold: 15 },
    });
    mockPrisma.residentTicketEscalationVote.count.mockResolvedValue(0);
    mockPrisma.residentTicketEscalationVote.findFirst.mockResolvedValue(null);
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);

    const res = await GET(makeReq(), makeParams());
    const json = await res.json();
    expect(json).toEqual({
      ticketId: "t-1",
      threshold: 15,
      voteCount: 0,
      hasVoted: false,
      escalationCreated: false,
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("db"));
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });
});
