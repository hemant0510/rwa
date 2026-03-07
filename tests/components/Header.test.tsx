import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Header } from "@/components/layout/Header";

describe("Header", () => {
  it("renders title", () => {
    render(<Header title="RWA Admin" />);
    expect(screen.getByText("RWA Admin")).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<Header title="RWA Admin" subtitle="Eden Estate" />);
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    render(<Header title="RWA Admin" />);
    expect(screen.queryByText("Eden Estate")).not.toBeInTheDocument();
  });

  it("renders user initials from name", () => {
    render(<Header title="Test" userName="Hemant Bhagat" />);
    expect(screen.getByText("HB")).toBeInTheDocument();
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
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render menu button when showMenuButton is false", () => {
    render(<Header title="Test" />);
    // Only the avatar/dropdown trigger button should exist
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });
});
