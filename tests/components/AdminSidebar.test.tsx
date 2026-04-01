import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUnreadAnnouncements = vi.hoisted(() => vi.fn());
vi.mock("@/services/announcements", () => ({
  getUnreadAnnouncements: mockGetUnreadAnnouncements,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));

import { AdminSidebar, AdminMobileSidebar } from "@/components/layout/AdminSidebar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderWithQC(ui: React.ReactElement) {
  return render(ui, { wrapper });
}

beforeEach(() => {
  mockGetUnreadAnnouncements.mockResolvedValue([]);
});

describe("AdminSidebar", () => {
  it("renders RWA Admin heading", () => {
    renderWithQC(<AdminSidebar societyName="Eden Estate" />);
    expect(screen.getByText("RWA Admin")).toBeInTheDocument();
  });

  it("renders society name as subtitle", () => {
    renderWithQC(<AdminSidebar societyName="Eden Estate" />);
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("renders Admin Portal when no society name", () => {
    renderWithQC(<AdminSidebar />);
    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    renderWithQC(<AdminSidebar societyName="Test" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Residents")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Broadcast")).toBeInTheDocument();
    expect(screen.getByText("Migration")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("highlights active link", () => {
    renderWithQC(<AdminSidebar societyName="Test" />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toContain("bg-primary");
  });

  it("appends query string to nav links", () => {
    renderWithQC(<AdminSidebar societyName="Test" queryString="?sid=soc-1&sname=Test" />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.getAttribute("href")).toContain("?sid=soc-1&sname=Test");
  });
});

describe("AdminMobileSidebar", () => {
  it("renders navigation inside a Sheet when open", () => {
    renderWithQC(
      <AdminMobileSidebar open={true} onOpenChange={vi.fn()} societyName="Eden Estate" />,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("does not render Sheet content when closed", () => {
    renderWithQC(
      <AdminMobileSidebar open={false} onOpenChange={vi.fn()} societyName="Eden Estate" />,
    );
    // Navigation items should not be visible when the sheet is closed
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("passes queryString to nav links", () => {
    renderWithQC(
      <AdminMobileSidebar
        open={true}
        onOpenChange={vi.fn()}
        societyName="Test"
        queryString="?sid=soc-1"
      />,
    );
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.getAttribute("href")).toContain("?sid=soc-1");
  });
});
