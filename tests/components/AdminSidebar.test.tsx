import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUnreadAnnouncements = vi.hoisted(() => vi.fn());
const mockGetAdminPendingClaimsCount = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/services/announcements", () => ({
  getUnreadAnnouncements: mockGetUnreadAnnouncements,
}));
vi.mock("@/services/admin-payment-claims", () => ({
  getAdminPendingClaimsCount: mockGetAdminPendingClaimsCount,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

const mockUsePathname = vi.hoisted(() => vi.fn(() => "/admin/dashboard"));
vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
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
  mockGetAdminPendingClaimsCount.mockResolvedValue({ count: 0 });
  mockUseAuth.mockReturnValue({ user: { societyId: "soc-1" } });
  mockUsePathname.mockReturnValue("/admin/dashboard");
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

  it("shows pending claims badge on Fees when count > 0", async () => {
    mockGetAdminPendingClaimsCount.mockResolvedValue({ count: 3 });
    renderWithQC(<AdminSidebar societyName="Test" queryString="?sid=soc-1" />);
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("shows announcements badge when unread count > 0", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    renderWithQC(<AdminSidebar societyName="Test" />);
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("does not show fees badge when pending count is 0", async () => {
    mockGetAdminPendingClaimsCount.mockResolvedValue({ count: 0 });
    renderWithQC(<AdminSidebar societyName="Test" queryString="?sid=soc-1" />);
    // Allow queries to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("resolves societyId from user when no sid in queryString", async () => {
    mockGetAdminPendingClaimsCount.mockResolvedValue({ count: 2 });
    // No queryString — should fall back to user?.societyId from useAuth
    renderWithQC(<AdminSidebar societyName="Test" />);
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("uses empty societyId when user has no societyId and no queryString", () => {
    mockUseAuth.mockReturnValueOnce({ user: {} }); // user exists but no societyId
    renderWithQC(<AdminSidebar societyName="Test" />);
    // query is disabled (societyId is "") — no badge renders
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows fees badge with active styling when on fees page", async () => {
    mockUsePathname.mockReturnValue("/admin/fees");
    mockGetAdminPendingClaimsCount.mockResolvedValue({ count: 4 });
    renderWithQC(<AdminSidebar societyName="Test" queryString="?sid=soc-1" />);
    const badge = await screen.findByText("4");
    expect(badge.className).toContain("bg-primary-foreground");
  });

  it("shows announcements badge with active styling when on announcements page", async () => {
    mockUsePathname.mockReturnValue("/admin/announcements");
    mockGetUnreadAnnouncements.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]);
    renderWithQC(<AdminSidebar societyName="Test" />);
    const badge = await screen.findByText("3");
    expect(badge.className).toContain("bg-primary-foreground");
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
