import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  membershipFee: { aggregate: vi.fn() },
  expense: { aggregate: vi.fn() },
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

import { GET } from "@/app/api/v1/societies/[id]/reports/collection-summary/route";

function makeReq(params: Record<string, string> = {}) {
  const sp = new URLSearchParams(params);
  return new NextRequest(
    `http://localhost/api/v1/societies/soc-1/reports/collection-summary?${sp}`,
  );
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

function makeStream() {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from("PDF content");
    },
  };
}

describe("GET /api/v1/societies/[id]/reports/collection-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "soc-1",
      role: "RWA_ADMIN",
    });
    mockPrisma.society.findUnique.mockResolvedValue({
      name: "Greenwood Residency",
      feeSessionStartMonth: 4,
    });
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 72000 }, _count: 30 }) // paid
      .mockResolvedValueOnce({ _sum: { amountDue: 24000 }, _count: 10 }); // pending
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 14000 } });
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
    const res = await GET(makeReq({ session: "2025-26" }), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("collection-summary");
  });

  it("returns Excel when format=excel", async () => {
    const res = await GET(makeReq({ format: "excel", session: "2025-26" }), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });

  it("includes correct summary data", async () => {
    const res = await GET(makeReq({ format: "excel", session: "2025-26" }), makeParams());
    expect(res.status).toBe(200);
  });

  it("handles null aggregates gracefully", async () => {
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: null }, _count: 0 })
      .mockResolvedValueOnce({ _sum: { amountDue: null }, _count: 0 });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const res = await GET(makeReq({ format: "excel" }), makeParams());
    expect(res.status).toBe(200);
  });
});
