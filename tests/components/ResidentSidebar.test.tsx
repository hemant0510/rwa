import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/r/home",
}));

import { ResidentSidebar, ResidentMobileSidebar } from "@/components/layout/ResidentSidebar";

describe("ResidentSidebar", () => {
  it("renders RWA Connect heading", () => {
    render(<ResidentSidebar societyName="Eden Estate" />);
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
  });

  it("renders society name as subtitle", () => {
    render(<ResidentSidebar societyName="Eden Estate" />);
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("renders Resident Portal when no society name", () => {
    render(<ResidentSidebar />);
    expect(screen.getByText("Resident Portal")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<ResidentSidebar societyName="Test" />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("highlights active link", () => {
    render(<ResidentSidebar societyName="Test" />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("bg-primary");
  });

  it("does not highlight inactive links", () => {
    render(<ResidentSidebar societyName="Test" />);
    const paymentsLink = screen.getByText("Payments").closest("a");
    expect(paymentsLink?.className).not.toContain("bg-primary");
  });

  it("has correct href for each nav item", () => {
    render(<ResidentSidebar societyName="Test" />);
    expect(screen.getByText("Home").closest("a")?.getAttribute("href")).toBe("/r/home");
    expect(screen.getByText("Payments").closest("a")?.getAttribute("href")).toBe("/r/payments");
    expect(screen.getByText("Expenses").closest("a")?.getAttribute("href")).toBe("/r/expenses");
    expect(screen.getByText("Profile").closest("a")?.getAttribute("href")).toBe("/r/profile");
  });
});

describe("ResidentMobileSidebar", () => {
  it("renders nav items when open", () => {
    render(<ResidentMobileSidebar open={true} onOpenChange={vi.fn()} societyName="Eden Estate" />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("includes accessible SheetTitle", () => {
    render(<ResidentMobileSidebar open={true} onOpenChange={vi.fn()} societyName="Test" />);
    expect(screen.getByText("Navigation Menu")).toBeInTheDocument();
  });
});
