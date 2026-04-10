import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getResidentTickets,
  createResidentTicket,
  getResidentTicketDetail,
  postResidentTicketMessage,
  reopenResidentTicket,
  getResidentUnreadCount,
  uploadResidentTicketAttachment,
  getResidentTicketAttachments,
  linkResidentTicketPetition,
  getAdminResidentTickets,
  getAdminResidentStats,
  getAdminResidentTicketDetail,
  postAdminResidentMessage,
  changeAdminResidentTicketStatus,
  changeAdminResidentTicketPriority,
  linkTicketPetition,
  getAdminResidentUnreadCount,
  uploadAdminResidentAttachment,
  getAdminResidentAttachments,
} from "@/services/resident-support";

function mockOkResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function mockErrorResponse(message = "error") {
  return { ok: false, json: () => Promise.resolve({ error: { message } }) };
}
function mockErrorNoMessage() {
  return { ok: false, json: () => Promise.resolve({}) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resident-support service", () => {
  // ─── Resident API ─────────────────────────────────────────────────

  describe("Resident API", () => {
    describe("getResidentTickets", () => {
      it("fetches with filters", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ data: [], total: 0 }));
        await getResidentTickets({ status: "OPEN" });
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=OPEN"));
      });

      it("omits empty filter values", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ data: [], total: 0 }));
        await getResidentTickets({ status: "", page: "2" });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).not.toContain("status=");
        expect(url).toContain("page=2");
      });

      it("fetches with no filters", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ data: [], total: 0 }));
        await getResidentTickets();
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/residents/me/support?"),
        );
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getResidentTickets()).rejects.toThrow("Failed to fetch tickets");
      });
    });

    describe("createResidentTicket", () => {
      it("posts ticket data and returns detail", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1" }));
        const result = await createResidentTicket({
          type: "MAINTENANCE_ISSUE",
          subject: "Broken pipe",
          description: "The pipe in kitchen is leaking badly",
        });
        expect(result).toEqual({ id: "t-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/v1/residents/me/support",
          expect.objectContaining({ method: "POST" }),
        );
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Validation failed"));
        await expect(
          createResidentTicket({
            type: "MAINTENANCE_ISSUE",
            subject: "Test",
            description: "Long enough description here",
          }),
        ).rejects.toThrow("Validation failed");
      });

      it("throws fallback message when no error detail", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(
          createResidentTicket({
            type: "MAINTENANCE_ISSUE",
            subject: "Test",
            description: "Desc",
          }),
        ).rejects.toThrow("Failed to create ticket");
      });
    });

    describe("getResidentTicketDetail", () => {
      it("fetches ticket by id", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1" }));
        const result = await getResidentTicketDetail("t-1");
        expect(result).toEqual({ id: "t-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/residents/me/support/t-1"),
        );
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getResidentTicketDetail("t-1")).rejects.toThrow(
          "Failed to fetch ticket detail",
        );
      });
    });

    describe("postResidentTicketMessage", () => {
      it("posts message content", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "msg-1" }));
        const result = await postResidentTicketMessage("t-1", {
          content: "Hello",
          isInternal: false,
        });
        expect(result).toEqual({ id: "msg-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/t-1/messages"),
          expect.objectContaining({ method: "POST" }),
        );
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Not found"));
        await expect(
          postResidentTicketMessage("t-1", { content: "Hi", isInternal: false }),
        ).rejects.toThrow("Not found");
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(
          postResidentTicketMessage("t-1", { content: "Hi", isInternal: false }),
        ).rejects.toThrow("Failed to post message");
      });
    });

    describe("reopenResidentTicket", () => {
      it("posts to reopen endpoint", async () => {
        mockFetch.mockResolvedValue({ ok: true });
        await reopenResidentTicket("t-1");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/t-1/reopen"),
          expect.objectContaining({ method: "POST" }),
        );
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Expired"));
        await expect(reopenResidentTicket("t-1")).rejects.toThrow("Expired");
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(reopenResidentTicket("t-1")).rejects.toThrow("Failed to reopen ticket");
      });
    });

    describe("getResidentUnreadCount", () => {
      it("fetches unread count", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ count: 3 }));
        const result = await getResidentUnreadCount();
        expect(result.count).toBe(3);
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getResidentUnreadCount()).rejects.toThrow("Failed to fetch unread count");
      });
    });

    describe("uploadResidentTicketAttachment", () => {
      it("uploads file with FormData", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "att-1", url: "https://x.com/f" }));
        const file = new File(["content"], "photo.png", { type: "image/png" });
        const result = await uploadResidentTicketAttachment("t-1", file);
        expect(result).toEqual({ id: "att-1", url: "https://x.com/f" });
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toContain("/t-1/attachments");
        expect(opts.body).toBeInstanceOf(FormData);
        expect(opts.method).toBe("POST");
      });

      it("includes messageId in FormData when provided", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "att-2" }));
        const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
        await uploadResidentTicketAttachment("t-1", file, "msg-5");
        const body = mockFetch.mock.calls[0][1].body as FormData;
        expect(body.get("messageId")).toBe("msg-5");
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("File too large"));
        const file = new File(["x"], "big.zip");
        await expect(uploadResidentTicketAttachment("t-1", file)).rejects.toThrow("File too large");
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        const file = new File(["x"], "big.zip");
        await expect(uploadResidentTicketAttachment("t-1", file)).rejects.toThrow(
          "Failed to upload attachment",
        );
      });
    });

    describe("getResidentTicketAttachments", () => {
      it("fetches attachments", async () => {
        mockFetch.mockResolvedValue(mockOkResponse([{ id: "att-1" }]));
        const result = await getResidentTicketAttachments("t-1");
        expect(result).toEqual([{ id: "att-1" }]);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/t-1/attachments"));
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getResidentTicketAttachments("t-1")).rejects.toThrow(
          "Failed to fetch attachments",
        );
      });
    });

    describe("linkResidentTicketPetition", () => {
      it("sends PATCH with petitionId", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1", petitionId: "pet-1" }));
        const result = await linkResidentTicketPetition("t-1", "pet-1");
        expect(result).toEqual({ id: "t-1", petitionId: "pet-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/t-1/link-petition"),
          expect.objectContaining({ method: "PATCH" }),
        );
      });

      it("sends PATCH with null to unlink", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1", petitionId: null }));
        await linkResidentTicketPetition("t-1", null);
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.petitionId).toBeNull();
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Not authorized"));
        await expect(linkResidentTicketPetition("t-1", "pet-1")).rejects.toThrow("Not authorized");
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(linkResidentTicketPetition("t-1", "pet-1")).rejects.toThrow(
          "Failed to link petition",
        );
      });
    });
  });

  // ─── Admin API ────────────────────────────────────────────────────

  describe("Admin API", () => {
    describe("getAdminResidentTickets", () => {
      it("fetches with filters", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ data: [], total: 0 }));
        await getAdminResidentTickets({ status: "OPEN" });
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=OPEN"));
      });

      it("omits empty filter values", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ data: [], total: 0 }));
        await getAdminResidentTickets({ status: "", priority: "HIGH" });
        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).not.toContain("status=");
        expect(url).toContain("priority=HIGH");
      });

      it("fetches with no filters", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ data: [], total: 0 }));
        await getAdminResidentTickets();
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/admin/resident-support?"),
        );
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getAdminResidentTickets()).rejects.toThrow("Failed to fetch resident tickets");
      });
    });

    describe("getAdminResidentStats", () => {
      it("fetches stats", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ open: 5, resolved: 10 }));
        const result = await getAdminResidentStats();
        expect(result).toEqual({ open: 5, resolved: 10 });
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getAdminResidentStats()).rejects.toThrow(
          "Failed to fetch resident ticket stats",
        );
      });
    });

    describe("getAdminResidentTicketDetail", () => {
      it("fetches by id", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1" }));
        const result = await getAdminResidentTicketDetail("t-1");
        expect(result).toEqual({ id: "t-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/admin/resident-support/t-1"),
        );
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getAdminResidentTicketDetail("t-1")).rejects.toThrow(
          "Failed to fetch ticket detail",
        );
      });
    });

    describe("postAdminResidentMessage", () => {
      it("posts message content", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "msg-1" }));
        const result = await postAdminResidentMessage("t-1", {
          content: "Admin reply",
          isInternal: false,
        });
        expect(result).toEqual({ id: "msg-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/admin/resident-support/t-1/messages"),
          expect.objectContaining({ method: "POST" }),
        );
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(
          postAdminResidentMessage("t-1", { content: "Test", isInternal: false }),
        ).rejects.toThrow("Failed to post message");
      });
    });

    describe("changeAdminResidentTicketStatus", () => {
      it("sends PATCH with status data", async () => {
        mockFetch.mockResolvedValue({ ok: true });
        await changeAdminResidentTicketStatus("t-1", { status: "RESOLVED" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/t-1/status"),
          expect.objectContaining({ method: "PATCH" }),
        );
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Invalid transition"));
        await expect(changeAdminResidentTicketStatus("t-1", { status: "OPEN" })).rejects.toThrow(
          "Invalid transition",
        );
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(changeAdminResidentTicketStatus("t-1", { status: "OPEN" })).rejects.toThrow(
          "Failed to change status",
        );
      });
    });

    describe("changeAdminResidentTicketPriority", () => {
      it("sends PATCH with priority data", async () => {
        mockFetch.mockResolvedValue({ ok: true });
        await changeAdminResidentTicketPriority("t-1", { priority: "HIGH" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/t-1/priority"),
          expect.objectContaining({ method: "PATCH" }),
        );
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Forbidden"));
        await expect(changeAdminResidentTicketPriority("t-1", { priority: "LOW" })).rejects.toThrow(
          "Forbidden",
        );
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(changeAdminResidentTicketPriority("t-1", { priority: "LOW" })).rejects.toThrow(
          "Failed to change priority",
        );
      });
    });

    describe("linkTicketPetition", () => {
      it("sends PATCH with petitionId", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1", petitionId: "pet-1" }));
        const result = await linkTicketPetition("t-1", "pet-1");
        expect(result).toEqual({ id: "t-1", petitionId: "pet-1" });
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/admin/resident-support/t-1/link-petition"),
          expect.objectContaining({ method: "PATCH" }),
        );
      });

      it("sends PATCH with null to unlink", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "t-1", petitionId: null }));
        await linkTicketPetition("t-1", null);
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.petitionId).toBeNull();
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("Not found"));
        await expect(linkTicketPetition("t-1", "pet-1")).rejects.toThrow("Not found");
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        await expect(linkTicketPetition("t-1", "pet-1")).rejects.toThrow("Failed to link petition");
      });
    });

    describe("getAdminResidentUnreadCount", () => {
      it("fetches unread count", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ count: 7 }));
        const result = await getAdminResidentUnreadCount();
        expect(result.count).toBe(7);
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getAdminResidentUnreadCount()).rejects.toThrow("Failed to fetch unread count");
      });
    });

    describe("uploadAdminResidentAttachment", () => {
      it("uploads file with FormData", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "att-1", url: "https://x.com/f" }));
        const file = new File(["content"], "report.pdf", { type: "application/pdf" });
        const result = await uploadAdminResidentAttachment("t-1", file);
        expect(result).toEqual({ id: "att-1", url: "https://x.com/f" });
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toContain("/admin/resident-support/t-1/attachments");
        expect(opts.body).toBeInstanceOf(FormData);
        expect(opts.method).toBe("POST");
      });

      it("includes messageId in FormData when provided", async () => {
        mockFetch.mockResolvedValue(mockOkResponse({ id: "att-2" }));
        const file = new File(["content"], "img.jpg", { type: "image/jpeg" });
        await uploadAdminResidentAttachment("t-1", file, "msg-10");
        const body = mockFetch.mock.calls[0][1].body as FormData;
        expect(body.get("messageId")).toBe("msg-10");
      });

      it("throws with server error message", async () => {
        mockFetch.mockResolvedValue(mockErrorResponse("File too large"));
        const file = new File(["x"], "big.zip");
        await expect(uploadAdminResidentAttachment("t-1", file)).rejects.toThrow("File too large");
      });

      it("throws fallback message", async () => {
        mockFetch.mockResolvedValue(mockErrorNoMessage());
        const file = new File(["x"], "big.zip");
        await expect(uploadAdminResidentAttachment("t-1", file)).rejects.toThrow(
          "Failed to upload attachment",
        );
      });
    });

    describe("getAdminResidentAttachments", () => {
      it("fetches attachments", async () => {
        mockFetch.mockResolvedValue(mockOkResponse([{ id: "att-1" }]));
        const result = await getAdminResidentAttachments("t-1");
        expect(result).toEqual([{ id: "att-1" }]);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/admin/resident-support/t-1/attachments"),
        );
      });

      it("throws on error", async () => {
        mockFetch.mockResolvedValue({ ok: false });
        await expect(getAdminResidentAttachments("t-1")).rejects.toThrow(
          "Failed to fetch attachments",
        );
      });
    });
  });
});
