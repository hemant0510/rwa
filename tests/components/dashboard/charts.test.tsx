import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { PlanDistributionChart } from "@/components/features/dashboard/PlanDistributionChart";
import { RevenueCards, formatCurrency } from "@/components/features/dashboard/RevenueCards";
import { SocietyGrowthChart } from "@/components/features/dashboard/SocietyGrowthChart";

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Line: () => null,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("RevenueCards", () => {
  it("shows loading skeletons", () => {
    const { container } = render(<RevenueCards data={undefined} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });

  it("renders revenue data", () => {
    render(
      <RevenueCards
        data={{
          totalRevenue: 500000,
          monthlyRevenue: 50000,
          pendingDues: 20000,
          collectionRate: 85,
        }}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows dash when data is undefined", () => {
    render(<RevenueCards data={undefined} isLoading={false} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("formatCurrency", () => {
  it("formats lakhs", () => expect(formatCurrency(100000)).toBe("\u20B91.0L"));
  it("formats thousands", () => expect(formatCurrency(5000)).toBe("\u20B95.0K"));
  it("formats small values", () => expect(formatCurrency(500)).toBe("\u20B9500"));
});

describe("SocietyGrowthChart", () => {
  it("shows loading skeleton", () => {
    const { container } = render(<SocietyGrowthChart data={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty message when no data", () => {
    render(<SocietyGrowthChart data={[]} isLoading={false} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders chart when data exists", () => {
    render(<SocietyGrowthChart data={[{ month: "Jan", count: 5 }]} isLoading={false} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<SocietyGrowthChart data={[]} isLoading={false} />);
    expect(screen.getByText("Society Growth")).toBeInTheDocument();
  });
});

describe("PlanDistributionChart", () => {
  it("shows loading skeleton", () => {
    const { container } = render(<PlanDistributionChart data={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty message when no data", () => {
    render(<PlanDistributionChart data={[]} isLoading={false} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders chart when data exists", () => {
    render(<PlanDistributionChart data={[{ name: "Basic", count: 10 }]} isLoading={false} />);
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<PlanDistributionChart data={[]} isLoading={false} />);
    expect(screen.getByText("Plan Distribution")).toBeInTheDocument();
  });
});
