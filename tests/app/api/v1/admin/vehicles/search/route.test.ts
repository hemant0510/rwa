import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (inline — admin pattern) ─────────────────────────────────
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  vehicle: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Import after mocks ─────────────────────────────────────────────────────
import { GET } from "@/app/api/v1/admin/vehicles/search/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const mockVehicleResult = {
  id: "veh-1",
  registrationNumber: "DL3CAB1234",
  vehicleType: "FOUR_WHEELER",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  unit: { displayLabel: "A-101" },
  owner: { name: "Resident User", mobile: "9876543210", email: "user@example.com" },
  dependentOwner: null,
};

const makeRequest = (params: Record<string, string> = {}) => {
  const url = new URL("http://localhost/api/v1/admin/vehicles/search");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as never;
};

describe("GET /api/v1/admin/vehicles/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.vehicle.findMany.mockResolvedValue([mockVehicleResult]);
    mockPrisma.vehicle.count.mockResolvedValue(1);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest({ q: "DL3" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when query is shorter than 3 characters", async () => {
    const res = await GET(makeRequest({ q: "DL" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("QUERY_TOO_SHORT");
  });

  it("returns 400 when q param is absent", async () => {
    const req = new Request("http://localhost/api/v1/admin/vehicles/search") as never;
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns matching vehicles on valid query", async () => {
    const res = await GET(makeRequest({ q: "DL3" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].registrationNumber).toBe("DL3CAB1234");
  });

  it("includes mobile and email in response (admin has full detail)", async () => {
    const res = await GET(makeRequest({ q: "DL3" }));
    const body = await res.json();
    const vehicle = body.vehicles[0];
    expect(vehicle.owner.mobile).toBe("9876543210");
    expect(vehicle.owner.email).toBe("user@example.com");
  });

  it("returns pagination metadata", async () => {
    const res = await GET(makeRequest({ q: "DL3", page: "1", limit: "20" }));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("scopes query to admin's societyId from session", async () => {
    await GET(makeRequest({ q: "DL3" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-1" }),
      }),
    );
  });

  it("normalizes query before searching (strips hyphens, uppercases)", async () => {
    await GET(makeRequest({ q: "dl-3cab" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              registrationNumber: { contains: "DL3CAB", mode: "insensitive" },
            }),
          ]),
        }),
      }),
    );
  });

  it("sorts by registrationNumber when sort=reg (default)", async () => {
    await GET(makeRequest({ q: "DL3" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { registrationNumber: "asc" } }),
    );
  });

  it("sorts by vehicleType when sort=type", async () => {
    await GET(makeRequest({ q: "DL3", sort: "type" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { vehicleType: "asc" } }),
    );
  });

  it("sorts by unit displayLabel when sort=unit", async () => {
    await GET(makeRequest({ q: "DL3", sort: "unit" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { unit: { displayLabel: "asc" } } }),
    );
  });

  it("falls back to reg sort when sort param is invalid", async () => {
    await GET(makeRequest({ q: "DL3", sort: "invalid" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { registrationNumber: "asc" } }),
    );
  });

  it("applies pagination skip and take", async () => {
    await GET(makeRequest({ q: "DL3", page: "2", limit: "10" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("defaults page and limit when non-numeric values are passed", async () => {
    await GET(makeRequest({ q: "DL3", page: "abc", limit: "xyz" }));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("returns empty list when no vehicles match", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    mockPrisma.vehicle.count.mockResolvedValue(0);
    const res = await GET(makeRequest({ q: "XYZ" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest({ q: "DL3" }));
    expect(res.status).toBe(500);
  });
});
