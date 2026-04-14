import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  listCounsellors,
  getCounsellor,
  createCounsellor,
  updateCounsellor,
  deleteCounsellor,
  resendCounsellorInvite,
  listCounsellorAssignments,
  listAvailableSocieties,
  assignSocieties,
  revokeAssignment,
  transferPortfolio,
  getMyCounsellor,
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

describe("listCounsellorAssignments", () => {
  it("GETs assignments for a counsellor", async () => {
    mockFetch.mockResolvedValue(ok({ assignments: [] }));
    await listCounsellorAssignments("c-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/counsellors/c-1/assignments");
  });
});

describe("listAvailableSocieties", () => {
  it("GETs available societies without search", async () => {
    mockFetch.mockResolvedValue(ok({ societies: [] }));
    await listAvailableSocieties("c-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/c-1/available-societies",
    );
  });

  it("appends search query when provided", async () => {
    mockFetch.mockResolvedValue(ok({ societies: [] }));
    await listAvailableSocieties("c-1", "delhi");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/c-1/available-societies?search=delhi",
    );
  });
});

describe("assignSocieties", () => {
  it("POSTs body and returns counts", async () => {
    mockFetch.mockResolvedValue(
      ok({ assigned: 2, reactivated: 0, alreadyActive: 0, societyIds: ["s1", "s2"] }),
    );
    const res = await assignSocieties("c-1", { societyIds: ["s1", "s2"] });
    expect(res.assigned).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/c-1/assignments",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("revokeAssignment", () => {
  it("DELETEs", async () => {
    mockFetch.mockResolvedValue(ok({ id: "a-1", revoked: true }));
    const res = await revokeAssignment("c-1", "soc-1");
    expect(res.revoked).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/c-1/assignments/soc-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("transferPortfolio", () => {
  it("POSTs body", async () => {
    mockFetch.mockResolvedValue(ok({ transferred: 3, skipped: 0 }));
    const res = await transferPortfolio("src", { targetCounsellorId: "tgt" });
    expect(res.transferred).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/super-admin/counsellors/src/transfer-portfolio",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("getMyCounsellor", () => {
  it("GETs the admin's counsellor", async () => {
    mockFetch.mockResolvedValue(ok({ counsellor: null }));
    const res = await getMyCounsellor();
    expect(res.counsellor).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/admin/counsellor");
  });
});
