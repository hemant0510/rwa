import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { SlaTimerBadge } from "@/components/features/counsellor/SlaTimerBadge";

describe("SlaTimerBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'SLA: n/a' when deadline is null", () => {
    render(<SlaTimerBadge deadline={null} />);
    expect(screen.getByText("SLA: n/a")).toBeInTheDocument();
  });

  it("renders breach message when deadline is past", () => {
    const pastDeadline = new Date("2026-04-14T00:00:00Z").toISOString();
    render(<SlaTimerBadge deadline={pastDeadline} />);
    expect(screen.getByText(/SLA breached/)).toBeInTheDocument();
    expect(screen.getByText(/24h overdue/)).toBeInTheDocument();
  });

  it("renders urgent (<=12h) styling", () => {
    const soon = new Date("2026-04-15T06:00:00Z").toISOString();
    render(<SlaTimerBadge deadline={soon} />);
    expect(screen.getByText("SLA: 6h left")).toBeInTheDocument();
  });

  it("renders non-urgent styling when more than 12h left", () => {
    const later = new Date("2026-04-17T00:00:00Z").toISOString();
    render(<SlaTimerBadge deadline={later} />);
    expect(screen.getByText("SLA: 48h left")).toBeInTheDocument();
  });
});
