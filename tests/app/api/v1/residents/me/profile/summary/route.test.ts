import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../__mocks__/prisma";
import { mockSupabaseClient } from "../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { GET } from "@/app/api/v1/residents/me/profile/summary/route";

const mockResident = {
  id: "user-1",
  showInDirectory: true,
  showPhoneInDirectory: false,
};

const futureDate = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const pastDate = (days: number) => futureDate(-days);

describe("GET /api/v1/residents/me/profile/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.dependent.count.mockResolvedValue(0);
    mockPrisma.vehicle.count.mockResolvedValue(0);
    mockPrisma.dependent.findMany.mockResolvedValue([]);
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when no matching resident is found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("uses activeSocietyId when set", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-99");
    await GET();
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-99" }),
      }),
    );
  });

  it("returns zero counts and empty arrays when resident has no family or vehicles", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      familyCount: 0,
      vehicleCount: 0,
      firstVehicleReg: null,
      emergencyContacts: [],
      vehicleExpiryAlerts: [],
      directoryOptIn: true,
      showPhoneInDirectory: false,
    });
  });

  it("returns familyCount and vehicleCount", async () => {
    mockPrisma.dependent.count.mockResolvedValue(3);
    mockPrisma.vehicle.count.mockResolvedValue(2);
    const res = await GET();
    const body = await res.json();
    expect(body.familyCount).toBe(3);
    expect(body.vehicleCount).toBe(2);
  });

  it("returns emergency contacts ordered by priority", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([
      { name: "Priya", relationship: "SPOUSE", mobile: "9876543210", bloodGroup: "O_POS" },
      { name: "Aarav", relationship: "CHILD", mobile: null, bloodGroup: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.emergencyContacts).toHaveLength(2);
    expect(body.emergencyContacts[0].name).toBe("Priya");
    expect(body.emergencyContacts[1].bloodGroup).toBeNull();
    expect(mockPrisma.dependent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isActive: true, isEmergencyContact: true },
        orderBy: [{ emergencyPriority: "asc" }, { memberSeq: "asc" }],
      }),
    );
  });

  it("excludes vehicles with all VALID documents from vehicleExpiryAlerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v1",
        registrationNumber: "DL3CAB1234",
        rcExpiry: futureDate(400),
        insuranceExpiry: futureDate(400),
        pucExpiry: futureDate(400),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toEqual([]);
  });

  it("includes vehicle with any EXPIRED document in alerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v1",
        registrationNumber: "DL3CAB1234",
        rcExpiry: pastDate(5),
        insuranceExpiry: futureDate(400),
        pucExpiry: futureDate(400),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toHaveLength(1);
    expect(body.vehicleExpiryAlerts[0].rcStatus).toBe("EXPIRED");
  });

  it("includes vehicle with EXPIRING_SOON insurance in alerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v2",
        registrationNumber: "MH12AB5678",
        rcExpiry: futureDate(400),
        insuranceExpiry: futureDate(10),
        pucExpiry: futureDate(400),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toHaveLength(1);
    expect(body.vehicleExpiryAlerts[0].insuranceStatus).toBe("EXPIRING_SOON");
  });

  it("includes vehicle with EXPIRING_SOON puc in alerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v3",
        registrationNumber: "HR26CD7890",
        rcExpiry: futureDate(400),
        insuranceExpiry: futureDate(400),
        pucExpiry: futureDate(20),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toHaveLength(1);
    expect(body.vehicleExpiryAlerts[0].pucStatus).toBe("EXPIRING_SOON");
  });

  it("includes vehicle with EXPIRING_SOON rc in alerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v4",
        registrationNumber: "KA01EF1234",
        rcExpiry: futureDate(15),
        insuranceExpiry: futureDate(400),
        pucExpiry: futureDate(400),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toHaveLength(1);
    expect(body.vehicleExpiryAlerts[0].rcStatus).toBe("EXPIRING_SOON");
  });

  it("includes vehicle with EXPIRED insurance in alerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v5",
        registrationNumber: "TN22GH5678",
        rcExpiry: futureDate(400),
        insuranceExpiry: pastDate(10),
        pucExpiry: futureDate(400),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toHaveLength(1);
    expect(body.vehicleExpiryAlerts[0].insuranceStatus).toBe("EXPIRED");
  });

  it("includes vehicle with EXPIRED puc in alerts", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v6",
        registrationNumber: "GJ03IJ9012",
        rcExpiry: futureDate(400),
        insuranceExpiry: futureDate(400),
        pucExpiry: pastDate(5),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toHaveLength(1);
    expect(body.vehicleExpiryAlerts[0].pucStatus).toBe("EXPIRED");
  });

  it("filters out vehicles with only NOT_SET (null) documents", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v7",
        registrationNumber: "NOT_SET_VEH",
        rcExpiry: null,
        insuranceExpiry: null,
        pucExpiry: null,
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.vehicleExpiryAlerts).toEqual([]);
  });

  it("exposes directoryOptIn and showPhoneInDirectory from the resident record", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      showInDirectory: false,
      showPhoneInDirectory: true,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.directoryOptIn).toBe(false);
    expect(body.showPhoneInDirectory).toBe(true);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.count.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
