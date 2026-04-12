import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockStorageBucket } from "../../__mocks__/supabase";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

// eslint-disable-next-line import/order
import { GET } from "@/app/api/v1/residents/me/directory/route";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/v1/residents/me/directory");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/v1/residents/me/directory", () => {
  const currentUser = {
    userId: "u1",
    authUserId: "auth-1",
    societyId: "soc-1",
    role: "RESIDENT" as const,
    adminPermission: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-photo" },
      error: null,
    });
  });

  it("returns 403 when not authenticated as resident", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns paginated residents with masked mobile and photoUrl when showPhoneInDirectory=true", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        name: "Anita Patel",
        email: "anita@test.com",
        mobile: "9876543210",
        ownershipType: "OWNER",
        photoUrl: "soc-1/u2/photo.jpg",
        showPhoneInDirectory: true,
        userUnits: [{ unit: { displayLabel: "A-101" } }],
      },
      {
        id: "u3",
        name: "Vikram Singh",
        email: "vikram@test.com",
        mobile: "8765432109",
        ownershipType: "TENANT",
        photoUrl: null,
        showPhoneInDirectory: true,
        userUnits: [],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(2);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.residents).toHaveLength(2);
    expect(body.residents[0]).toEqual({
      id: "u2",
      name: "Anita Patel",
      email: "anita@test.com",
      mobile: "XXXXX 43210",
      ownershipType: "OWNER",
      unit: "A-101",
      photoUrl: "https://example.com/signed-photo",
    });
    expect(body.residents[1]).toEqual({
      id: "u3",
      name: "Vikram Singh",
      email: "vikram@test.com",
      mobile: "XXXXX 32109",
      ownershipType: "TENANT",
      unit: null,
      photoUrl: null,
    });
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("returns mobile: null when showPhoneInDirectory=false", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        name: "Anita Patel",
        email: "anita@test.com",
        mobile: "9876543210",
        ownershipType: "OWNER",
        photoUrl: null,
        showPhoneInDirectory: false,
        userUnits: [],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.residents[0].mobile).toBeNull();
  });

  it("filters by showInDirectory=true by default (optinOnly)", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest());

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ showInDirectory: true }),
      }),
    );
  });

  it("omits the showInDirectory filter when optinOnly=false", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ optinOnly: "false" }));

    const arg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(arg.where.showInDirectory).toBeUndefined();
  });

  it("excludes current user from directory", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest());

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "u1" },
          societyId: "soc-1",
          role: "RESIDENT",
        }),
      }),
    );
  });

  it("only shows approved residents (no MIGRATED_PENDING)", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest());

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              "ACTIVE_PAID",
              "ACTIVE_PENDING",
              "ACTIVE_OVERDUE",
              "ACTIVE_PARTIAL",
              "ACTIVE_EXEMPTED",
            ],
          },
        }),
      }),
    );
  });

  it("supports search by name or email", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ search: "anita" }));

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "anita", mode: "insensitive" } },
            { email: { contains: "anita", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("supports pagination parameters", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(50);

    const res = await GET(makeRequest({ page: "3", limit: "10" }));
    const body = await res.json();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
    expect(body.page).toBe(3);
    expect(body.limit).toBe(10);
    expect(body.total).toBe(50);
  });

  it("handles resident with null mobile and photoUrl (phone visible)", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        name: "No Phone",
        email: "nophone@test.com",
        mobile: null,
        ownershipType: null,
        photoUrl: null,
        showPhoneInDirectory: true,
        userUnits: [],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.residents[0].mobile).toBe("—");
    expect(body.residents[0].ownershipType).toBeNull();
    expect(body.residents[0].unit).toBeNull();
    expect(body.residents[0].photoUrl).toBeNull();
  });

  it("uses default pagination when no params provided", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest());

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { name: "asc" },
      }),
    );
  });

  it("falls back to null photoUrl when signed URL generation fails", async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        name: "Anita Patel",
        email: "anita@test.com",
        mobile: "9876543210",
        ownershipType: "OWNER",
        photoUrl: "soc-1/u2/photo.jpg",
        showPhoneInDirectory: true,
        userUnits: [{ unit: { displayLabel: "A-101" } }],
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Storage error" },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.residents[0].photoUrl).toBeNull();
  });

  it("returns 500 on server error", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
