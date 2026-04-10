import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ResidentTicketTypeBadge } from "@/components/features/resident-support/ResidentTicketTypeBadge";

describe("ResidentTicketTypeBadge", () => {
  const knownTypes: Array<{ type: string; label: string }> = [
    { type: "MAINTENANCE_ISSUE", label: "Maintenance" },
    { type: "SECURITY_CONCERN", label: "Security" },
    { type: "NOISE_COMPLAINT", label: "Noise" },
    { type: "PARKING_ISSUE", label: "Parking" },
    { type: "CLEANLINESS", label: "Cleanliness" },
    { type: "BILLING_QUERY", label: "Billing" },
    { type: "AMENITY_REQUEST", label: "Amenity" },
    { type: "NEIGHBOR_DISPUTE", label: "Neighbor Dispute" },
    { type: "SUGGESTION", label: "Suggestion" },
    { type: "OTHER", label: "Other" },
  ];

  it.each(knownTypes)("renders '$label' for type '$type'", ({ type, label }) => {
    render(<ResidentTicketTypeBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to raw type string for unknown type", () => {
    render(<ResidentTicketTypeBadge type="UNKNOWN_TYPE" />);
    expect(screen.getByText("UNKNOWN_TYPE")).toBeInTheDocument();
  });
});
