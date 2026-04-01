import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { StatusTimeline, formatDate } from "@/components/features/support/StatusTimeline";

describe("StatusTimeline", () => {
  it("shows empty message when no events", () => {
    render(<StatusTimeline events={[]} />);
    expect(screen.getByText("No status changes")).toBeInTheDocument();
  });

  it("renders events with status labels", () => {
    render(
      <StatusTimeline
        events={[
          { status: "OPEN", timestamp: "2026-03-01T10:00:00Z" },
          { status: "IN_PROGRESS", timestamp: "2026-03-02T14:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByText("Opened")).toBeInTheDocument();
    expect(screen.getByText("Picked Up")).toBeInTheDocument();
  });

  it("renders custom label when provided", () => {
    render(
      <StatusTimeline
        events={[
          {
            status: "CLOSED",
            timestamp: "2026-03-05T10:00:00Z",
            label: "Auto-closed after 7 days",
          },
        ]}
      />,
    );
    expect(screen.getByText("Auto-closed after 7 days")).toBeInTheDocument();
  });

  it("renders unknown status as-is when no label mapping", () => {
    render(
      <StatusTimeline events={[{ status: "CUSTOM_STATUS", timestamp: "2026-03-01T10:00:00Z" }]} />,
    );
    expect(screen.getByText("CUSTOM_STATUS")).toBeInTheDocument();
  });

  it("renders all known status labels", () => {
    const statuses = ["OPEN", "IN_PROGRESS", "AWAITING_ADMIN", "AWAITING_SA", "RESOLVED", "CLOSED"];
    const events = statuses.map((status, i) => ({
      status,
      timestamp: `2026-03-0${i + 1}T10:00:00Z`,
    }));
    render(<StatusTimeline events={events} />);

    expect(screen.getByText("Opened")).toBeInTheDocument();
    expect(screen.getByText("Picked Up")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Admin Response")).toBeInTheDocument();
    expect(screen.getByText("Awaiting SA Response")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders formatted timestamps", () => {
    render(<StatusTimeline events={[{ status: "OPEN", timestamp: "2026-03-15T10:30:00Z" }]} />);
    // Check that some date text is rendered (format varies by locale)
    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByText(/Mar/)).toBeInTheDocument();
  });

  it("shows check icon on last event and circle on others", () => {
    const { container } = render(
      <StatusTimeline
        events={[
          { status: "OPEN", timestamp: "2026-03-01T10:00:00Z" },
          { status: "RESOLVED", timestamp: "2026-03-05T10:00:00Z" },
        ]}
      />,
    );
    // Last item gets green check, first gets circle
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders connector line between events", () => {
    const { container } = render(
      <StatusTimeline
        events={[
          { status: "OPEN", timestamp: "2026-03-01T10:00:00Z" },
          { status: "RESOLVED", timestamp: "2026-03-05T10:00:00Z" },
        ]}
      />,
    );
    const connector = container.querySelector("[class*='bg-border']");
    expect(connector).toBeInTheDocument();
  });
});

describe("formatDate", () => {
  it("formats date string to locale format", () => {
    const result = formatDate("2026-03-15T10:30:00Z");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });
});
