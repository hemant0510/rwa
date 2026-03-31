import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getSAResidents,
  getSAResident,
  getSAFees,
  getSAFeesSummary,
  getSAExpenses,
  getSAExpensesSummary,
  getSAEvents,
  getSAEvent,
  getSAPetitions,
  getSAPetition,
  getSAPetitionReportUrl,
  getSABroadcasts,
  getSAGoverningBody,
  getSAMigrations,
  getSASettings,
  getSAReport,
} from "@/services/sa-society-deep-dive";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errRes() {
  return { ok: false, json: () => Promise.resolve({ error: "fail" }) };
}

const BASE = "/api/v1/super-admin/societies";
const SOC = "soc-1";

describe("sa-society-deep-dive service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(okJson({}));
  });

  describe("getSAResidents", () => {
    it("fetches residents without filters", async () => {
      await getSAResidents(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/residents`);
    });

    it("fetches residents with filters", async () => {
      await getSAResidents(SOC, { status: "ACTIVE", search: "john", page: 2, limit: 10 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=ACTIVE");
      expect(url).toContain("search=john");
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAResidents(SOC)).rejects.toThrow("Failed to fetch residents");
    });
  });

  describe("getSAResident", () => {
    it("fetches single resident", async () => {
      await getSAResident(SOC, "user-1");
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/residents/user-1`);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAResident(SOC, "user-1")).rejects.toThrow("Failed to fetch resident");
    });
  });

  describe("getSAFees", () => {
    it("fetches fees without session", async () => {
      await getSAFees(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/fees`);
    });

    it("fetches fees with session", async () => {
      await getSAFees(SOC, "2025-26");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("session=2025-26");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAFees(SOC)).rejects.toThrow("Failed to fetch fees");
    });
  });

  describe("getSAFeesSummary", () => {
    it("fetches fee summary without session", async () => {
      await getSAFeesSummary(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/fees/summary`);
    });

    it("fetches fee summary with session", async () => {
      await getSAFeesSummary(SOC, "2025-26");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("session=2025-26");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAFeesSummary(SOC)).rejects.toThrow("Failed to fetch fee summary");
    });
  });

  describe("getSAExpenses", () => {
    it("fetches expenses without filters", async () => {
      await getSAExpenses(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/expenses`);
    });

    it("fetches expenses with all filters", async () => {
      await getSAExpenses(SOC, {
        category: "MAINTENANCE",
        scope: "general",
        from: "2026-01-01",
        to: "2026-03-31",
        page: 1,
        limit: 50,
      });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("category=MAINTENANCE");
      expect(url).toContain("scope=general");
      expect(url).toContain("from=2026-01-01");
      expect(url).toContain("to=2026-03-31");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAExpenses(SOC)).rejects.toThrow("Failed to fetch expenses");
    });
  });

  describe("getSAExpensesSummary", () => {
    it("fetches expense summary", async () => {
      await getSAExpensesSummary(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/expenses/summary`);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAExpensesSummary(SOC)).rejects.toThrow("Failed to fetch expense summary");
    });
  });

  describe("getSAEvents", () => {
    it("fetches events without filters", async () => {
      await getSAEvents(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/events`);
    });

    it("fetches events with filters", async () => {
      await getSAEvents(SOC, { status: "PUBLISHED", category: "MEETING" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=PUBLISHED");
      expect(url).toContain("category=MEETING");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAEvents(SOC)).rejects.toThrow("Failed to fetch events");
    });
  });

  describe("getSAEvent", () => {
    it("fetches single event", async () => {
      await getSAEvent(SOC, "event-1");
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/events/event-1`);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAEvent(SOC, "event-1")).rejects.toThrow("Failed to fetch event");
    });
  });

  describe("getSAPetitions", () => {
    it("fetches petitions without filters", async () => {
      await getSAPetitions(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/petitions`);
    });

    it("fetches petitions with filters", async () => {
      await getSAPetitions(SOC, { status: "PUBLISHED", type: "COMPLAINT" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=PUBLISHED");
      expect(url).toContain("type=COMPLAINT");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAPetitions(SOC)).rejects.toThrow("Failed to fetch petitions");
    });
  });

  describe("getSAPetition", () => {
    it("fetches single petition", async () => {
      await getSAPetition(SOC, "petition-1");
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/petitions/petition-1`);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAPetition(SOC, "petition-1")).rejects.toThrow("Failed to fetch petition");
    });
  });

  describe("getSAPetitionReportUrl", () => {
    it("returns the correct URL without fetching", () => {
      const url = getSAPetitionReportUrl(SOC, "petition-1");
      expect(url).toBe(`${BASE}/${SOC}/petitions/petition-1/report`);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getSABroadcasts", () => {
    it("fetches broadcasts without filters", async () => {
      await getSABroadcasts(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/broadcasts`);
    });

    it("fetches broadcasts with page/limit", async () => {
      await getSABroadcasts(SOC, { page: 2, limit: 10 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSABroadcasts(SOC)).rejects.toThrow("Failed to fetch broadcasts");
    });
  });

  describe("getSAGoverningBody", () => {
    it("fetches governing body", async () => {
      await getSAGoverningBody(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/governing-body`);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAGoverningBody(SOC)).rejects.toThrow("Failed to fetch governing body");
    });
  });

  describe("getSAMigrations", () => {
    it("fetches migrations without filters", async () => {
      await getSAMigrations(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/migrations`);
    });

    it("fetches migrations with filters", async () => {
      await getSAMigrations(SOC, { page: 3, limit: 5 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=3");
      expect(url).toContain("limit=5");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAMigrations(SOC)).rejects.toThrow("Failed to fetch migrations");
    });
  });

  describe("getSASettings", () => {
    it("fetches settings", async () => {
      await getSASettings(SOC);
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/settings`);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSASettings(SOC)).rejects.toThrow("Failed to fetch settings");
    });
  });

  describe("getSAReport", () => {
    it("fetches report without session", async () => {
      await getSAReport(SOC, "collection-summary");
      expect(mockFetch).toHaveBeenCalledWith(`${BASE}/${SOC}/reports/collection-summary`);
    });

    it("fetches report with session", async () => {
      await getSAReport(SOC, "expense-summary", "2025-26");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("session=2025-26");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue(errRes());
      await expect(getSAReport(SOC, "collection-summary")).rejects.toThrow(
        "Failed to fetch collection-summary report",
      );
    });
  });
});
