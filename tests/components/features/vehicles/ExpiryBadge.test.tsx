import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpiryBadge } from "@/components/features/vehicles/ExpiryBadge";

describe("ExpiryBadge", () => {
  it("renders VALID style with formatted date", () => {
    render(<ExpiryBadge label="Insurance" date="2027-08-15" status="VALID" />);
    const badge = screen.getByLabelText(/insurance valid: 15 aug 2027/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("emerald");
    expect(badge).toHaveTextContent("Insurance:");
    expect(badge).toHaveTextContent("15 Aug 2027");
  });

  it("renders EXPIRING_SOON style in amber", () => {
    render(<ExpiryBadge label="PUC" date="2026-05-01" status="EXPIRING_SOON" />);
    const badge = screen.getByLabelText(/puc expiring soon/i);
    expect(badge.className).toContain("amber");
  });

  it("renders EXPIRED style in red", () => {
    render(<ExpiryBadge label="RC" date="2025-01-01" status="EXPIRED" />);
    const badge = screen.getByLabelText(/rc expired/i);
    expect(badge.className).toContain("red");
  });

  it("renders NOT_SET when date is null", () => {
    render(<ExpiryBadge label="Insurance" date={null} status="NOT_SET" />);
    const badge = screen.getByLabelText(/insurance not set/i);
    expect(badge).toHaveTextContent("Not set");
    expect(badge.className).toContain("slate");
  });

  it("renders Not set when date string is invalid", () => {
    render(<ExpiryBadge label="PUC" date="not-a-date" status="NOT_SET" />);
    const badge = screen.getByLabelText(/puc not set/i);
    expect(badge).toHaveTextContent("Not set");
  });

  it("merges custom className", () => {
    render(<ExpiryBadge label="RC" date="2027-01-01" status="VALID" className="extra-class" />);
    const badge = screen.getByLabelText(/rc valid/i);
    expect(badge.className).toContain("extra-class");
  });
});
