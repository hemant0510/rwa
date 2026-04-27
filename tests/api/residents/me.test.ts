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

const userFixture = {
  id: "u1",
  name: "Arjun Kapoor",
  email: "arjun@test.com",
  mobile: "9876543210",
  rwaid: "EDEN-001",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  photoUrl: null,
  idProofUrl: null,
  ownershipProofUrl: null,
  isEmailVerified: false,
  bloodGroup: null,
  householdStatus: "NOT_SET",
  vehicleStatus: "NOT_SET",
  consentWhatsapp: false,
  showInDirectory: false,
  showPhoneInDirectory: false,
  society: { name: "Greenwood Residency", societyCode: "GRNW" },
  userUnits: [{ unit: { id: "unit-1", displayLabel: "A-101" } }],
  governingBodyMembership: null,
};

describe("GET /api/v1/residents/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([0, 0, null]);
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
    mockPrisma.user.findFirst.mockResolvedValue(userFixture);

    const res = await GET();
    const body = await res.json();

    expect(body.id).toBe("u1");
    expect(body.name).toBe("Arjun Kapoor");
    expect(body.email).toBe("arjun@test.com");
    expect(body.mobile).toBe("9876543210");
    expect(body.rwaid).toBe("EDEN-001");
    expect(body.status).toBe("ACTIVE_PAID");
    expect(body.ownershipType).toBe("OWNER");
    expect(body.bloodGroup).toBeNull();
    expect(body.householdStatus).toBe("NOT_SET");
    expect(body.vehicleStatus).toBe("NOT_SET");
    expect(body.showInDirectory).toBe(false);
    expect(body.societyName).toBe("Greenwood Residency");
    expect(body.unit).toBe("A-101");
    expect(body.units).toEqual([{ id: "unit-1", displayLabel: "A-101" }]);
    expect(body.showPhoneInDirectory).toBe(false);
    expect(body.designation).toBeNull();
    expect(body.completeness).toBeDefined();
    expect(body.completeness.percentage).toBe(10); // mobile only → A2 (10/100)
  });

  it("returns designation when user is governing body member", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      ...userFixture,
      userUnits: [],
      governingBodyMembership: { designation: { name: "President" } },
    });

    const res = await GET();
    const body = await res.json();
    expect(body.designation).toBe("President");
    expect(body.unit).toBeNull();
    expect(body.units).toEqual([]);
  });

  it("returns current fee data when fee record exists", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(userFixture);
    mockPrisma.$transaction.mockResolvedValue([
      0,
      0,
      {
        sessionYear: "2025-26",
        amountDue: 1200,
        amountPaid: 1200,
        status: "PAID",
      },
    ]);

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
    mockPrisma.user.findFirst.mockResolvedValue(userFixture);

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
    mockPrisma.user.findFirst.mockResolvedValue(userFixture);

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

  it("includes completeness object based on user data", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      ...userFixture,
      photoUrl: "photo.jpg",
      isEmailVerified: true,
      bloodGroup: "O_POS",
      idProofUrl: "id.pdf",
      ownershipProofUrl: "proof.pdf",
      householdStatus: "HAS_ENTRIES",
      vehicleStatus: "HAS_ENTRIES",
    });
    mockPrisma.$transaction.mockResolvedValue([1, 1, null]);

    const res = await GET();
    const body = await res.json();
    expect(body.completeness.percentage).toBe(100);
    expect(body.completeness.tier).toBe("VERIFIED");
    expect(body.completeness.items).toHaveLength(9);
    expect(body.completeness.nextIncompleteItem).toBeNull();
  });

  it("completeness reflects missing photo as incomplete", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(userFixture);

    const res = await GET();
    const body = await res.json();
    expect(body.completeness.nextIncompleteItem.key).toBe("A1");
    expect(body.completeness.items.find((i: { key: string }) => i.key === "A1").completed).toBe(
      false,
    );
  });

  it("returns null societyName when society relation is missing", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      ...userFixture,
      society: null,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.societyName).toBeNull();
  });

  it("handles server errors gracefully", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
