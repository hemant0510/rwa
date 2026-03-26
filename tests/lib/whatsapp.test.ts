import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("whatsapp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // ── sendTemplateMessage (core) ──────────────────────────────────────────────

  describe("sendTemplateMessage (via sendEventPublished)", () => {
    it("returns failure and warns when WATI is not configured", async () => {
      vi.stubEnv("WATI_API_URL", "");
      vi.stubEnv("WATI_API_KEY", "");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { sendEventPublished } = await import("@/lib/whatsapp");
      const result = await sendEventPublished(
        "9876543210",
        "Resident",
        "Event",
        "25 Mar 2026",
        "Hall",
        "Free Event",
      );
      expect(result).toEqual({ success: false, error: "WATI not configured" });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[WhatsApp] WATI not configured, skipping message send",
      );
      consoleSpy.mockRestore();
    });

    it("returns failure when fetch returns non-ok response", async () => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({ ok: false, text: async () => "Bad Request" });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { sendEventPublished } = await import("@/lib/whatsapp");
      const result = await sendEventPublished(
        "9876543210",
        "Resident",
        "Event",
        "25 Mar 2026",
        "Hall",
        "Free",
      );
      expect(result).toEqual({ success: false, error: "Bad Request" });
      expect(consoleSpy).toHaveBeenCalledWith("[WhatsApp] Send failed:", "Bad Request");
      consoleSpy.mockRestore();
    });

    it("returns failure when fetch throws", async () => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { sendEventPublished } = await import("@/lib/whatsapp");
      const result = await sendEventPublished(
        "9876543210",
        "Resident",
        "Event",
        "25 Mar 2026",
        "Hall",
        "Free",
      );
      expect(result).toEqual({ success: false, error: "Error: Network error" });
      consoleSpy.mockRestore();
    });

    it("returns success with messageId on successful fetch", async () => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-abc" }),
      });
      const { sendEventPublished } = await import("@/lib/whatsapp");
      const result = await sendEventPublished(
        "9876543210",
        "Resident",
        "Event",
        "25 Mar 2026",
        "Hall",
        "Free",
      );
      expect(result).toEqual({ success: true, messageId: "msg-abc" });
    });

    it("prepends country code 91 to mobile number in the request URL", async () => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-1" }),
      });
      const { sendEventPublished } = await import("@/lib/whatsapp");
      await sendEventPublished("9876543210", "Resident", "Event", "25 Mar 2026", "Hall", "Free");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.wati.io/api/v1/sendTemplateMessage?whatsappNumber=919876543210",
        expect.any(Object),
      );
    });

    it("sends Authorization Bearer header with API key", async () => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "secret-key-123");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-1" }),
      });
      const { sendEventPublished } = await import("@/lib/whatsapp");
      await sendEventPublished("9876543210", "R", "E", "D", "L", "F");
      const options = mockFetch.mock.calls[0][1];
      expect(options.headers.Authorization).toBe("Bearer secret-key-123");
    });
  });

  // ── sendEventPublished ──────────────────────────────────────────────────────

  describe("sendEventPublished", () => {
    beforeEach(() => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-1" }),
      });
    });

    it("uses event_published template", async () => {
      const { sendEventPublished } = await import("@/lib/whatsapp");
      await sendEventPublished("9876543210", "Priya", "Holi Fest", "25 Mar 2026", "Garden", "₹200");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("event_published");
    });

    it("maps all 5 parameters in correct order", async () => {
      const { sendEventPublished } = await import("@/lib/whatsapp");
      await sendEventPublished(
        "9876543210",
        "Priya",
        "Holi Fest",
        "25 Mar 2026",
        "Community Hall",
        "₹200",
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parameters).toEqual([
        { name: "1", value: "Priya" },
        { name: "2", value: "Holi Fest" },
        { name: "3", value: "25 Mar 2026" },
        { name: "4", value: "Community Hall" },
        { name: "5", value: "₹200" },
      ]);
    });
  });

  // ── sendEventPaymentTriggered ───────────────────────────────────────────────

  describe("sendEventPaymentTriggered", () => {
    beforeEach(() => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-1" }),
      });
    });

    it("uses event_payment_triggered template", async () => {
      const { sendEventPaymentTriggered } = await import("@/lib/whatsapp");
      await sendEventPaymentTriggered("9876543210", "Rahul", "Sports Day", "₹150", "₹300");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("event_payment_triggered");
    });

    it("maps all 4 parameters in correct order", async () => {
      const { sendEventPaymentTriggered } = await import("@/lib/whatsapp");
      await sendEventPaymentTriggered("9876543210", "Rahul", "Sports Day", "₹150", "₹300");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parameters).toEqual([
        { name: "1", value: "Rahul" },
        { name: "2", value: "Sports Day" },
        { name: "3", value: "₹150" },
        { name: "4", value: "₹300" },
      ]);
    });
  });

  // ── sendEventCancelled ──────────────────────────────────────────────────────

  describe("sendEventCancelled", () => {
    beforeEach(() => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-1" }),
      });
    });

    it("uses event_cancelled template", async () => {
      const { sendEventCancelled } = await import("@/lib/whatsapp");
      await sendEventCancelled("9876543210", "Anita", "Annual Meet", "Venue unavailable");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("event_cancelled");
    });

    it("maps all 3 parameters in correct order", async () => {
      const { sendEventCancelled } = await import("@/lib/whatsapp");
      await sendEventCancelled("9876543210", "Anita", "Annual Meet", "Venue unavailable");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parameters).toEqual([
        { name: "1", value: "Anita" },
        { name: "2", value: "Annual Meet" },
        { name: "3", value: "Venue unavailable" },
      ]);
    });
  });

  // ── pre-existing senders (parametric coverage) ─────────────────────────────

  describe("pre-existing sender templates", () => {
    beforeEach(() => {
      vi.stubEnv("WATI_API_URL", "https://api.wati.io");
      vi.stubEnv("WATI_API_KEY", "test-key");
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "msg-1" }),
      });
    });

    it("sendRegistrationConfirmation uses registration_confirmation template with 2 params", async () => {
      const { sendRegistrationConfirmation } = await import("@/lib/whatsapp");
      await sendRegistrationConfirmation("9876543210", "Alice", "Eden Estate");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("registration_confirmation");
      expect(body.parameters).toEqual([
        { name: "1", value: "Alice" },
        { name: "2", value: "Eden Estate" },
      ]);
    });

    it("sendApprovalNotification uses approval_notification template with 3 params", async () => {
      const { sendApprovalNotification } = await import("@/lib/whatsapp");
      await sendApprovalNotification("9876543210", "Bob", "RWA001", "Eden Estate");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("approval_notification");
      expect(body.parameters).toEqual([
        { name: "1", value: "Bob" },
        { name: "2", value: "RWA001" },
        { name: "3", value: "Eden Estate" },
      ]);
    });

    it("sendRejectionNotification uses rejection_notification template with 2 params", async () => {
      const { sendRejectionNotification } = await import("@/lib/whatsapp");
      await sendRejectionNotification("9876543210", "Carol", "Documents incomplete");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("rejection_notification");
      expect(body.parameters).toEqual([
        { name: "1", value: "Carol" },
        { name: "2", value: "Documents incomplete" },
      ]);
    });

    it("sendPaymentReceipt uses payment_receipt template with 4 params", async () => {
      const { sendPaymentReceipt } = await import("@/lib/whatsapp");
      await sendPaymentReceipt("9876543210", "Dave", "₹2,400", "REC-001", "2025-26");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("payment_receipt");
      expect(body.parameters).toEqual([
        { name: "1", value: "Dave" },
        { name: "2", value: "₹2,400" },
        { name: "3", value: "REC-001" },
        { name: "4", value: "2025-26" },
      ]);
    });

    it("sendFeeReminder uses fee_reminder template with 3 params", async () => {
      const { sendFeeReminder } = await import("@/lib/whatsapp");
      await sendFeeReminder("9876543210", "Eve", "₹1,200", "31 Mar 2026");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("fee_reminder");
      expect(body.parameters).toEqual([
        { name: "1", value: "Eve" },
        { name: "2", value: "₹1,200" },
        { name: "3", value: "31 Mar 2026" },
      ]);
    });

    it("sendBroadcastMessage uses broadcast_message template with 1 param", async () => {
      const { sendBroadcastMessage } = await import("@/lib/whatsapp");
      await sendBroadcastMessage("9876543210", "Society meeting tomorrow at 6 PM");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.template_name).toBe("broadcast_message");
      expect(body.parameters).toEqual([{ name: "1", value: "Society meeting tomorrow at 6 PM" }]);
    });
  });
});
