import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getDashboard,
  getMe,
  getSocieties,
  getSociety,
  getSocietyGoverningBody,
  getSocietyResident,
  getSocietyResidents,
  updateMe,
} from "@/services/counsellor-self";

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

describe("getMe", () => {
  it("GETs /counsellor/me and returns body", async () => {
    mockFetch.mockResolvedValue(ok({ id: "c-1", name: "Asha" }));
    const me = await getMe();
    expect(me.id).toBe("c-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/me");
  });

  it("throws server error message when not ok", async () => {
    mockFetch.mockResolvedValue(fail("not authorized"));
    await expect(getMe()).rejects.toThrow("not authorized");
  });

  it("falls back to generic message when error body is unparseable", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("bad json")),
    });
    await expect(getMe()).rejects.toThrow("Request failed");
  });

  it("falls back to generic message when error body has no message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    await expect(getMe()).rejects.toThrow("Request failed");
  });
});

describe("updateMe", () => {
  it("PATCHes body and returns updated profile", async () => {
    mockFetch.mockResolvedValue(
      ok({
        id: "c-1",
        name: "New",
        email: "asha@x.com",
        mobile: null,
        bio: null,
        publicBlurb: null,
        photoUrl: null,
      }),
    );
    const result = await updateMe({ name: "New" });
    expect(result.name).toBe("New");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/counsellor/me",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});

describe("getDashboard", () => {
  it("GETs /counsellor/dashboard", async () => {
    const payload = {
      counsellor: { id: "c-1", name: "Asha", email: "a@x.com", photoUrl: null },
      totals: { societies: 2, residents: 100, openEscalations: 3, pendingAck: 1 },
      societies: [],
    };
    mockFetch.mockResolvedValue(ok(payload));
    const result = await getDashboard();
    expect(result.totals.societies).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/dashboard");
  });
});

describe("getSocieties", () => {
  it("GETs /counsellor/societies", async () => {
    mockFetch.mockResolvedValue(ok({ societies: [] }));
    const result = await getSocieties();
    expect(result.societies).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/societies");
  });
});

describe("getSociety", () => {
  it("GETs /counsellor/societies/:id", async () => {
    mockFetch.mockResolvedValue(ok({ id: "s-1", name: "Alpha" }));
    const result = await getSociety("s-1");
    expect(result.id).toBe("s-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/societies/s-1");
  });
});

describe("getSocietyResidents", () => {
  it("GETs with default query params", async () => {
    mockFetch.mockResolvedValue(ok({ residents: [], total: 0, page: 1, pageSize: 20 }));
    await getSocietyResidents("s-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/societies/s-1/residents");
  });

  it("encodes page, pageSize, and search when provided", async () => {
    mockFetch.mockResolvedValue(ok({ residents: [], total: 0, page: 2, pageSize: 10 }));
    await getSocietyResidents("s-1", { page: 2, pageSize: 10, search: "asha" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/counsellor/societies/s-1/residents?page=2&pageSize=10&search=asha",
    );
  });
});

describe("getSocietyResident", () => {
  it("GETs /counsellor/societies/:id/residents/:rid", async () => {
    mockFetch.mockResolvedValue(ok({ id: "u-1", name: "Asha" }));
    const result = await getSocietyResident("s-1", "u-1");
    expect(result.id).toBe("u-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/societies/s-1/residents/u-1");
  });
});

describe("getSocietyGoverningBody", () => {
  it("GETs /counsellor/societies/:id/governing-body", async () => {
    mockFetch.mockResolvedValue(ok({ members: [] }));
    const result = await getSocietyGoverningBody("s-1");
    expect(result.members).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/societies/s-1/governing-body");
  });
});
