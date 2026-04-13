import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetResidentUnreadCount = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUsePathname = vi.hoisted(() => vi.fn(() => "/r/home"));

vi.mock("@/services/resident-support", () => ({
  getResidentUnreadCount: mockGetResidentUnreadCount,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));
vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

import { ResidentSidebar, ResidentMobileSidebar } from "@/components/layout/ResidentSidebar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderWithQC(ui: React.ReactElement) {
  return render(ui, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetResidentUnreadCount.mockResolvedValue({ count: 0 });
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  mockUsePathname.mockReturnValue("/r/home");
});

describe("ResidentSidebar", () => {
  it("renders RWA Connect heading", () => {
    renderWithQC(<ResidentSidebar societyName="Eden Estate" />);
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
  });

  it("renders society name as subtitle", () => {
    renderWithQC(<ResidentSidebar societyName="Eden Estate" />);
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("renders Resident Portal when no society name", () => {
    renderWithQC(<ResidentSidebar />);
    expect(screen.getByText("Resident Portal")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    renderWithQC(<ResidentSidebar societyName="Test" />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Petitions")).toBeInTheDocument();
    expect(screen.getByText("Committee")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("keeps Profile active when on /r/profile/family sub-route (longest prefix match)", () => {
    mockUsePathname.mockReturnValue("/r/profile/family");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const profileLink = screen.getByText("Profile").closest("a");
    expect(profileLink?.className).toContain("bg-primary");
  });

  it("keeps Profile active when on /r/profile/vehicles sub-route", () => {
    mockUsePathname.mockReturnValue("/r/profile/vehicles");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const profileLink = screen.getByText("Profile").closest("a");
    expect(profileLink?.className).toContain("bg-primary");
  });

  it("highlights Profile when on /r/profile exactly", () => {
    mockUsePathname.mockReturnValue("/r/profile");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const profileLink = screen.getByText("Profile").closest("a");
    expect(profileLink?.className).toContain("bg-primary");
  });

  it("highlights nothing when pathname does not match any nav item", () => {
    mockUsePathname.mockReturnValue("/r/unknown");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).not.toContain("bg-primary");
  });

  it("highlights active link based on pathname", () => {
    mockUsePathname.mockReturnValue("/r/home");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("bg-primary");
  });

  it("does not highlight inactive links", () => {
    mockUsePathname.mockReturnValue("/r/home");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const paymentsLink = screen.getByText("Payments").closest("a");
    expect(paymentsLink?.className).not.toContain("bg-primary");
  });

  it("highlights correct item when on support page", () => {
    mockUsePathname.mockReturnValue("/r/support");
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const supportLink = screen.getByText("Support").closest("a");
    expect(supportLink?.className).toContain("bg-primary");
  });

  it("has correct href for each nav item", () => {
    renderWithQC(<ResidentSidebar societyName="Test" />);
    expect(screen.getByText("Home").closest("a")?.getAttribute("href")).toBe("/r/home");
    expect(screen.getByText("Support").closest("a")?.getAttribute("href")).toBe("/r/support");
    expect(screen.getByText("Profile").closest("a")?.getAttribute("href")).toBe("/r/profile");
  });

  it("shows unread badge on Support when count > 0", async () => {
    mockGetResidentUnreadCount.mockResolvedValue({ count: 3 });
    renderWithQC(<ResidentSidebar societyName="Test" />);
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("hides badge when unread count is 0", async () => {
    mockGetResidentUnreadCount.mockResolvedValue({ count: 0 });
    renderWithQC(<ResidentSidebar societyName="Test" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows badge with inactive styling when not on support page", async () => {
    mockUsePathname.mockReturnValue("/r/home");
    mockGetResidentUnreadCount.mockResolvedValue({ count: 5 });
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const badge = await screen.findByText("5");
    expect(badge.className).toContain("bg-red-500");
  });

  it("shows badge with active styling when on support page", async () => {
    mockUsePathname.mockReturnValue("/r/support");
    mockGetResidentUnreadCount.mockResolvedValue({ count: 2 });
    renderWithQC(<ResidentSidebar societyName="Test" />);
    const badge = await screen.findByText("2");
    expect(badge.className).toContain("bg-primary-foreground");
  });

  it("does not fetch unread count when user is not logged in", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderWithQC(<ResidentSidebar societyName="Test" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetResidentUnreadCount).not.toHaveBeenCalled();
  });
});

describe("ResidentMobileSidebar", () => {
  it("renders navigation inside a Sheet when open", () => {
    renderWithQC(<ResidentMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
  });

  it("does not render Sheet content when closed", () => {
    renderWithQC(<ResidentMobileSidebar open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("includes accessible SheetTitle", () => {
    renderWithQC(<ResidentMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Navigation Menu")).toBeInTheDocument();
  });

  it("respects societyName prop in mobile sidebar", () => {
    renderWithQC(
      <ResidentMobileSidebar open={true} onOpenChange={vi.fn()} societyName="Green Acres" />,
    );
    expect(screen.getByText("Green Acres")).toBeInTheDocument();
  });

  it("shows unread badge in mobile sidebar when count > 0", async () => {
    mockGetResidentUnreadCount.mockResolvedValue({ count: 7 });
    renderWithQC(<ResidentMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(await screen.findByText("7")).toBeInTheDocument();
  });
});
