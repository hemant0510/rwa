import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userUnit: { findMany: vi.fn() },
  vehicle: { findMany: vi.fn() },
}));
const mockStorageBucket = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/get-current-user", () => ({ getFullAccessAdmin: mockGetFullAccessAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => mockStorageBucket } }),
}));

import { GET } from "@/app/api/v1/residents/[id]/vehicles/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockResident = { id: "user-1", societyId: "soc-1", role: "RESIDENT" };

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
  stickerNumber: null,
  evSlot: null,
  validFrom: null,
  validTo: null,
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
  owner: { id: "user-1", name: "Resident User" },
  dependentOwner: null,
  unit: { displayLabel: "A-101" },
};

const makeRequest = () => new Request("http://localhost/api/v1/residents/user-1/vehicles") as never;

const makeContext = (id = "user-1") => ({
  params: Promise.resolve({ id }),
});

describe("GET /api/v1/residents/[id]/vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
    mockPrisma.userUnit.findMany.mockResolvedValue([{ unitId: "unit-1" }]);
    mockPrisma.vehicle.findMany.mockResolvedValue([mockVehicle]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
  });

  it("returns 403 when user is not admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns 404 when resident is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 404 when target user is not a RESIDENT", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, role: "RWA_ADMIN" });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 403 when resident belongs to a different society", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, societyId: "other-soc" });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns all vehicles for the resident's units", async () => {
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].registrationNumber).toBe("DL3CAB1234");
  });

  it("queries vehicles filtered by unitIds belonging to the resident", async () => {
    await GET(makeRequest(), makeContext());
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: { in: ["unit-1"] } },
      }),
    );
  });

  it("orders vehicles by isActive desc then createdAt asc", async () => {
    await GET(makeRequest(), makeContext());
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      }),
    );
  });

  it("includes inactive vehicles (no isActive filter)", async () => {
    const inactive = { ...mockVehicle, id: "veh-2", isActive: false };
    mockPrisma.vehicle.findMany.mockResolvedValue([inactive]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].isActive).toBe(false);
  });

  it("generates signed URLs for rcDocUrl and insuranceUrl when present", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      { ...mockVehicle, rcDocUrl: "soc-1/veh-1/rc.pdf", insuranceUrl: "soc-1/veh-1/ins.pdf" },
    ]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    });
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].rcDocSignedUrl).toBe("https://example.com/signed");
    expect(body.vehicles[0].insuranceSignedUrl).toBe("https://example.com/signed");
    expect(body.vehicles[0].rcDocUrl).toBeNull();
    expect(body.vehicles[0].insuranceUrl).toBeNull();
  });

  it("returns null signed URLs when doc paths are missing", async () => {
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].rcDocSignedUrl).toBeNull();
    expect(body.vehicles[0].insuranceSignedUrl).toBeNull();
    expect(mockStorageBucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("falls back to null when signed URL generation fails", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      { ...mockVehicle, rcDocUrl: "soc-1/veh-1/rc.pdf" },
    ]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "fail" },
    });
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].rcDocSignedUrl).toBeNull();
  });

  it("formats expiry dates as YYYY-MM-DD", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        ...mockVehicle,
        rcExpiry: new Date("2030-01-15T00:00:00Z"),
        insuranceExpiry: new Date("2027-06-30T00:00:00Z"),
        pucExpiry: new Date("2026-11-15T00:00:00Z"),
        validFrom: new Date("2026-01-01T00:00:00Z"),
        validTo: new Date("2027-01-01T00:00:00Z"),
      },
    ]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].rcExpiry).toBe("2030-01-15");
    expect(body.vehicles[0].insuranceExpiry).toBe("2027-06-30");
    expect(body.vehicles[0].pucExpiry).toBe("2026-11-15");
    expect(body.vehicles[0].validFrom).toBe("2026-01-01");
    expect(body.vehicles[0].validTo).toBe("2027-01-01");
  });

  it("computes expiry statuses", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    mockPrisma.vehicle.findMany.mockResolvedValue([
      { ...mockVehicle, rcExpiry: future, insuranceExpiry: future, pucExpiry: future },
    ]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].rcStatus).toBe("VALID");
    expect(body.vehicles[0].insuranceStatus).toBe("VALID");
    expect(body.vehicles[0].pucStatus).toBe("VALID");
  });

  it("includes admin-only fields like stickerNumber, evSlot, parkingSlot, unit.displayLabel", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      { ...mockVehicle, stickerNumber: "ST-100", evSlot: "EV-5", parkingSlot: "P-10" },
    ]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.vehicles[0].stickerNumber).toBe("ST-100");
    expect(body.vehicles[0].evSlot).toBe("EV-5");
    expect(body.vehicles[0].parkingSlot).toBe("P-10");
    expect(body.vehicles[0].unit.displayLabel).toBe("A-101");
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(500);
  });
});
