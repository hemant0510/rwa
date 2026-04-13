import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompletenessBadge } from "@/components/features/admin/CompletenessBadge";

describe("CompletenessBadge", () => {
  it("renders BASIC tier with gray styling", () => {
    render(<CompletenessBadge tier="BASIC" score={20} />);
    const badge = screen.getByLabelText(/tier Basic, 20% complete/i);
    expect(badge).toHaveTextContent("Basic · 20%");
    expect(badge.className).toContain("slate");
  });

  it("renders STANDARD tier with amber styling", () => {
    render(<CompletenessBadge tier="STANDARD" score={55} />);
    const badge = screen.getByLabelText(/tier Standard/i);
    expect(badge.className).toContain("amber");
  });

  it("renders COMPLETE tier with blue styling", () => {
    render(<CompletenessBadge tier="COMPLETE" score={80} />);
    const badge = screen.getByLabelText(/tier Complete/i);
    expect(badge.className).toContain("blue");
  });

  it("renders VERIFIED tier with emerald styling", () => {
    render(<CompletenessBadge tier="VERIFIED" score={95} />);
    const badge = screen.getByLabelText(/tier Verified/i);
    expect(badge.className).toContain("emerald");
  });

  it("omits score display when score is null", () => {
    render(<CompletenessBadge tier="BASIC" score={null} />);
    const badge = screen.getByLabelText(/tier Basic$/i);
    expect(badge).toHaveTextContent("Basic");
    expect(badge).not.toHaveTextContent("%");
  });

  it("omits score display when score is undefined", () => {
    render(<CompletenessBadge tier="STANDARD" />);
    const badge = screen.getByLabelText(/tier Standard$/i);
    expect(badge).toHaveTextContent("Standard");
  });

  it("merges custom className", () => {
    render(<CompletenessBadge tier="VERIFIED" score={100} className="extra-class" />);
    expect(screen.getByLabelText(/tier Verified/i).className).toContain("extra-class");
  });
});
