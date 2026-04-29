import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUsePathname = vi.hoisted(() => vi.fn(() => "/r/home"));
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockGetResidentUnreadCount = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/services/resident-support", () => ({
  getResidentUnreadCount: mockGetResidentUnreadCount,
}));

import { ResidentSidebar, ResidentMobileSidebar } from "@/components/layout/ResidentSidebar";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  mockGetResidentUnreadCount.mockResolvedValue({ count: 0 });
  mockUsePathname.mockReturnValue("/r/home");
});

describe("ResidentSidebar", () => {
  it("renders RWA Connect heading", () => {
    render(<ResidentSidebar societyName="Greenwood Residency" />, { wrapper });
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
  });

  it("renders society name as subtitle", () => {
    render(<ResidentSidebar societyName="Greenwood Residency" />, { wrapper });
    expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
  });

  it("renders Resident Portal when no society name", () => {
    render(<ResidentSidebar />, { wrapper });
    expect(screen.getByText("Resident Portal")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<ResidentSidebar societyName="Test" />, { wrapper });
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("highlights active link", () => {
    render(<ResidentSidebar societyName="Test" />, { wrapper });
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("bg-primary");
  });

  it("does not highlight inactive links", () => {
    render(<ResidentSidebar societyName="Test" />, { wrapper });
    const paymentsLink = screen.getByText("Payments").closest("a");
    expect(paymentsLink?.className).not.toContain("bg-primary");
  });

  it("has correct href for each nav item", () => {
    render(<ResidentSidebar societyName="Test" />, { wrapper });
    expect(screen.getByText("Home").closest("a")?.getAttribute("href")).toBe("/r/home");
    expect(screen.getByText("Payments").closest("a")?.getAttribute("href")).toBe("/r/payments");
    expect(screen.getByText("Expenses").closest("a")?.getAttribute("href")).toBe("/r/expenses");
    expect(screen.getByText("Profile").closest("a")?.getAttribute("href")).toBe("/r/profile");
  });
});

describe("ResidentMobileSidebar", () => {
  it("renders nav items when open", () => {
    render(
      <ResidentMobileSidebar
        open={true}
        onOpenChange={vi.fn()}
        societyName="Greenwood Residency"
      />,
      {
        wrapper,
      },
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
  });

  it("includes accessible SheetTitle", () => {
    render(<ResidentMobileSidebar open={true} onOpenChange={vi.fn()} societyName="Test" />, {
      wrapper,
    });
    expect(screen.getByText("Navigation Menu")).toBeInTheDocument();
  });
});
