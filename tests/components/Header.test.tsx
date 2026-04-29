import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Header } from "@/components/layout/Header";

describe("Header", () => {
  it("renders title", () => {
    render(<Header title="RWA Admin" />);
    expect(screen.getByText("RWA Admin")).toBeInTheDocument();
  });

  it("renders subtitle when no society switcher", () => {
    render(<Header title="RWA Admin" subtitle="Greenwood Residency" />);
    expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    render(<Header title="RWA Admin" />);
    expect(screen.queryByText("Greenwood Residency")).not.toBeInTheDocument();
  });

  it("hides title and subtitle when societySwitcher is provided", () => {
    render(
      <Header
        title="RWA Connect"
        subtitle="Greenwood Residency"
        societySwitcher={<div data-testid="switcher">Switcher</div>}
      />,
    );
    expect(screen.getByTestId("switcher")).toBeInTheDocument();
    expect(screen.queryByText("RWA Connect")).not.toBeInTheDocument();
    expect(screen.queryByText("Greenwood Residency")).not.toBeInTheDocument();
  });

  it("renders title when societySwitcher is not provided", () => {
    render(<Header title="RWA Connect" subtitle="Greenwood Residency" />);
    expect(screen.getByText("RWA Connect")).toBeInTheDocument();
    expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
  });

  it("renders user initials from name", () => {
    render(<Header title="Test" userName="Arjun Kapoor" />);
    expect(screen.getByText("AK")).toBeInTheDocument();
  });

  it("renders single initial for single name", () => {
    render(<Header title="Test" userName="Admin" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("defaults to U for no userName", () => {
    render(<Header title="Test" />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("renders menu button when showMenuButton is true", () => {
    const onToggle = vi.fn();
    render(<Header title="Test" showMenuButton onMenuToggle={onToggle} />);
    // Menu button should exist (it has the Menu icon)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render menu button when showMenuButton is false", () => {
    render(<Header title="Test" />);
    // Only the avatar/dropdown trigger button should exist
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });

  it("renders searchBar when provided", () => {
    render(<Header title="Test" searchBar={<input data-testid="search-bar" />} />);
    expect(screen.getByTestId("search-bar")).toBeInTheDocument();
  });

  it("renders avatar without error when userPhotoUrl is provided", () => {
    render(<Header title="Test" userPhotoUrl="https://example.com/photo.jpg" userName="Arjun" />);
    // AvatarImage is instantiated; initials fallback still visible since image never loads in jsdom
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
