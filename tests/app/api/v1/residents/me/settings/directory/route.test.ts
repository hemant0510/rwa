import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../__mocks__/prisma";
import { mockSupabaseClient } from "../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { PATCH } from "@/app/api/v1/residents/me/settings/directory/route";

const mockResident = { id: "user-1" };

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/v1/residents/me/settings/directory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/v1/residents/me/settings/directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.user.update.mockResolvedValue({
      showInDirectory: true,
      showPhoneInDirectory: true,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await PATCH(makeRequest({ showInDirectory: true, showPhoneInDirectory: false }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when no matching resident is found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ showInDirectory: true, showPhoneInDirectory: false }));
    expect(res.status).toBe(401);
  });

  it("uses activeSocietyId when set", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-99");
    await PATCH(makeRequest({ showInDirectory: true, showPhoneInDirectory: false }));
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-99" }),
      }),
    );
  });

  it("returns 422 when body is missing required fields", async () => {
    const res = await PATCH(makeRequest({ showInDirectory: true }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when body contains unknown fields (strict)", async () => {
    const res = await PATCH(
      makeRequest({ showInDirectory: true, showPhoneInDirectory: false, foo: 1 }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when fields are wrong types", async () => {
    const res = await PATCH(makeRequest({ showInDirectory: "yes", showPhoneInDirectory: false }));
    expect(res.status).toBe(422);
  });

  it("updates both fields when showInDirectory is true", async () => {
    mockPrisma.user.update.mockResolvedValue({
      showInDirectory: true,
      showPhoneInDirectory: true,
    });
    const res = await PATCH(makeRequest({ showInDirectory: true, showPhoneInDirectory: true }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { showInDirectory: true, showPhoneInDirectory: true },
      select: { showInDirectory: true, showPhoneInDirectory: true },
    });
    const body = await res.json();
    expect(body).toEqual({ showInDirectory: true, showPhoneInDirectory: true });
  });

  it("forces showPhoneInDirectory to false when showInDirectory is false", async () => {
    mockPrisma.user.update.mockResolvedValue({
      showInDirectory: false,
      showPhoneInDirectory: false,
    });
    const res = await PATCH(makeRequest({ showInDirectory: false, showPhoneInDirectory: true }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { showInDirectory: false, showPhoneInDirectory: false },
      }),
    );
    const body = await res.json();
    expect(body.showPhoneInDirectory).toBe(false);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeRequest({ showInDirectory: true, showPhoneInDirectory: false }));
    expect(res.status).toBe(500);
  });
});
