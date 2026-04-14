import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  listCounsellors,
  getCounsellor,
  createCounsellor,
  updateCounsellor,
  deleteCounsellor,
  resendCounsellorInvite,
} from "@/services/counsellors";

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

function ok(json: unknown) {
  return { ok: true, json: () => Promise.resolve(json) } as Response;
}

function fail(message = "boom") {
  return {
    ok: false,
    json: () => Promise.resolve({ error: { code: "X", message } }),
  } as Response;
}

describe("listCounsellors", () => {
  it("fetches with no filters (no query string)", async () => {
    mockFetch.mockResolvedValue(ok({ counsellors: [], total: 0, page: 1, pageSize: 20 }));
    await listCounsellors();
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/counsellors");
  });

  it("builds query string from filters", async () => {
    mockFetch.mockResolvedValue(ok({ counsellors: [], total: 0, page: 2, pageSize: 50 }));
    await listCounsellors({ search: "asha", status: "active", page: 2, pageSize: 50 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("search=asha");
    expect(url).toContain("status=active");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=50");
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValue(fail("oops"));
    await expect(listCounsellors()).rejects.toThrow("oops");
  });

  it("falls back to generic error message when body lacks error.message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("bad json")),
    });
    await expect(listCounsellors()).rejects.toThrow("Request failed");
  });
});

describe("getCounsellor", () => {
  it("fetches detail", async () => {
    mockFetch.mockResolvedValue(ok({ id: "c-1", name: "Asha" }));
    const c = await getCounsellor("c-1");
    expect(c.id).toBe("c-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/counsellors/c-1");
  });
});

describe("createCounsellor", () => {
  it("POSTs body and returns result", async () => {
    mockFetch.mockResolvedValue(ok({ id: "c-1", email: "a@x.com", name: "A", inviteSent: true }));
    const result = await createCounsellor({ name: "A", email: "a@x.com" });
    expect(result.id).toBe("c-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("updateCounsellor", () => {
  it("PATCHes body", async () => {
    mockFetch.mockResolvedValue(ok({ id: "c-1", name: "A", email: "a@x.com", isActive: false }));
    await updateCounsellor("c-1", { isActive: false });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/c-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});

describe("deleteCounsellor", () => {
  it("DELETEs", async () => {
    mockFetch.mockResolvedValue(ok({ id: "c-1", deleted: true }));
    const res = await deleteCounsellor("c-1");
    expect(res.deleted).toBe(true);
  });
});

describe("resendCounsellorInvite", () => {
  it("POSTs and returns sent", async () => {
    mockFetch.mockResolvedValue(ok({ id: "c-1", sent: true }));
    const res = await resendCounsellorInvite("c-1");
    expect(res.sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/c-1/resend-invite",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
