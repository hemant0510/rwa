import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  fetchGoverningBody,
  assignMember,
  removeMember,
  fetchDesignations,
  createDesignation,
  renameDesignation,
  deleteDesignation,
} from "@/services/governing-body";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as unknown as Response;
}

function errorResponse(message: string, status = 400) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  } as unknown as Response;
}

describe("governing-body service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchGoverningBody", () => {
    it("fetches governing body data", async () => {
      const data = { members: [], designations: [] };
      mockFetch.mockResolvedValue(okResponse(data));
      const result = await fetchGoverningBody();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/admin/governing-body");
    });

    it("throws error on failure", async () => {
      mockFetch.mockResolvedValue(errorResponse("Unauthorized"));
      await expect(fetchGoverningBody()).rejects.toThrow("Unauthorized");
    });

    it("throws generic error when no message in response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as unknown as Response);
      await expect(fetchGoverningBody()).rejects.toThrow("Request failed");
    });
  });

  describe("assignMember", () => {
    it("posts to assign a member", async () => {
      mockFetch.mockResolvedValue(okResponse({ id: "m-1", message: "Assigned" }));
      const result = await assignMember("u-1", "d-1");
      expect(result).toEqual({ id: "m-1", message: "Assigned" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/governing-body",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("removeMember", () => {
    it("deletes a member", async () => {
      mockFetch.mockResolvedValue(okResponse({ message: "Removed" }));
      const result = await removeMember("m-1");
      expect(result).toEqual({ message: "Removed" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/governing-body/m-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("fetchDesignations", () => {
    it("fetches designations", async () => {
      const data = [{ id: "d-1", name: "President", sortOrder: 1, memberCount: 0 }];
      mockFetch.mockResolvedValue(okResponse(data));
      const result = await fetchDesignations();
      expect(result).toEqual(data);
    });
  });

  describe("createDesignation", () => {
    it("creates a designation", async () => {
      const data = {
        id: "d-1",
        name: "Secretary",
        sortOrder: 2,
        memberCount: 0,
        message: "Created",
      };
      mockFetch.mockResolvedValue(okResponse(data));
      const result = await createDesignation("Secretary");
      expect(result).toEqual(data);
    });
  });

  describe("renameDesignation", () => {
    it("renames a designation", async () => {
      mockFetch.mockResolvedValue(okResponse({ id: "d-1", name: "VP", message: "Updated" }));
      const result = await renameDesignation("d-1", "VP");
      expect(result.name).toBe("VP");
    });
  });

  describe("deleteDesignation", () => {
    it("deletes a designation (without force)", async () => {
      mockFetch.mockResolvedValue(okResponse({ message: "Deleted" }));
      await deleteDesignation("d-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/designations/d-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("deletes with force=true appends query param", async () => {
      mockFetch.mockResolvedValue(okResponse({ message: "Force deleted" }));
      await deleteDesignation("d-1", true);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/designations/d-1?force=true",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
