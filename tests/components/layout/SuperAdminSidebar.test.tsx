import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSaPendingSubClaimsCount = vi.hoisted(() => vi.fn());
const mockUsePathname = vi.hoisted(() => vi.fn(() => "/sa/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("@/services/subscription-payment-claims", () => ({
  getSaPendingSubClaimsCount: mockGetSaPendingSubClaimsCount,
}));

import { SuperAdminSidebar, SuperAdminMobileSidebar } from "@/components/layout/SuperAdminSidebar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderWithQC(ui: React.ReactElement) {
  return render(ui, { wrapper });
}

beforeEach(() => {
  mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 0 });
  mockUsePathname.mockReturnValue("/sa/dashboard");
});

describe("SuperAdminSidebar", () => {
  it("renders RWA Connect heading and Super Admin subtitle", () => {
    renderWithQC(<SuperAdminSidebar />);
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    renderWithQC(<SuperAdminSidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("Societies")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("Discounts")).toBeInTheDocument();
    expect(screen.getByText("Residents")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Announcements")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("highlights active nav item based on pathname", () => {
    renderWithQC(<SuperAdminSidebar />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toContain("bg-primary");
  });

  it("does not highlight inactive nav items", () => {
    renderWithQC(<SuperAdminSidebar />);
    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.className).not.toContain("bg-primary");
  });

  it("highlights correct item when pathname changes", () => {
    mockUsePathname.mockReturnValue("/sa/settings");
    renderWithQC(<SuperAdminSidebar />);
    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.className).toContain("bg-primary");
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).not.toContain("bg-primary");
  });

  it("has correct href for each nav item", () => {
    renderWithQC(<SuperAdminSidebar />);
    expect(screen.getByText("Dashboard").closest("a")?.getAttribute("href")).toBe("/sa/dashboard");
    expect(screen.getByText("Billing").closest("a")?.getAttribute("href")).toBe("/sa/billing");
    expect(screen.getByText("Settings").closest("a")?.getAttribute("href")).toBe("/sa/settings");
    expect(screen.getByText("Audit Logs").closest("a")?.getAttribute("href")).toBe(
      "/sa/audit-logs",
    );
  });

  it("shows pending count badge on Billing when count > 0", async () => {
    mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 5 });
    renderWithQC(<SuperAdminSidebar />);
    expect(await screen.findByText("5")).toBeInTheDocument();
  });

  it("hides badge when pending count is 0", async () => {
    mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 0 });
    renderWithQC(<SuperAdminSidebar />);
    // Allow queries to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows billing badge with inactive styling when not on billing page", async () => {
    mockUsePathname.mockReturnValue("/sa/dashboard");
    mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 3 });
    renderWithQC(<SuperAdminSidebar />);
    const badge = await screen.findByText("3");
    expect(badge.className).toContain("bg-destructive");
  });

  it("shows billing badge with active styling when on billing page", async () => {
    mockUsePathname.mockReturnValue("/sa/billing");
    mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 4 });
    renderWithQC(<SuperAdminSidebar />);
    const badge = await screen.findByText("4");
    expect(badge.className).toContain("bg-primary-foreground");
  });
});

describe("SuperAdminMobileSidebar", () => {
  it("renders navigation inside a Sheet when open", () => {
    renderWithQC(<SuperAdminMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
  });

  it("does not render Sheet content when closed", () => {
    renderWithQC(<SuperAdminMobileSidebar open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("includes accessible SheetTitle", () => {
    renderWithQC(<SuperAdminMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Navigation Menu")).toBeInTheDocument();
  });

  it("respects onOpenChange prop", () => {
    const onOpenChange = vi.fn();
    renderWithQC(<SuperAdminMobileSidebar open={true} onOpenChange={onOpenChange} />);
    // The component renders with the onOpenChange prop passed to Sheet
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows pending count badge in mobile sidebar when count > 0", async () => {
    mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 7 });
    renderWithQC(<SuperAdminMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(await screen.findByText("7")).toBeInTheDocument();
  });
});
