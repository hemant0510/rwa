import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
  triggerPayment,
  cancelEvent,
  completeEvent,
  getRegistrations,
  recordEventPayment,
  getEventFinances,
  addEventExpense,
  settleEvent,
  getResidentEvents,
  registerForEvent,
  cancelRegistration,
  getResidentEventFinances,
} from "@/services/events";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("events service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Admin: Events ──

  describe("getEvents", () => {
    it("fetches events without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      const result = await getEvents("soc-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/societies/soc-1/events"));
      expect(result.total).toBe(0);
    });

    it("appends status and category params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getEvents("soc-1", { status: "PUBLISHED", category: "CULTURAL", page: 2, limit: 10 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=PUBLISHED"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("category=CULTURAL"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getEvents("soc-1")).rejects.toThrow("Failed to fetch events");
    });
  });

  describe("createEvent", () => {
    const eventData = {
      title: "Diwali Celebration",
      category: "CULTURAL" as const,
      feeModel: "FREE" as const,
      eventDate: "2025-11-01",
    };

    it("sends POST to events endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", title: "Diwali Celebration" }));
      const result = await createEvent("soc-1", eventData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.id).toBe("evt-1");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Title already exists" } }));
      await expect(createEvent("soc-1", eventData)).rejects.toThrow("Title already exists");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(createEvent("soc-1", eventData)).rejects.toThrow("Failed to create event");
    });
  });

  describe("getEvent", () => {
    it("fetches a single event by id", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", title: "Annual Meet" }));
      const result = await getEvent("soc-1", "evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1"),
      );
      expect(result.id).toBe("evt-1");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getEvent("soc-1", "evt-1")).rejects.toThrow("Failed to fetch event");
    });
  });

  describe("updateEvent", () => {
    it("sends PATCH to event endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", title: "Updated Title" }));
      await updateEvent("soc-1", "evt-1", { title: "Updated Title" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("sends partial update body correctly", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1" }));
      await updateEvent("soc-1", "evt-1", { location: "Community Hall" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.location).toBe("Community Hall");
      expect(body.title).toBeUndefined();
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Event already published" } }));
      await expect(updateEvent("soc-1", "evt-1", { title: "New" })).rejects.toThrow(
        "Event already published",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(updateEvent("soc-1", "evt-1", { title: "New" })).rejects.toThrow(
        "Failed to update event",
      );
    });
  });

  describe("deleteEvent", () => {
    it("sends DELETE to event endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Deleted" }));
      const result = await deleteEvent("soc-1", "evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(result.message).toBe("Deleted");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Cannot delete published event" } }));
      await expect(deleteEvent("soc-1", "evt-1")).rejects.toThrow("Cannot delete published event");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(deleteEvent("soc-1", "evt-1")).rejects.toThrow("Failed to delete event");
    });
  });

  // ── Admin: Event Actions ──

  describe("publishEvent", () => {
    it("sends POST to publish endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", status: "PUBLISHED" }));
      const result = await publishEvent("soc-1", "evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/publish"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("PUBLISHED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already published" } }));
      await expect(publishEvent("soc-1", "evt-1")).rejects.toThrow("Already published");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(publishEvent("soc-1", "evt-1")).rejects.toThrow("Failed to publish event");
    });
  });

  describe("triggerPayment", () => {
    const triggerData = { feeAmount: 500 };

    it("sends POST to trigger-payment endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", transitionedCount: 12 }));
      const result = await triggerPayment("soc-1", "evt-1", triggerData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/trigger-payment"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.transitionedCount).toBe(12);
    });

    it("includes body in request", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", transitionedCount: 5 }));
      await triggerPayment("soc-1", "evt-1", triggerData);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.feeAmount).toBe(500);
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Invalid state" } }));
      await expect(triggerPayment("soc-1", "evt-1", triggerData)).rejects.toThrow("Invalid state");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(triggerPayment("soc-1", "evt-1", triggerData)).rejects.toThrow(
        "Failed to trigger payment",
      );
    });
  });

  describe("cancelEvent", () => {
    const cancelData = { reason: "Venue unavailable" };

    it("sends POST to cancel endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", status: "CANCELLED" }));
      const result = await cancelEvent("soc-1", "evt-1", cancelData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/cancel"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("CANCELLED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already cancelled" } }));
      await expect(cancelEvent("soc-1", "evt-1", cancelData)).rejects.toThrow("Already cancelled");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(cancelEvent("soc-1", "evt-1", cancelData)).rejects.toThrow(
        "Failed to cancel event",
      );
    });
  });

  describe("completeEvent", () => {
    it("sends POST to complete endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", status: "COMPLETED" }));
      const result = await completeEvent("soc-1", "evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/complete"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("COMPLETED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Event not yet due" } }));
      await expect(completeEvent("soc-1", "evt-1")).rejects.toThrow("Event not yet due");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(completeEvent("soc-1", "evt-1")).rejects.toThrow("Failed to complete event");
    });
  });

  // ── Admin: Registrations & Payments ──

  describe("getRegistrations", () => {
    it("fetches registrations without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      const result = await getRegistrations("soc-1", "evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/registrations"),
      );
      expect(result.total).toBe(0);
    });

    it("appends status, page and limit params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 2, limit: 5 }));
      await getRegistrations("soc-1", "evt-1", { status: "CONFIRMED", page: 2, limit: 5 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=CONFIRMED"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=5"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getRegistrations("soc-1", "evt-1")).rejects.toThrow(
        "Failed to fetch registrations",
      );
    });
  });

  describe("recordEventPayment", () => {
    const paymentData = {
      amount: 500,
      paymentMode: "CASH" as const,
      paymentDate: "2025-10-15",
    };

    it("sends POST to registration payment endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pay-1", amount: 500 }));
      const result = await recordEventPayment("soc-1", "evt-1", "reg-1", paymentData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/registrations/reg-1/payment"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.amount).toBe(500);
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Payment already recorded" } }));
      await expect(recordEventPayment("soc-1", "evt-1", "reg-1", paymentData)).rejects.toThrow(
        "Payment already recorded",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(recordEventPayment("soc-1", "evt-1", "reg-1", paymentData)).rejects.toThrow(
        "Failed to record payment",
      );
    });
  });

  // ── Admin: Finances ──

  describe("getEventFinances", () => {
    it("fetches event finances", async () => {
      mockFetch.mockResolvedValue(
        okJson({ totalCollected: 5000, totalExpenses: 2000, netAmount: 3000, isSettled: false }),
      );
      const result = await getEventFinances("soc-1", "evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/finances"),
      );
      expect(result.totalCollected).toBe(5000);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getEventFinances("soc-1", "evt-1")).rejects.toThrow("Failed to fetch finances");
    });
  });

  describe("addEventExpense", () => {
    const expenseData = {
      description: "Decorations",
      amount: 1500,
      category: "MAINTENANCE" as const,
      date: "2025-11-01",
    };

    it("sends POST to expenses endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "exp-1", amount: 1500 }));
      await addEventExpense("soc-1", "evt-1", expenseData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/expenses"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Event not active" } }));
      await expect(addEventExpense("soc-1", "evt-1", expenseData)).rejects.toThrow(
        "Event not active",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(addEventExpense("soc-1", "evt-1", expenseData)).rejects.toThrow(
        "Failed to add expense",
      );
    });
  });

  describe("settleEvent", () => {
    const settleData = {
      surplusDisposal: "CARRIED_FORWARD" as const,
      deficitDisposition: "FROM_SOCIETY_FUND" as const,
    };

    it("sends POST to settle endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "evt-1", status: "SETTLED" }));
      const result = await settleEvent("soc-1", "evt-1", settleData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1/events/evt-1/settle"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.status).toBe("SETTLED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Event not completed" } }));
      await expect(settleEvent("soc-1", "evt-1", settleData)).rejects.toThrow(
        "Event not completed",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(settleEvent("soc-1", "evt-1", settleData)).rejects.toThrow(
        "Failed to settle event",
      );
    });
  });

  // ── Resident: Events ──

  describe("getResidentEvents", () => {
    it("fetches resident events without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [] }));
      const result = await getResidentEvents();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/residents/me/events"));
      expect(result.data).toEqual([]);
    });

    it("appends upcoming and all params when provided", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [] }));
      await getResidentEvents({ upcoming: true, all: true });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("upcoming=true"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("all=true"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResidentEvents()).rejects.toThrow("Failed to fetch events");
    });
  });

  describe("registerForEvent", () => {
    const registerData = { memberCount: 2 };

    it("sends POST to register endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "reg-1", status: "CONFIRMED" }));
      const result = await registerForEvent("evt-1", registerData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/me/events/evt-1/register"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.id).toBe("reg-1");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Registration closed" } }));
      await expect(registerForEvent("evt-1", registerData)).rejects.toThrow("Registration closed");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(registerForEvent("evt-1", registerData)).rejects.toThrow("Failed to register");
    });
  });

  describe("cancelRegistration", () => {
    it("sends DELETE to register endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "reg-1", status: "CANCELLED" }));
      const result = await cancelRegistration("evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/me/events/evt-1/register"),
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(result.status).toBe("CANCELLED");
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "No active registration" } }));
      await expect(cancelRegistration("evt-1")).rejects.toThrow("No active registration");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(cancelRegistration("evt-1")).rejects.toThrow("Failed to cancel registration");
    });
  });

  describe("getResidentEventFinances", () => {
    it("fetches resident event finances", async () => {
      mockFetch.mockResolvedValue(
        okJson({ totalCollected: 1000, totalExpenses: 800, netAmount: 200, isSettled: true }),
      );
      const result = await getResidentEventFinances("evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/me/events/evt-1/finances"),
      );
      expect(result.isSettled).toBe(true);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResidentEventFinances("evt-1")).rejects.toThrow(
        "Failed to fetch event finances",
      );
    });
  });
});
