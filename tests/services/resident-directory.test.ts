import { describe, it, expect, vi, beforeEach } from "vitest";

import { fetchCommitteeMembers, fetchResidentDirectory } from "@/services/resident-directory";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as unknown as Response;
}

function errorResponse(message: string) {
  return {
    ok: false,
    json: async () => ({ error: { message } }),
  } as unknown as Response;
}

describe("resident-directory service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchCommitteeMembers", () => {
    it("fetches committee members", async () => {
      const data = { members: [{ id: "m1", name: "President" }] };
      mockFetch.mockResolvedValue(okResponse(data));

      const result = await fetchCommitteeMembers();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/governing-body");
    });

    it("throws error on failure", async () => {
      mockFetch.mockResolvedValue(errorResponse("Forbidden"));
      await expect(fetchCommitteeMembers()).rejects.toThrow("Forbidden");
    });

    it("throws generic error when no message in response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as unknown as Response);
      await expect(fetchCommitteeMembers()).rejects.toThrow("Request failed");
    });
  });

  describe("fetchResidentDirectory", () => {
    it("fetches directory without params", async () => {
      const data = { residents: [], total: 0, page: 1, limit: 20 };
      mockFetch.mockResolvedValue(okResponse(data));

      const result = await fetchResidentDirectory();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/directory");
    });

    it("appends search query param", async () => {
      mockFetch.mockResolvedValue(okResponse({ residents: [], total: 0, page: 1, limit: 20 }));

      await fetchResidentDirectory({ search: "anita" });
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/directory?search=anita");
    });

    it("appends page and limit params", async () => {
      mockFetch.mockResolvedValue(okResponse({ residents: [], total: 0, page: 2, limit: 10 }));

      await fetchResidentDirectory({ page: 2, limit: 10 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("appends all params together", async () => {
      mockFetch.mockResolvedValue(okResponse({ residents: [], total: 0, page: 3, limit: 5 }));

      await fetchResidentDirectory({ search: "test", page: 3, limit: 5 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("search=test");
      expect(url).toContain("page=3");
      expect(url).toContain("limit=5");
    });

    it("throws error on failure", async () => {
      mockFetch.mockResolvedValue(errorResponse("Not allowed"));
      await expect(fetchResidentDirectory()).rejects.toThrow("Not allowed");
    });
  });
});
