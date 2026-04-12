import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { GET, POST } from "@/app/api/v1/residents/me/vehicles/route";

const mockResident = {
  id: "user-1",
  societyId: "soc-1",
};

const mockVehicleDb = {
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

const makeGetRequest = (params: Record<string, string> = {}) => {
  const url = new URL("http://localhost/api/v1/residents/me/vehicles");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as never;
};

const makePostRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/residents/me/vehicles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

// ── GET /api/v1/residents/me/vehicles ──────────────────────────────────────

describe("GET /api/v1/residents/me/vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.userUnit.findMany.mockResolvedValue([{ unitId: "unit-1" }]);
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    mockPrisma.vehicle.count.mockResolvedValue(0);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns empty list with pagination metadata when no vehicles", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("returns vehicles with correct shape and computed expiry statuses", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([mockVehicleDb]);
    mockPrisma.vehicle.count.mockResolvedValue(1);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].id).toBe("veh-1");
    expect(body.vehicles[0].registrationNumber).toBe("DL3CAB1234");
    expect(body.vehicles[0].rcStatus).toBe("NOT_SET");
    expect(body.vehicles[0].insuranceStatus).toBe("NOT_SET");
    expect(body.vehicles[0].pucStatus).toBe("NOT_SET");
    expect(body.total).toBe(1);
  });

  it("returns signed URLs when rcDocUrl and insuranceUrl are set", async () => {
    const vehicleWithDocs = {
      ...mockVehicleDb,
      rcDocUrl: "soc-1/veh-1/rc.pdf",
      insuranceUrl: "soc-1/veh-1/insurance.pdf",
    };
    mockPrisma.vehicle.findMany.mockResolvedValue([vehicleWithDocs]);
    mockPrisma.vehicle.count.mockResolvedValue(1);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    });
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.vehicles[0].rcDocSignedUrl).toBe("https://example.com/signed");
    expect(body.vehicles[0].insuranceSignedUrl).toBe("https://example.com/signed");
    // Raw storage paths are never exposed
    expect(body.vehicles[0].rcDocUrl).toBeNull();
    expect(body.vehicles[0].insuranceUrl).toBeNull();
  });

  it("returns null signed URLs when rcDocUrl and insuranceUrl are null", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([mockVehicleDb]);
    mockPrisma.vehicle.count.mockResolvedValue(1);
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.vehicles[0].rcDocSignedUrl).toBeNull();
    expect(body.vehicles[0].insuranceSignedUrl).toBeNull();
    expect(mockStorageBucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null signed URLs when signed URL generation fails", async () => {
    const vehicleWithDoc = { ...mockVehicleDb, rcDocUrl: "soc-1/veh-1/rc.pdf" };
    mockPrisma.vehicle.findMany.mockResolvedValue([vehicleWithDoc]);
    mockPrisma.vehicle.count.mockResolvedValue(1);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "fail" } });
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.vehicles[0].rcDocSignedUrl).toBeNull();
  });

  it("applies societyId filter when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("soc-1");
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "soc-1" }) }),
    );
  });

  it("respects page and limit query params", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    const res = await GET(makeGetRequest({ page: "2", limit: "5" }));
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.limit).toBe(5);
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it("returns VALID status for future expiry dates", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const vehicleWithExpiry = {
      ...mockVehicleDb,
      rcExpiry: future,
      insuranceExpiry: future,
      pucExpiry: future,
    };
    mockPrisma.vehicle.findMany.mockResolvedValue([vehicleWithExpiry]);
    mockPrisma.vehicle.count.mockResolvedValue(1);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.vehicles[0].rcStatus).toBe("VALID");
    expect(body.vehicles[0].insuranceStatus).toBe("VALID");
    expect(body.vehicles[0].pucStatus).toBe("VALID");
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/residents/me/vehicles ─────────────────────────────────────

describe("POST /api/v1/residents/me/vehicles", () => {
  const validUnitId = "00000000-0000-4000-8000-000000000001";
  const validBody = {
    registrationNumber: "DL3CAB1234",
    vehicleType: "FOUR_WHEELER",
    unitId: validUnitId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.userUnit.findMany.mockResolvedValue([{ userId: "user-1", unitId: validUnitId }]);
    mockPrisma.society.findUnique.mockResolvedValue({ maxVehiclesPerUnit: 0 }); // 0 = no limit
    mockPrisma.vehicle.findFirst.mockResolvedValue(null); // no duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.vehicle.create.mockResolvedValue({ ...mockVehicleDb, unitId: validUnitId });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 422 on validation failure", async () => {
    const res = await POST(
      makePostRequest({
        registrationNumber: "BADFORMAT",
        vehicleType: "FOUR_WHEELER",
        unitId: validUnitId,
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 403 when unitId does not belong to resident", async () => {
    mockPrisma.userUnit.findMany.mockResolvedValue([]);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 422 when vehicle limit is exceeded", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ maxVehiclesPerUnit: 2 });
    mockPrisma.vehicle.count.mockResolvedValue(2);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("LIMIT_EXCEEDED");
  });

  it("does not enforce limit when maxVehiclesPerUnit is 0", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ maxVehiclesPerUnit: 0 });
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    expect(mockPrisma.vehicle.count).not.toHaveBeenCalled();
  });

  it("returns 409 when registration number is duplicate in society", async () => {
    mockPrisma.vehicle.findFirst.mockResolvedValue({
      id: "veh-existing",
      unit: { unitNumber: "A-101" },
    });
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("DUPLICATE_REG");
  });

  it("creates vehicle and returns 201 with vehicle data", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.vehicle).toBeDefined();
    expect(body.vehicle.registrationNumber).toBe("DL3CAB1234");
  });

  it("normalizes registration number to uppercase without separators", async () => {
    await POST(makePostRequest({ ...validBody, registrationNumber: "dl-3cab-1234" }));
    expect(mockPrisma.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationNumber: "DL3CAB1234" }),
      }),
    );
  });

  it("sets vehicleStatus to HAS_ENTRIES on the owner", async () => {
    await POST(makePostRequest(validBody));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { vehicleStatus: "HAS_ENTRIES" },
      }),
    );
  });

  it("writes audit log with VEHICLE_ADDED action", async () => {
    await POST(makePostRequest(validBody));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "VEHICLE_ADDED" }),
      }),
    );
  });

  it("creates vehicle with optional fields when provided", async () => {
    const bodyWithOptionals = {
      ...validBody,
      make: "Maruti",
      model: "Swift",
      colour: "White",
      parkingSlot: "A-1",
      rcExpiry: "2030-01-01",
      insuranceExpiry: "2027-06-30",
      pucExpiry: "2026-11-15",
    };
    mockPrisma.vehicle.create.mockResolvedValue({
      ...mockVehicleDb,
      unitId: validUnitId,
      rcExpiry: new Date("2030-01-01"),
      insuranceExpiry: new Date("2027-06-30"),
      pucExpiry: new Date("2026-11-15"),
    });
    const res = await POST(makePostRequest(bodyWithOptionals));
    expect(res.status).toBe(201);
    expect(mockPrisma.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          make: "Maruti",
          parkingSlot: "A-1",
          rcExpiry: new Date("2030-01-01"),
        }),
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.userUnit.findMany.mockRejectedValue(new Error("DB error"));
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
  });
});
