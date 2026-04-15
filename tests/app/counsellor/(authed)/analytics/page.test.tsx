import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPortfolioAnalytics = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellor-self", () => ({
  getPortfolioAnalytics: mockGetPortfolioAnalytics,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import CounsellorAnalyticsPage from "@/app/counsellor/(authed)/analytics/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorAnalyticsPage />
    </QueryClientProvider>,
  );
}

const analytics = {
  generatedAt: new Date().toISOString(),
  windowDays: 30,
  totals: {
    societies: 2,
    escalationsAllTime: 5,
    escalationsInWindow: 3,
    openEscalations: 2,
    pendingAck: 1,
    acknowledged: 1,
    resolved: 1,
    deferred: 0,
    withdrawn: 1,
    slaBreachedOpen: 0,
    avgResolutionHours: 4,
  },
  byType: [{ type: "NOISE", count: 3 }],
  bySociety: [
    {
      societyId: "s-1",
      societyName: "Alpha",
      societyCode: "ALPHA",
      open: 1,
      resolved: 1,
      total: 3,
    },
  ],
  byStatus: [
    { status: "PENDING", count: 1 },
    { status: "ACKNOWLEDGED", count: 1 },
    { status: "REVIEWING", count: 0 },
    { status: "RESOLVED_BY_COUNSELLOR", count: 1 },
    { status: "DEFERRED_TO_ADMIN", count: 0 },
    { status: "WITHDRAWN", count: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorAnalyticsPage", () => {
  it("renders loading skeleton initially", () => {
    mockGetPortfolioAnalytics.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
    expect(screen.getByText(/Portfolio analytics/)).toBeInTheDocument();
  });

  it("renders error banner on failure", async () => {
    mockGetPortfolioAnalytics.mockRejectedValue(new Error("server"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load analytics/)).toBeInTheDocument();
    });
  });

  it("renders analytics view on success", async () => {
    mockGetPortfolioAnalytics.mockResolvedValue(analytics);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("Societies")).toBeInTheDocument();
  });

  it("refetches with selected window when clicking window buttons", async () => {
    mockGetPortfolioAnalytics.mockResolvedValue(analytics);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Last 7 days/ }));
    await waitFor(() => {
      expect(mockGetPortfolioAnalytics).toHaveBeenCalledWith({ windowDays: 7 });
    });

    fireEvent.click(screen.getByRole("button", { name: /Last 90 days/ }));
    await waitFor(() => {
      expect(mockGetPortfolioAnalytics).toHaveBeenCalledWith({ windowDays: 90 });
    });
  });
});
