import { describe, it, expect, vi, beforeEach } from "vitest";

import { getMe, updateMe } from "@/services/counsellor-self";

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
