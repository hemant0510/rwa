import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  vehicle: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/get-current-user", () => ({ getFullAccessAdmin: mockGetFullAccessAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "@/app/api/v1/admin/vehicles/[vehicleId]/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockExistingVehicle = {
  id: "veh-1",
  societyId: "soc-1",
  parkingSlot: "A-1",
  stickerNumber: null,
  evSlot: null,
  validFrom: null,
  validTo: null,
};

const mockUpdatedVehicle = {
  id: "veh-1",
  registrationNumber: "DL3CAB1234",
  parkingSlot: "B-2",
  stickerNumber: "ST-100",
  evSlot: "EV-5",
  validFrom: new Date("2026-01-01T00:00:00Z"),
  validTo: new Date("2027-01-01T00:00:00Z"),
  unit: { displayLabel: "A-101" },
  owner: { id: "user-1", name: "Resident" },
  dependentOwner: null,
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/admin/vehicles/veh-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

const makeContext = (vehicleId = "veh-1") => ({
  params: Promise.resolve({ vehicleId }),
});

describe("PATCH /api/v1/admin/vehicles/[vehicleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.vehicle.findUnique.mockResolvedValue(mockExistingVehicle);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.vehicle.update.mockResolvedValue(mockUpdatedVehicle);
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("returns 403 when user is not admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns 404 when vehicle is not found", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 403 when vehicle belongs to a different society", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({
      ...mockExistingVehicle,
      societyId: "other-soc",
    });
    const res = await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns 422 when body contains a disallowed field (e.g. registrationNumber)", async () => {
    const res = await PATCH(
      makeRequest({ registrationNumber: "HR26AB1234", parkingSlot: "B-2" }),
      makeContext(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when parkingSlot exceeds 20 chars", async () => {
    const res = await PATCH(makeRequest({ parkingSlot: "A".repeat(21) }), makeContext());
    expect(res.status).toBe(422);
  });

  it("updates allowed fields and returns 200", async () => {
    const res = await PATCH(
      makeRequest({
        parkingSlot: "B-2",
        stickerNumber: "ST-100",
        evSlot: "EV-5",
        validFrom: "2026-01-01",
        validTo: "2027-01-01",
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicle).toBeDefined();
    expect(body.vehicle.parkingSlot).toBe("B-2");
  });

  it("converts validFrom and validTo strings to Date objects", async () => {
    await PATCH(makeRequest({ validFrom: "2026-01-01", validTo: "2027-01-01" }), makeContext());
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validFrom: new Date("2026-01-01"),
          validTo: new Date("2027-01-01"),
        }),
      }),
    );
  });

  it("writes null directly (not a Date) when validFrom/validTo set to null", async () => {
    await PATCH(makeRequest({ validFrom: null, validTo: null }), makeContext());
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ validFrom: null, validTo: null }),
      }),
    );
  });

  it("allows null values for parkingSlot, stickerNumber, evSlot (to clear them)", async () => {
    await PATCH(
      makeRequest({ parkingSlot: null, stickerNumber: null, evSlot: null }),
      makeContext(),
    );
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parkingSlot: null,
          stickerNumber: null,
          evSlot: null,
        }),
      }),
    );
  });

  it("writes audit log with VEHICLE_SLOT_ASSIGNED action", async () => {
    await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "VEHICLE_SLOT_ASSIGNED",
          entityType: "Vehicle",
          entityId: "veh-1",
        }),
      }),
    );
  });

  it("audit log captures old and new values", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({
      ...mockExistingVehicle,
      parkingSlot: "A-1",
      validFrom: new Date("2025-01-01T00:00:00Z"),
    });
    await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    const auditCall = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.oldValue.parkingSlot).toBe("A-1");
    expect(auditCall.data.oldValue.validFrom).toBe("2025-01-01T00:00:00.000Z");
    expect(auditCall.data.newValue.parkingSlot).toBe("B-2");
  });

  it("returns formatted dates (YYYY-MM-DD) in response", async () => {
    const res = await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    const body = await res.json();
    expect(body.vehicle.validFrom).toBe("2026-01-01");
    expect(body.vehicle.validTo).toBe("2027-01-01");
  });

  it("returns null dates when vehicle has no validFrom/validTo", async () => {
    mockPrisma.vehicle.update.mockResolvedValue({
      ...mockUpdatedVehicle,
      validFrom: null,
      validTo: null,
    });
    const res = await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    const body = await res.json();
    expect(body.vehicle.validFrom).toBeNull();
    expect(body.vehicle.validTo).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeRequest({ parkingSlot: "B-2" }), makeContext());
    expect(res.status).toBe(500);
  });
});
