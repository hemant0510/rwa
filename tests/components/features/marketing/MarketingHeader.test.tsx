import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketingHeader } from "@/components/features/marketing/MarketingHeader";

describe("MarketingHeader", () => {
  it("renders all primary navigation links", () => {
    render(<MarketingHeader />);
    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(nav).toContainElement(screen.getByRole("link", { name: "Features" }));
    expect(nav).toContainElement(screen.getByRole("link", { name: "Pricing" }));
    expect(nav).toContainElement(screen.getByRole("link", { name: "For Admins" }));
    expect(nav).toContainElement(screen.getByRole("link", { name: "For Residents" }));
    expect(nav).toContainElement(screen.getByRole("link", { name: "Contact" }));
  });

  it("renders sign-in and get-started CTAs", () => {
    render(<MarketingHeader />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });

  it("renders the skip-to-main-content accessibility link", () => {
    render(<MarketingHeader />);
    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("uses a fully opaque sticky header (no transparency that bleeds page text through)", () => {
    const { container } = render(<MarketingHeader />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const className = header?.className ?? "";
    expect(className).toContain("bg-background");
    expect(className).toContain("sticky");
    expect(className).not.toMatch(/bg-background\/\d+/);
    expect(className).not.toContain("backdrop-blur");
  });

  it("renders the mobile nav drawer trigger", () => {
    render(<MarketingHeader />);
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });
});
