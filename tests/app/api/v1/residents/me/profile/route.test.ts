import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../__mocks__/prisma";
import { mockSupabaseClient } from "../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { PATCH } from "@/app/api/v1/residents/me/profile/route";

const mockResident = { id: "user-1" };

const updatedUserFixture = {
  id: "user-1",
  photoUrl: null,
  mobile: null,
  isEmailVerified: false,
  bloodGroup: "O_POS",
  idProofUrl: null,
  ownershipProofUrl: null,
  ownershipType: "OWNER",
  householdStatus: "NOT_SET",
  vehicleStatus: "NOT_SET",
  consentWhatsapp: false,
  showInDirectory: false,
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/residents/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/v1/residents/me/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.user.update.mockResolvedValue(updatedUserFixture);
    mockPrisma.$transaction.mockResolvedValue([0, 0]);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await PATCH(makeRequest({ bloodGroup: "O_POS" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when no matching resident is found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ bloodGroup: "O_POS" }));
    expect(res.status).toBe(401);
  });

  it("uses activeSocietyId when set", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-99");
    await PATCH(makeRequest({ bloodGroup: "O_POS" }));
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-99" }),
      }),
    );
  });

  it("returns 422 when body contains unknown fields", async () => {
    const res = await PATCH(makeRequest({ foo: "bar" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when bloodGroup is invalid enum", async () => {
    const res = await PATCH(makeRequest({ bloodGroup: "INVALID" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when householdStatus is HAS_ENTRIES (not allowed directly)", async () => {
    const res = await PATCH(makeRequest({ householdStatus: "HAS_ENTRIES" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when vehicleStatus is HAS_ENTRIES (not allowed directly)", async () => {
    const res = await PATCH(makeRequest({ vehicleStatus: "HAS_ENTRIES" }));
    expect(res.status).toBe(422);
  });

  it("returns 400 when no fields provided", async () => {
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("updates bloodGroup with valid enum value", async () => {
    mockPrisma.user.update.mockResolvedValue({ ...updatedUserFixture, bloodGroup: "B_POS" });
    const res = await PATCH(makeRequest({ bloodGroup: "B_POS" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { bloodGroup: "B_POS" },
      }),
    );
    const body = await res.json();
    expect(body.bloodGroup).toBe("B_POS");
    expect(body.completeness).toBeDefined();
  });

  it("accepts householdStatus=DECLARED_NONE", async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...updatedUserFixture,
      householdStatus: "DECLARED_NONE",
    });
    const res = await PATCH(makeRequest({ householdStatus: "DECLARED_NONE" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.householdStatus).toBe("DECLARED_NONE");
  });

  it("accepts householdStatus=NOT_SET (can revert)", async () => {
    mockPrisma.user.update.mockResolvedValue({ ...updatedUserFixture, householdStatus: "NOT_SET" });
    const res = await PATCH(makeRequest({ householdStatus: "NOT_SET" }));
    expect(res.status).toBe(200);
  });

  it("accepts vehicleStatus=DECLARED_NONE", async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...updatedUserFixture,
      vehicleStatus: "DECLARED_NONE",
    });
    const res = await PATCH(makeRequest({ vehicleStatus: "DECLARED_NONE" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicleStatus).toBe("DECLARED_NONE");
  });

  it("accepts multiple declarations at once", async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...updatedUserFixture,
      bloodGroup: "AB_NEG",
      householdStatus: "DECLARED_NONE",
      vehicleStatus: "DECLARED_NONE",
    });
    const res = await PATCH(
      makeRequest({
        bloodGroup: "AB_NEG",
        householdStatus: "DECLARED_NONE",
        vehicleStatus: "DECLARED_NONE",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bloodGroup: "AB_NEG",
          householdStatus: "DECLARED_NONE",
          vehicleStatus: "DECLARED_NONE",
        },
      }),
    );
  });

  it("returns completeness reflecting emergency contact presence", async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...updatedUserFixture,
      photoUrl: "photo.jpg",
      mobile: "9876543210",
      isEmailVerified: true,
      bloodGroup: "O_POS",
      idProofUrl: "id.pdf",
      ownershipProofUrl: "proof.pdf",
      householdStatus: "HAS_ENTRIES",
      vehicleStatus: "HAS_ENTRIES",
    });
    mockPrisma.$transaction.mockResolvedValue([1, 1]);

    const res = await PATCH(makeRequest({ bloodGroup: "O_POS" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completeness.percentage).toBe(100);
    expect(body.completeness.tier).toBe("VERIFIED");
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeRequest({ bloodGroup: "O_POS" }));
    expect(res.status).toBe(500);
  });
});
