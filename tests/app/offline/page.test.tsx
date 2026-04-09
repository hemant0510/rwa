import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import OfflinePage from "@/app/offline/page";

describe("OfflinePage", () => {
  it("renders the offline heading", () => {
    render(<OfflinePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You're Offline");
  });

  it("renders the help text", () => {
    render(<OfflinePage />);
    expect(screen.getByText(/check your internet connection and try again/i)).toBeInTheDocument();
  });

  it("renders the wifi-off icon container", () => {
    render(<OfflinePage />);
    // The icon is wrapped in a rounded container — verify the page structure renders
    const { container } = render(<OfflinePage />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
