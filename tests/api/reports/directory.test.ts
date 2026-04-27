import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockRenderToStream = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@react-pdf/renderer", () => ({
  default: { renderToStream: (...args: unknown[]) => mockRenderToStream(...args) },
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

import { GET } from "@/app/api/v1/societies/[id]/reports/directory/route";

function makeReq(params: Record<string, string> = {}) {
  const sp = new URLSearchParams(params);
  return new NextRequest(`http://localhost/api/v1/societies/soc-1/reports/directory?${sp}`);
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

const mockResidents = [
  {
    name: "John Doe",
    rwaid: "RWA-DL-EDN-1001-2025-0001",
    mobile: "9876543210",
    email: "john@example.com",
    ownershipType: "OWNER",
    userUnits: [{ unit: { displayLabel: "A-3-301" } }],
  },
];

function makeStream() {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from("PDF content");
    },
  };
}

describe("GET /api/v1/societies/[id]/reports/directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "soc-1",
      role: "RWA_ADMIN",
    });
    mockPrisma.society.findUnique.mockResolvedValue({ name: "Greenwood Residency" });
    mockPrisma.user.findMany.mockResolvedValue(mockResidents);
    mockRenderToStream.mockResolvedValue(makeStream());
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when society mismatch", async () => {
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

  it("returns PDF by default", async () => {
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("directory");
  });

  it("returns Excel when format=excel", async () => {
    const res = await GET(makeReq({ format: "excel" }), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });

  it("handles empty resident list", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const res = await GET(makeReq({ format: "excel" }), makeParams());
    expect(res.status).toBe(200);
  });

  it("handles resident with no unit", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ ...mockResidents[0], userUnits: [] }]);
    const res = await GET(makeReq({ format: "excel" }), makeParams());
    expect(res.status).toBe(200);
  });

  it("handles resident with no mobile", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ ...mockResidents[0], mobile: null }]);
    const res = await GET(makeReq({ format: "excel" }), makeParams());
    expect(res.status).toBe(200);
  });
});
