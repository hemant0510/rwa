import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));

import { AdminSidebar, AdminMobileSidebar } from "@/components/layout/AdminSidebar";

describe("AdminSidebar", () => {
  it("renders RWA Admin heading", () => {
    render(<AdminSidebar societyName="Eden Estate" />);
    expect(screen.getByText("RWA Admin")).toBeInTheDocument();
  });

  it("renders society name as subtitle", () => {
    render(<AdminSidebar societyName="Eden Estate" />);
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("renders Admin Portal when no society name", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<AdminSidebar societyName="Test" />);
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
    render(<AdminSidebar societyName="Test" />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toContain("bg-primary");
  });

  it("appends query string to nav links", () => {
    render(<AdminSidebar societyName="Test" queryString="?sid=soc-1&sname=Test" />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.getAttribute("href")).toContain("?sid=soc-1&sname=Test");
  });
});

describe("AdminMobileSidebar", () => {
  it("renders navigation inside a Sheet when open", () => {
    render(<AdminMobileSidebar open={true} onOpenChange={vi.fn()} societyName="Eden Estate" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("does not render Sheet content when closed", () => {
    render(<AdminMobileSidebar open={false} onOpenChange={vi.fn()} societyName="Eden Estate" />);
    // Navigation items should not be visible when the sheet is closed
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("passes queryString to nav links", () => {
    render(
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
