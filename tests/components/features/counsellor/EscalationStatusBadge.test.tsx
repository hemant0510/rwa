import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { EscalationStatusBadge } from "@/components/features/counsellor/EscalationStatusBadge";

describe("EscalationStatusBadge", () => {
  const knownStatuses: Array<{ status: string; label: string }> = [
    { status: "PENDING", label: "Pending" },
    { status: "ACKNOWLEDGED", label: "Acknowledged" },
    { status: "REVIEWING", label: "Reviewing" },
    { status: "RESOLVED_BY_COUNSELLOR", label: "Resolved" },
    { status: "DEFERRED_TO_ADMIN", label: "Deferred to Admin" },
    { status: "WITHDRAWN", label: "Withdrawn" },
  ];

  it.each(knownStatuses)("renders '$label' for status '$status'", ({ status, label }) => {
    render(<EscalationStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to raw status for unknown values", () => {
    render(<EscalationStatusBadge status="FOO_BAR" />);
    expect(screen.getByText("FOO_BAR")).toBeInTheDocument();
  });
});
