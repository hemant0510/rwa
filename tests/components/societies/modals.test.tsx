import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { OffboardWizard } from "@/components/features/societies/OffboardWizard";
import { SocietyStatusTimeline, formatDate } from "@/components/features/societies/StatusTimeline";
import { SuspendModal } from "@/components/features/societies/SuspendModal";

describe("SuspendModal", () => {
  it("renders modal title with society name", () => {
    render(
      <SuspendModal
        open={true}
        onOpenChange={vi.fn()}
        societyName="Eden Estate"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/Suspend Eden Estate/)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <SuspendModal open={false} onOpenChange={vi.fn()} societyName="Test" onConfirm={vi.fn()} />,
    );
    expect(screen.queryByText(/Suspend Test/)).not.toBeInTheDocument();
  });

  it("has disabled confirm when reason is empty", () => {
    render(
      <SuspendModal open={true} onOpenChange={vi.fn()} societyName="Test" onConfirm={vi.fn()} />,
    );
    expect(screen.getByText("Suspend Society")).toBeDisabled();
  });

  it("calls onConfirm with reason when submitted", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SuspendModal open={true} onOpenChange={vi.fn()} societyName="Test" onConfirm={onConfirm} />,
    );

    await user.type(screen.getByPlaceholderText(/Overdue/), "Payment overdue");
    await user.click(screen.getByText("Suspend Society"));
    expect(onConfirm).toHaveBeenCalledWith("Payment overdue");
  });

  it("shows spinner when isPending", () => {
    render(
      <SuspendModal
        open={true}
        onOpenChange={vi.fn()}
        societyName="Test"
        onConfirm={vi.fn()}
        isPending
      />,
    );
    expect(screen.getByText("Suspend Society")).toBeDisabled();
  });
});

describe("OffboardWizard", () => {
  it("renders modal title", () => {
    render(
      <OffboardWizard
        open={true}
        onOpenChange={vi.fn()}
        societyName="Eden Estate"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/Offboard Eden Estate/)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <OffboardWizard open={false} onOpenChange={vi.fn()} societyName="Test" onConfirm={vi.fn()} />,
    );
    expect(screen.queryByText(/Offboard Test/)).not.toBeInTheDocument();
  });

  it("has disabled confirm until reason and confirmation checked", () => {
    render(
      <OffboardWizard open={true} onOpenChange={vi.fn()} societyName="Test" onConfirm={vi.fn()} />,
    );
    expect(screen.getByText("Offboard Society")).toBeDisabled();
  });

  it("shows spinner when isPending", () => {
    render(
      <OffboardWizard
        open={true}
        onOpenChange={vi.fn()}
        societyName="Test"
        onConfirm={vi.fn()}
        isPending
      />,
    );
    expect(screen.getByText("Offboard Society")).toBeDisabled();
  });
});

describe("SocietyStatusTimeline", () => {
  it("shows empty message when no events", () => {
    render(<SocietyStatusTimeline events={[]} />);
    expect(screen.getByText("No status changes")).toBeInTheDocument();
  });

  it("renders status transitions", () => {
    render(
      <SocietyStatusTimeline
        events={[
          {
            id: "1",
            fromStatus: "TRIAL",
            toStatus: "ACTIVE",
            reason: "Subscription paid",
            createdAt: "2026-01-15T10:00:00Z",
          },
          {
            id: "2",
            fromStatus: "ACTIVE",
            toStatus: "SUSPENDED",
            reason: "Overdue payment",
            createdAt: "2026-03-01T10:00:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("TRIAL")).toBeInTheDocument();
    // ACTIVE appears twice (toStatus of first event, fromStatus of second)
    expect(screen.getAllByText("ACTIVE")).toHaveLength(2);
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
    expect(screen.getByText("Subscription paid")).toBeInTheDocument();
    expect(screen.getByText("Overdue payment")).toBeInTheDocument();
  });
});

describe("formatDate (societies)", () => {
  it("formats date", () => {
    const result = formatDate("2026-03-15T10:00:00Z");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });
});
