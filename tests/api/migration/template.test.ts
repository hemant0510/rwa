import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));

import { GET } from "@/app/api/v1/societies/[id]/migration/template/route";

function makeReq() {
  return new NextRequest("http://localhost/api/v1/societies/soc-1/migration/template");
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/societies/[id]/migration/template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "soc-1",
      role: "RWA_ADMIN",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when user society does not match", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "other-soc",
      role: "RWA_ADMIN",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns xlsx file for APARTMENT_COMPLEX", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Greenwood Residency",
      type: "APARTMENT_COMPLEX",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain(".xlsx");
  });

  it("returns xlsx for BUILDER_FLOORS type", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Green Floors",
      type: "BUILDER_FLOORS",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("xlsx");
  });

  it("returns xlsx for GATED_COMMUNITY_VILLAS type", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Palm Villas",
      type: "GATED_COMMUNITY_VILLAS",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns xlsx for INDEPENDENT_SECTOR type", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Sector Colony",
      type: "INDEPENDENT_SECTOR",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns xlsx for PLOTTED_COLONY type", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Plot Colony",
      type: "PLOTTED_COLONY",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns xlsx for unknown society type", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ name: "Unknown Type", type: null });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
  });

  it("includes society name in filename", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Greenwood Residency",
      type: "APARTMENT_COMPLEX",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.headers.get("Content-Disposition")).toContain("greenwood-residency");
  });
});
