import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getPetitions,
  createPetition,
  getPetition,
  updatePetition,
  deletePetition,
  uploadDocument,
  publishPetition,
  submitPetition,
  closePetition,
  extendDeadline,
  getSignatures,
  removeSignature,
  downloadReport,
  downloadSignedDoc,
  getResidentPetitions,
  getResidentPetition,
  signPetition,
} from "@/services/petitions";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("petitions service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Admin: Petitions ──

  describe("getPetitions", () => {
    it("fetches petitions without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      const result = await getPetitions("soc-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/societies/soc-1/petitions"));
      expect(result.total).toBe(0);
    });

    it("appends status, type, page and limit params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 2, limit: 10 }));
      await getPetitions("soc-1", { status: "PUBLISHED", type: "COMPLAINT", page: 2, limit: 10 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=PUBLISHED"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("type=COMPLAINT"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getPetitions("soc-1")).rejects.toThrow("Failed to fetch petitions");
    });
  });

  describe("createPetition", () => {
    const petitionData = {
      title: "Fix Parking Issue",
      type: "COMPLAINT" as const,
    };

    it("sends POST to petitions endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1", title: "Fix Parking Issue" }));
      const result = await createPetition("soc-1", petitionData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.id).toBe("pet-1");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Title already exists" } }));
      await expect(createPetition("soc-1", petitionData)).rejects.toThrow("Title already exists");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(createPetition("soc-1", petitionData)).rejects.toThrow(
        "Failed to create petition",
      );
    });
  });

  describe("getPetition", () => {
    it("fetches a single petition by id", async () => {
      mockFetch.mockResolvedValue(
        okJson({
          id: "pet-1",
          title: "Fix Parking Issue",
          signatureCount: 5,
          documentSignedUrl: null,
        }),
      );
      const result = await getPetition("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1"),
      );
      expect(result.id).toBe("pet-1");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getPetition("soc-1", "pet-1")).rejects.toThrow("Failed to fetch petition");
    });
  });

  describe("updatePetition", () => {
    it("sends PATCH to petition endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1", title: "Updated Title" }));
      await updatePetition("soc-1", "pet-1", { title: "Updated Title" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("sends partial update body correctly", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1" }));
      await updatePetition("soc-1", "pet-1", { description: "New description" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.description).toBe("New description");
      expect(body.title).toBeUndefined();
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Petition already published" } }));
      await expect(updatePetition("soc-1", "pet-1", { title: "New" })).rejects.toThrow(
        "Petition already published",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(updatePetition("soc-1", "pet-1", { title: "New" })).rejects.toThrow(
        "Failed to update petition",
      );
    });
  });

  describe("deletePetition", () => {
    it("sends DELETE to petition endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Deleted" }));
      const result = await deletePetition("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(result.message).toBe("Deleted");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(
        errJson({ error: { message: "Cannot delete published petition" } }),
      );
      await expect(deletePetition("soc-1", "pet-1")).rejects.toThrow(
        "Cannot delete published petition",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(deletePetition("soc-1", "pet-1")).rejects.toThrow("Failed to delete petition");
    });
  });

  // ── Admin: Actions ──

  describe("uploadDocument", () => {
    it("sends POST with FormData to document endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ documentUrl: "path/to/doc.pdf" }));
      const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
      await uploadDocument("soc-1", "pet-1", file);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/document"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns documentUrl on success", async () => {
      mockFetch.mockResolvedValue(okJson({ documentUrl: "path/to/doc.pdf" }));
      const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
      const result = await uploadDocument("soc-1", "pet-1", file);
      expect(result.documentUrl).toBe("path/to/doc.pdf");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "File too large" } }));
      const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
      await expect(uploadDocument("soc-1", "pet-1", file)).rejects.toThrow("File too large");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
      await expect(uploadDocument("soc-1", "pet-1", file)).rejects.toThrow(
        "Failed to upload document",
      );
    });
  });

  describe("publishPetition", () => {
    it("sends POST to publish endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1", status: "PUBLISHED" }));
      const result = await publishPetition("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/publish"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("PUBLISHED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already published" } }));
      await expect(publishPetition("soc-1", "pet-1")).rejects.toThrow("Already published");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(publishPetition("soc-1", "pet-1")).rejects.toThrow("Failed to publish petition");
    });
  });

  describe("submitPetition", () => {
    it("sends POST to submit endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1", status: "SUBMITTED" }));
      const result = await submitPetition("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/submit"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("SUBMITTED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Not enough signatures" } }));
      await expect(submitPetition("soc-1", "pet-1")).rejects.toThrow("Not enough signatures");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(submitPetition("soc-1", "pet-1")).rejects.toThrow("Failed to submit petition");
    });
  });

  describe("closePetition", () => {
    const closeData = { reason: "RESOLVED" as const };

    it("sends POST to close endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1", status: "CLOSED" }));
      const result = await closePetition("soc-1", "pet-1", closeData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/close"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("CLOSED");
    });

    it("includes body in request", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pet-1", status: "CLOSED" }));
      await closePetition("soc-1", "pet-1", closeData);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reason).toBe("RESOLVED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Petition not active" } }));
      await expect(closePetition("soc-1", "pet-1", closeData)).rejects.toThrow(
        "Petition not active",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(closePetition("soc-1", "pet-1", closeData)).rejects.toThrow(
        "Failed to close petition",
      );
    });
  });

  // ── Admin: Signatures ──

  describe("getSignatures", () => {
    it("fetches signatures without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      const result = await getSignatures("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/signatures"),
      );
      expect(result.total).toBe(0);
    });

    it("appends page and limit params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 2, limit: 5 }));
      await getSignatures("soc-1", "pet-1", { page: 2, limit: 5 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=5"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSignatures("soc-1", "pet-1")).rejects.toThrow("Failed to fetch signatures");
    });
  });

  describe("removeSignature", () => {
    it("sends DELETE to signature endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Signature removed" }));
      const result = await removeSignature("soc-1", "pet-1", "sig-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/signatures/sig-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(result.message).toBe("Signature removed");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Signature not found" } }));
      await expect(removeSignature("soc-1", "pet-1", "sig-1")).rejects.toThrow(
        "Signature not found",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(removeSignature("soc-1", "pet-1", "sig-1")).rejects.toThrow(
        "Failed to remove signature",
      );
    });
  });

  describe("downloadReport", () => {
    it("fetches report and returns blob", async () => {
      mockFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["pdf"])) });
      const result = await downloadReport("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/report"),
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(downloadReport("soc-1", "pet-1")).rejects.toThrow("Failed to download report");
    });
  });

  // ── Resident: Petitions ──

  describe("getResidentPetitions", () => {
    it("fetches resident petitions", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [] }));
      const result = await getResidentPetitions();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/residents/me/petitions"));
      expect(result.data).toEqual([]);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResidentPetitions()).rejects.toThrow("Failed to fetch petitions");
    });
  });

  describe("getResidentPetition", () => {
    it("fetches a single resident petition by id", async () => {
      mockFetch.mockResolvedValue(
        okJson({ id: "pet-1", signatureCount: 3, documentSignedUrl: null, mySignature: null }),
      );
      const result = await getResidentPetition("pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/me/petitions/pet-1"),
      );
      expect(result.id).toBe("pet-1");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResidentPetition("pet-1")).rejects.toThrow("Failed to fetch petition");
    });
  });

  describe("signPetition", () => {
    const signData = { method: "DIGITAL" as const };

    it("sends POST to sign endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ signedAt: "2025-11-01T10:00:00Z" }));
      const result = await signPetition("pet-1", signData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/me/petitions/pet-1/sign"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.signedAt).toBe("2025-11-01T10:00:00Z");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already signed" } }));
      await expect(signPetition("pet-1", signData)).rejects.toThrow("Already signed");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(signPetition("pet-1", signData)).rejects.toThrow("Failed to sign petition");
    });
  });

  describe("downloadSignedDoc", () => {
    it("fetches signed-doc and returns blob on success", async () => {
      mockFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["pdf"])) });
      const result = await downloadSignedDoc("soc-1", "pet-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/signed-doc"),
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it("throws with API error message when response is not ok", async () => {
      mockFetch.mockResolvedValue(
        errJson({ error: { message: "Petition has no uploaded document" } }),
      );
      await expect(downloadSignedDoc("soc-1", "pet-1")).rejects.toThrow(
        "Petition has no uploaded document",
      );
    });

    it("throws with fallback message when error body has no message", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(downloadSignedDoc("soc-1", "pet-1")).rejects.toThrow(
        "Failed to download signed document",
      );
    });

    it("throws with fallback when json() rejects", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.reject(new Error("bad json")) });
      await expect(downloadSignedDoc("soc-1", "pet-1")).rejects.toThrow(
        "Failed to download signed document",
      );
    });
  });

  describe("extendDeadline", () => {
    it("sends PATCH to deadline endpoint and returns updated petition", async () => {
      const petition = { id: "pet-1", deadline: "2026-06-01" };
      mockFetch.mockResolvedValue(okJson(petition));
      const result = await extendDeadline("soc-1", "pet-1", "2026-06-01");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/petitions/pet-1/deadline"),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(result).toEqual(petition);
    });

    it("throws with API error message on failure", async () => {
      mockFetch.mockResolvedValue(
        errJson({ error: { message: "Deadline cannot be in the past" } }),
      );
      await expect(extendDeadline("soc-1", "pet-1", "2020-01-01")).rejects.toThrow(
        "Deadline cannot be in the past",
      );
    });

    it("throws fallback message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(extendDeadline("soc-1", "pet-1", null)).rejects.toThrow(
        "Failed to update deadline",
      );
    });

    it("throws fallback message when json() rejects on error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      });
      await expect(extendDeadline("soc-1", "pet-1", null)).rejects.toThrow(
        "Failed to update deadline",
      );
    });
  });
});
