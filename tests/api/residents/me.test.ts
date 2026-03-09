import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockSupabaseClient } from "../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

vi.mock("@/lib/fee-calculator", () => ({
  getSessionYear: () => "2025-26",
}));

import { GET } from "@/app/api/v1/residents/me/route";

describe("GET /api/v1/residents/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 404 when user not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns resident profile with all fields", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u1",
      name: "Hemant Bhagat",
      email: "hemant@test.com",
      mobile: "9876543210",
      rwaid: "EDEN-001",
      status: "ACTIVE_PAID",
      ownershipType: "OWNER",
      society: { name: "Eden Estate", societyCode: "EDEN" },
      userUnits: [{ unit: { displayLabel: "A-101" } }],
      governingBodyMembership: null,
    });
    mockPrisma.membershipFee.findFirst.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.id).toBe("u1");
    expect(body.name).toBe("Hemant Bhagat");
    expect(body.email).toBe("hemant@test.com");
    expect(body.mobile).toBe("9876543210");
    expect(body.rwaid).toBe("EDEN-001");
    expect(body.status).toBe("ACTIVE_PAID");
    expect(body.ownershipType).toBe("OWNER");
    expect(body.societyName).toBe("Eden Estate");
    expect(body.unit).toBe("A-101");
    expect(body.designation).toBeNull();
  });

  it("returns designation when user is governing body member", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u1",
      name: "Hemant",
      email: "h@test.com",
      mobile: "9999999999",
      rwaid: "EDEN-001",
      status: "ACTIVE_PAID",
      ownershipType: "OWNER",
      society: { name: "Eden Estate", societyCode: "EDEN" },
      userUnits: [],
      governingBodyMembership: { designation: { name: "President" } },
    });
    mockPrisma.membershipFee.findFirst.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();
    expect(body.designation).toBe("President");
    expect(body.unit).toBeNull();
  });

  it("returns current fee data when fee record exists", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
      mobile: "1111111111",
      rwaid: "TEST-001",
      status: "ACTIVE_PAID",
      ownershipType: "OWNER",
      society: { name: "Test", societyCode: "TEST" },
      userUnits: [],
      governingBodyMembership: null,
    });
    mockPrisma.membershipFee.findFirst.mockResolvedValue({
      sessionYear: "2025-26",
      amountDue: 1200,
      amountPaid: 1200,
      status: "PAID",
    });

    const res = await GET();
    const body = await res.json();
    expect(body.currentFee).toEqual({
      sessionYear: "2025-26",
      amountDue: 1200,
      amountPaid: 1200,
      status: "PAID",
    });
  });

  it("returns null currentFee when no fee record", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
      mobile: "1111111111",
      rwaid: "TEST-001",
      status: "ACTIVE_PAID",
      ownershipType: "OWNER",
      society: { name: "Test", societyCode: "TEST" },
      userUnits: [],
      governingBodyMembership: null,
    });
    mockPrisma.membershipFee.findFirst.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();
    expect(body.currentFee).toBeNull();
  });

  it("uses active society cookie for scoping", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-42");
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
      mobile: "1111111111",
      rwaid: "TEST-001",
      status: "ACTIVE_PAID",
      ownershipType: "OWNER",
      society: { name: "Test", societyCode: "TEST" },
      userUnits: [],
      governingBodyMembership: null,
    });
    mockPrisma.membershipFee.findFirst.mockResolvedValue(null);

    await GET();

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: "soc-42",
          role: "RESIDENT",
        }),
      }),
    );
  });

  it("handles server errors gracefully", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
