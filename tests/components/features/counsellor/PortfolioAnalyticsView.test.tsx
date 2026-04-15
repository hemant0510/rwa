import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PortfolioAnalyticsView } from "@/components/features/counsellor/PortfolioAnalyticsView";
import type { CounsellorPortfolioAnalytics } from "@/types/counsellor";

const baseData: CounsellorPortfolioAnalytics = {
  generatedAt: new Date().toISOString(),
  windowDays: 30,
  totals: {
    societies: 2,
    escalationsAllTime: 10,
    escalationsInWindow: 6,
    openEscalations: 3,
    pendingAck: 1,
    acknowledged: 1,
    resolved: 4,
    deferred: 1,
    withdrawn: 1,
    slaBreachedOpen: 2,
    avgResolutionHours: 6,
  },
  byType: [
    { type: "NOISE", count: 4 },
    { type: "PARKING", count: 2 },
  ],
  bySociety: [
    {
      societyId: "s-1",
      societyName: "Alpha",
      societyCode: "ALPHA",
      open: 2,
      resolved: 3,
      total: 6,
    },
    { societyId: "s-2", societyName: "Beta", societyCode: "BETA", open: 1, resolved: 1, total: 4 },
  ],
  byStatus: [
    { status: "PENDING", count: 1 },
    { status: "ACKNOWLEDGED", count: 1 },
    { status: "REVIEWING", count: 1 },
    { status: "RESOLVED_BY_COUNSELLOR", count: 4 },
    { status: "DEFERRED_TO_ADMIN", count: 1 },
    { status: "WITHDRAWN", count: 1 },
  ],
};

describe("PortfolioAnalyticsView", () => {
  it("renders totals stat cards", () => {
    render(<PortfolioAnalyticsView data={baseData} />);
    expect(screen.getByText("Societies")).toBeInTheDocument();
    expect(screen.getByText("Open escalations")).toBeInTheDocument();
    expect(screen.getByText("SLA breached (open)")).toBeInTheDocument();
    expect(screen.getByText("Avg resolution (h)")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders type bars with proportional widths", () => {
    const { container } = render(<PortfolioAnalyticsView data={baseData} />);
    const noise = container.querySelector('[data-testid="type-bar-NOISE"]') as HTMLElement;
    const parking = container.querySelector('[data-testid="type-bar-PARKING"]') as HTMLElement;
    expect(noise.style.width).toBe("100%");
    expect(parking.style.width).toBe("50%");
  });

  it("renders per-society rows with bars", () => {
    const { container } = render(<PortfolioAnalyticsView data={baseData} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    const s1 = container.querySelector('[data-testid="society-bar-s-1"]') as HTMLElement;
    expect(s1.style.width).toBe("100%");
  });

  it("renders status mix badges for all statuses", () => {
    render(<PortfolioAnalyticsView data={baseData} />);
    expect(screen.getByText(/PENDING/)).toBeInTheDocument();
    expect(screen.getByText(/RESOLVED BY COUNSELLOR/)).toBeInTheDocument();
  });

  it("shows dash when avgResolutionHours is null", () => {
    render(
      <PortfolioAnalyticsView
        data={{ ...baseData, totals: { ...baseData.totals, avgResolutionHours: null } }}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows empty state for byType when empty", () => {
    render(<PortfolioAnalyticsView data={{ ...baseData, byType: [] }} />);
    expect(screen.getByText(/No escalations in the selected window/)).toBeInTheDocument();
  });

  it("shows empty state for bySociety when empty", () => {
    render(<PortfolioAnalyticsView data={{ ...baseData, bySociety: [] }} />);
    expect(screen.getByText(/No societies in your portfolio yet/)).toBeInTheDocument();
  });

  it("renders society bar at 0% when maxSocietyTotal is 0", () => {
    const { container } = render(
      <PortfolioAnalyticsView
        data={{
          ...baseData,
          bySociety: [
            {
              societyId: "s-1",
              societyName: "Alpha",
              societyCode: "ALPHA",
              open: 0,
              resolved: 0,
              total: 0,
            },
          ],
        }}
      />,
    );
    const bar = container.querySelector('[data-testid="society-bar-s-1"]') as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("applies danger tone when slaBreachedOpen > 0 and neutral otherwise", () => {
    const { rerender, container } = render(<PortfolioAnalyticsView data={baseData} />);
    expect(container.innerHTML).toContain("bg-red-50");

    rerender(
      <PortfolioAnalyticsView
        data={{ ...baseData, totals: { ...baseData.totals, slaBreachedOpen: 0 } }}
      />,
    );
    expect(container.innerHTML).toContain("bg-emerald-50");
  });
});
