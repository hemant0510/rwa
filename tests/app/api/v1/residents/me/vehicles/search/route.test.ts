import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../__mocks__/prisma";
import { mockSupabaseClient } from "../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

// eslint-disable-next-line import/order
import { GET } from "@/app/api/v1/residents/me/vehicles/search/route";

const mockResident = { id: "user-1", societyId: "soc-1" };

const mockVehicleResult = {
  id: "veh-1",
  registrationNumber: "DL3CAB1234",
  vehicleType: "FOUR_WHEELER",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  unit: { displayLabel: "A-101" },
  owner: { name: "Resident User" },
  dependentOwner: null,
};

const makeRequest = (q = "DL3") =>
  new Request(
    `http://localhost/api/v1/residents/me/vehicles/search?q=${encodeURIComponent(q)}`,
  ) as never;

describe("GET /api/v1/residents/me/vehicles/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.society.findUnique.mockResolvedValue({ allowResidentVehicleSearch: true });
    mockPrisma.vehicle.findMany.mockResolvedValue([mockVehicleResult]);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when society disables vehicle search", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ allowResidentVehicleSearch: false });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 when query is shorter than 3 characters", async () => {
    const res = await GET(makeRequest("DL"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("QUERY_TOO_SHORT");
  });

  it("returns 400 for empty query", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when q param is absent", async () => {
    const req = new Request("http://localhost/api/v1/residents/me/vehicles/search") as never;
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns matching vehicles on valid query", async () => {
    const res = await GET(makeRequest("DL3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0].registrationNumber).toBe("DL3CAB1234");
  });

  it("does NOT include mobile or email in response (privacy)", async () => {
    const res = await GET(makeRequest("swift"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const vehicle = body.vehicles[0];
    expect(vehicle.owner).toBeDefined();
    expect(vehicle.owner.mobile).toBeUndefined();
    expect(vehicle.owner.email).toBeUndefined();
  });

  it("returns unit displayLabel in results", async () => {
    const res = await GET(makeRequest("DL3"));
    const body = await res.json();
    expect(body.vehicles[0].unit.displayLabel).toBe("A-101");
  });

  it("scopes query to resident's societyId — never from query string", async () => {
    await GET(makeRequest("DL3"));
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-1" }),
      }),
    );
  });

  it("normalizes query before searching (strips hyphens, uppercases)", async () => {
    await GET(makeRequest("dl-3cab"));
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

  it("applies societyId filter when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("soc-1");
    const res = await GET(makeRequest("DL3"));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "soc-1" }) }),
    );
  });

  it("returns empty list when no vehicles match", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest("XYZ"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toEqual([]);
  });

  it("allows search when allowResidentVehicleSearch is true", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ allowResidentVehicleSearch: true });
    const res = await GET(makeRequest("DL3"));
    expect(res.status).toBe(200);
  });

  it("allows search when society record is not found (default allow)", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest("DL3"));
    expect(res.status).toBe(200);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest("DL3"));
    expect(res.status).toBe(500);
  });
});
