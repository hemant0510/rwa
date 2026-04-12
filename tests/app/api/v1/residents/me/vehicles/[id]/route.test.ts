import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../__mocks__/prisma";
import { mockSupabaseClient } from "../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { PATCH, DELETE } from "@/app/api/v1/residents/me/vehicles/[id]/route";

const mockResident = {
  id: "user-1",
  societyId: "soc-1",
};

const mockVehicle = {
  id: "veh-1",
  unitId: "unit-1",
  societyId: "soc-1",
  vehicleType: "FOUR_WHEELER",
  registrationNumber: "DL3CAB1234",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  parkingSlot: "A-1",
  fastagId: null,
  notes: null,
  ownerId: "user-1",
  dependentOwnerId: null,
  vehiclePhotoUrl: null,
  rcDocUrl: null,
  insuranceUrl: null,
  rcExpiry: null,
  insuranceExpiry: null,
  pucExpiry: null,
  isActive: true,
  createdAt: new Date("2026-04-01T00:00:00Z"),
  updatedAt: new Date("2026-04-01T00:00:00Z"),
  owner: { name: "Resident User" },
  dependentOwner: null,
};

const makeRequest = (method: string, body?: object) =>
  new Request(`http://localhost/api/v1/residents/me/vehicles/veh-1`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }) as never;

const makeContext = (id = "veh-1") => ({
  params: Promise.resolve({ id }),
});

// ── PATCH ──────────────────────────────────────────────────────────────────

describe("PATCH /api/v1/residents/me/vehicles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.vehicle.findUnique.mockResolvedValue(mockVehicle);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.vehicle.update.mockResolvedValue({ ...mockVehicle, colour: "Blue" });
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 404 when vehicle does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when vehicle belongs to another user", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({ ...mockVehicle, ownerId: "other-user" });
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 422 on validation failure", async () => {
    const res = await PATCH(makeRequest("PATCH", { vehicleType: "HELICOPTER" }), makeContext());
    expect(res.status).toBe(422);
  });

  it("updates vehicle and returns 200 with vehicle data", async () => {
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicle).toBeDefined();
    expect(body.vehicle.colour).toBe("Blue");
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "veh-1" } }),
    );
  });

  it("re-normalises registration number when provided", async () => {
    mockPrisma.vehicle.update.mockResolvedValue({
      ...mockVehicle,
      registrationNumber: "MH12AB3456",
    });
    const res = await PATCH(
      makeRequest("PATCH", { registrationNumber: "mh-12ab-3456" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationNumber: "MH12AB3456" }),
      }),
    );
  });

  it("converts rcExpiry string to Date object", async () => {
    mockPrisma.vehicle.update.mockResolvedValue({
      ...mockVehicle,
      rcExpiry: new Date("2030-01-01"),
    });
    const res = await PATCH(makeRequest("PATCH", { rcExpiry: "2030-01-01" }), makeContext());
    expect(res.status).toBe(200);
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rcExpiry: new Date("2030-01-01") }),
      }),
    );
  });

  it("converts insuranceExpiry and pucExpiry strings to Date objects", async () => {
    mockPrisma.vehicle.update.mockResolvedValue({
      ...mockVehicle,
      insuranceExpiry: new Date("2027-06-30"),
      pucExpiry: new Date("2026-11-15"),
    });
    const res = await PATCH(
      makeRequest("PATCH", { insuranceExpiry: "2027-06-30", pucExpiry: "2026-11-15" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          insuranceExpiry: new Date("2027-06-30"),
          pucExpiry: new Date("2026-11-15"),
        }),
      }),
    );
  });

  it("applies societyId filter when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("soc-1");
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "soc-1" }) }),
    );
  });

  it("writes audit log with VEHICLE_UPDATED action", async () => {
    await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "VEHICLE_UPDATED" }),
      }),
    );
  });

  it("returns rcDocUrl as null (raw path never exposed)", async () => {
    mockPrisma.vehicle.update.mockResolvedValue({ ...mockVehicle, rcDocUrl: "soc-1/veh-1/rc.pdf" });
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    const body = await res.json();
    expect(body.vehicle.rcDocUrl).toBeNull();
    expect(body.vehicle.insuranceUrl).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeRequest("PATCH", { colour: "Blue" }), makeContext());
    expect(res.status).toBe(500);
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────────

describe("DELETE /api/v1/residents/me/vehicles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.vehicle.findUnique.mockResolvedValue(mockVehicle);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.vehicle.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.vehicle.count.mockResolvedValue(1); // still has vehicles
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await DELETE(makeRequest("DELETE"), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 404 when vehicle does not exist", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when vehicle belongs to another user", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({ ...mockVehicle, ownerId: "other-user" });
    const res = await DELETE(makeRequest("DELETE"), makeContext());
    expect(res.status).toBe(404);
  });

  it("soft-deletes vehicle and returns success", async () => {
    const res = await DELETE(makeRequest("DELETE"), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it("writes audit log with VEHICLE_DEACTIVATED action", async () => {
    await DELETE(makeRequest("DELETE"), makeContext());
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "VEHICLE_DEACTIVATED" }),
      }),
    );
  });

  it("reverts vehicleStatus to NOT_SET when last vehicle is deactivated", async () => {
    mockPrisma.vehicle.count.mockResolvedValue(0); // no more active vehicles
    await DELETE(makeRequest("DELETE"), makeContext());
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { vehicleStatus: "NOT_SET" },
      }),
    );
  });

  it("does not revert vehicleStatus when other vehicles remain", async () => {
    mockPrisma.vehicle.count.mockResolvedValue(2); // still has others
    await DELETE(makeRequest("DELETE"), makeContext());
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await DELETE(makeRequest("DELETE"), makeContext());
    expect(res.status).toBe(500);
  });
});
