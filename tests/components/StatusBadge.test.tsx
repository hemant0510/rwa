import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { StatusBadge } from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  it("renders PAID status", () => {
    render(<StatusBadge status="PAID" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders PENDING status", () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders OVERDUE status", () => {
    render(<StatusBadge status="OVERDUE" />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("renders EXEMPTED status", () => {
    render(<StatusBadge status="EXEMPTED" />);
    expect(screen.getByText("Exempted")).toBeInTheDocument();
  });

  it("renders NOT_YET_DUE status", () => {
    render(<StatusBadge status="NOT_YET_DUE" />);
    expect(screen.getByText("Not Yet Due")).toBeInTheDocument();
  });

  it("renders PARTIAL with amount in INR format", () => {
    render(<StatusBadge status="PARTIAL" amount={1500} />);
    expect(screen.getByText(/₹1,500/)).toBeInTheDocument();
  });

  it("renders PARTIAL without amount as label", () => {
    render(<StatusBadge status="PARTIAL" />);
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<StatusBadge status="PAID" className="custom-class" />);
    const badge = container.firstChild;
    expect((badge as Element)?.className).toContain("custom-class");
  });
});
