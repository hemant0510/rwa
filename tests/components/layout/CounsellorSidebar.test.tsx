import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUsePathname = vi.hoisted(() => vi.fn(() => "/counsellor"));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

import { CounsellorSidebar, CounsellorMobileSidebar } from "@/components/layout/CounsellorSidebar";

beforeEach(() => {
  mockUsePathname.mockReturnValue("/counsellor");
});

describe("CounsellorSidebar", () => {
  it("renders Counsellor heading and default subtitle", () => {
    render(<CounsellorSidebar />);
    expect(screen.getByText("Counsellor")).toBeInTheDocument();
    expect(screen.getByText("Counsellor Portal")).toBeInTheDocument();
  });

  it("renders the counsellor name as subtitle when provided", () => {
    render(<CounsellorSidebar counsellorName="Aman Goel" />);
    expect(screen.getByText("Aman Goel")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<CounsellorSidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Societies")).toBeInTheDocument();
    expect(screen.getByText("Tickets")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("has correct href for each nav item", () => {
    render(<CounsellorSidebar />);
    expect(screen.getByText("Dashboard").closest("a")?.getAttribute("href")).toBe("/counsellor");
    expect(screen.getByText("Societies").closest("a")?.getAttribute("href")).toBe(
      "/counsellor/societies",
    );
    expect(screen.getByText("Tickets").closest("a")?.getAttribute("href")).toBe(
      "/counsellor/tickets",
    );
    expect(screen.getByText("Analytics").closest("a")?.getAttribute("href")).toBe(
      "/counsellor/analytics",
    );
    expect(screen.getByText("Onboarding").closest("a")?.getAttribute("href")).toBe(
      "/counsellor/onboarding",
    );
    expect(screen.getByText("Profile").closest("a")?.getAttribute("href")).toBe(
      "/counsellor/profile",
    );
    expect(screen.getByText("Settings").closest("a")?.getAttribute("href")).toBe(
      "/counsellor/settings",
    );
  });

  it("highlights Dashboard exactly on /counsellor", () => {
    mockUsePathname.mockReturnValue("/counsellor");
    render(<CounsellorSidebar />);
    expect(screen.getByText("Dashboard").closest("a")?.className).toContain("bg-primary");
    expect(screen.getByText("Settings").closest("a")?.className).not.toContain("bg-primary");
  });

  it("does NOT highlight Dashboard when on a nested route (exact match)", () => {
    mockUsePathname.mockReturnValue("/counsellor/settings");
    render(<CounsellorSidebar />);
    expect(screen.getByText("Dashboard").closest("a")?.className).not.toContain("bg-primary");
    expect(screen.getByText("Settings").closest("a")?.className).toContain("bg-primary");
  });

  it("highlights Tickets on nested /counsellor/tickets/:id", () => {
    mockUsePathname.mockReturnValue("/counsellor/tickets/abc-123");
    render(<CounsellorSidebar />);
    expect(screen.getByText("Tickets").closest("a")?.className).toContain("bg-primary");
  });

  it("highlights Societies on exact /counsellor/societies", () => {
    mockUsePathname.mockReturnValue("/counsellor/societies");
    render(<CounsellorSidebar />);
    expect(screen.getByText("Societies").closest("a")?.className).toContain("bg-primary");
  });

  it("renders without crashing when usePathname returns null", () => {
    mockUsePathname.mockReturnValue(null as unknown as string);
    render(<CounsellorSidebar />);
    expect(screen.getByText("Dashboard").closest("a")?.className).not.toContain("bg-primary");
  });
});

describe("CounsellorMobileSidebar", () => {
  it("renders nav items inside a Sheet when open", () => {
    render(<CounsellorMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("does not render Sheet content when closed", () => {
    render(<CounsellorMobileSidebar open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("includes accessible SheetTitle", () => {
    render(<CounsellorMobileSidebar open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Navigation Menu")).toBeInTheDocument();
  });

  it("passes counsellor name through to sidebar content", () => {
    render(
      <CounsellorMobileSidebar open={true} onOpenChange={vi.fn()} counsellorName="Aman Goel" />,
    );
    expect(screen.getByText("Aman Goel")).toBeInTheDocument();
  });
});
