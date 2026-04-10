import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ResidentTicketStatusBadge } from "@/components/features/resident-support/ResidentTicketStatusBadge";

describe("ResidentTicketStatusBadge", () => {
  const knownStatuses: Array<{ status: string; label: string }> = [
    { status: "OPEN", label: "Open" },
    { status: "IN_PROGRESS", label: "In Progress" },
    { status: "AWAITING_RESIDENT", label: "Awaiting Resident" },
    { status: "AWAITING_ADMIN", label: "Awaiting Admin" },
    { status: "RESOLVED", label: "Resolved" },
    { status: "CLOSED", label: "Closed" },
  ];

  it.each(knownStatuses)("renders '$label' for status '$status'", ({ status, label }) => {
    render(<ResidentTicketStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to raw status string for unknown status", () => {
    render(<ResidentTicketStatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
  });
});
