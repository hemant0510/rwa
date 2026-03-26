import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockXLSXRead = vi.hoisted(() => vi.fn());
const mockSheetToJson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("xlsx", () => ({
  read: (...args: unknown[]) => mockXLSXRead(...args),
  utils: { sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args) },
}));

import { POST } from "@/app/api/v1/societies/[id]/migration/validate/route";

function makeRequest(hasFile = true) {
  const formData = new FormData();
  if (hasFile) {
    const file = new File(["xlsx"], "test.xlsx");
    formData.append("file", file);
  }
  return {
    formData: vi.fn().mockResolvedValue(formData),
    url: "http://localhost/api/v1/societies/soc-1/migration/validate",
  } as unknown as NextRequest;
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

const validRow = {
  "Full Name*": "John Doe",
  "Email*": "john@example.com",
  "Mobile*": "9876543210",
  "Ownership Type*": "OWNER",
  "Fee Status*": "PAID",
};

function setupXlsxMock(rows: Record<string, string>[]) {
  const fakeWb = { SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } };
  mockXLSXRead.mockReturnValue(fakeWb);
  mockSheetToJson.mockReturnValue(rows);
}

describe("POST /api/v1/societies/[id]/migration/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "soc-1",
      role: "RWA_ADMIN",
    });
    mockPrisma.society.findUnique.mockResolvedValue({ id: "soc-1", type: "APARTMENT_COMPLEX" });
    mockPrisma.user.findMany.mockResolvedValue([]);
    setupXlsxMock([validRow]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when user society does not match", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "other-soc",
      role: "RWA_ADMIN",
    });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file uploaded", async () => {
    const res = await POST(makeRequest(false), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 422 for empty spreadsheet", async () => {
    setupXlsxMock([]);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(422);
  });

  it("validates a valid file and returns zero errors", async () => {
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.valid).toBe(1);
    expect(body.invalid).toBe(0);
    expect(body.errors).toHaveLength(0);
  });

  it("catches invalid email", async () => {
    setupXlsxMock([{ ...validRow, "Email*": "not-an-email" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.errors.some((e: { field: string }) => e.field === "email")).toBe(true);
  });

  it("catches invalid mobile", async () => {
    setupXlsxMock([{ ...validRow, "Mobile*": "12345" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.errors.some((e: { field: string }) => e.field === "mobile")).toBe(true);
  });

  it("catches invalid ownershipType", async () => {
    setupXlsxMock([{ ...validRow, "Ownership Type*": "MANAGER" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.errors.some((e: { field: string }) => e.field === "ownershipType")).toBe(true);
  });

  it("catches invalid feeStatus", async () => {
    setupXlsxMock([{ ...validRow, "Fee Status*": "UNKNOWN" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.errors.some((e: { field: string }) => e.field === "feeStatus")).toBe(true);
  });

  it("catches short fullName", async () => {
    setupXlsxMock([{ ...validRow, "Full Name*": "X" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.errors.some((e: { field: string }) => e.field === "fullName")).toBe(true);
  });

  it("catches duplicate email within file", async () => {
    setupXlsxMock([validRow, { ...validRow, "Mobile*": "9876543211" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(
      body.errors.some((e: { message: string }) => e.message.includes("Duplicate email")),
    ).toBe(true);
  });

  it("catches duplicate mobile within file", async () => {
    setupXlsxMock([validRow, { ...validRow, "Email*": "other@example.com" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(
      body.errors.some((e: { message: string }) => e.message.includes("Duplicate mobile")),
    ).toBe(true);
  });

  it("catches email already in DB", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ email: "john@example.com", mobile: null }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.errors.some((e: { message: string }) => e.message.includes("already exists"))).toBe(
      true,
    );
  });

  it("catches mobile already in DB", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { email: "other@example.com", mobile: "9876543210" },
    ]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(
      body.errors.some((e: { message: string }) => e.message.includes("already registered")),
    ).toBe(true);
  });

  it("handles multiple valid rows", async () => {
    setupXlsxMock([
      validRow,
      { ...validRow, "Email*": "jane@example.com", "Mobile*": "9876543211" },
    ]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.valid).toBe(2);
  });

  it("returns preview data for valid rows", async () => {
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.preview).toHaveLength(1);
    expect(body.preview[0].fullName).toBe("John Doe");
    expect(body.preview[0].feeStatus).toBe("PAID");
  });

  it("counts invalid rows correctly", async () => {
    setupXlsxMock([validRow, { ...validRow, "Email*": "bad-email", "Mobile*": "9876543211" }]);
    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.valid).toBe(1);
    expect(body.invalid).toBe(1);
  });
});
