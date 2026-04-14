import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEscalate, mockNotify, mockWithdraw } = vi.hoisted(() => ({
  mockEscalate: vi.fn(),
  mockNotify: vi.fn(),
  mockWithdraw: vi.fn(),
}));

vi.mock("@/services/resident-support", () => ({
  adminEscalateTicket: mockEscalate,
  adminNotifyCounsellor: mockNotify,
  adminWithdrawEscalation: mockWithdraw,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { EscalationActions } from "@/components/features/resident-support/EscalationActions";

function renderActions(props: Partial<React.ComponentProps<typeof EscalationActions>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <EscalationActions ticketId="t-1" activeEscalation={null} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EscalationActions", () => {
  it("shows inactive copy and Escalate + Notify buttons when no active escalation", () => {
    renderActions();
    expect(screen.getByText(/not currently escalated/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Escalate$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Notify counsellor/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Withdraw/i })).not.toBeInTheDocument();
  });

  it("shows active status copy when escalation exists", () => {
    renderActions({
      activeEscalation: { id: "e-1", source: "ADMIN_ASSIGN", status: "PENDING" },
    });
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getByText(/admin assign/i)).toBeInTheDocument();
  });

  it("shows Withdraw button for non-RESIDENT_VOTE active escalations", () => {
    renderActions({
      activeEscalation: { id: "e-1", source: "ADMIN_NOTIFY", status: "PENDING" },
    });
    expect(screen.getByRole("button", { name: /Withdraw escalation/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Escalate$/i })).not.toBeInTheDocument();
  });

  it("hides Withdraw button when active escalation source is RESIDENT_VOTE", () => {
    renderActions({
      activeEscalation: { id: "e-1", source: "RESIDENT_VOTE", status: "PENDING" },
    });
    expect(screen.queryByRole("button", { name: /Withdraw escalation/i })).not.toBeInTheDocument();
  });

  it("disables action buttons when disabled prop is true", () => {
    renderActions({ disabled: true });
    expect(screen.getByRole("button", { name: /^Escalate$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Notify counsellor/i })).toBeDisabled();
  });

  it("opens Escalate dialog and disables Confirm when reason is too short", () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));
    expect(screen.getByRole("heading", { name: /Escalate to counsellor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Confirm$/i })).toBeDisabled();
  });

  it("enables Confirm in Escalate dialog when reason ≥10 chars", () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Severe dispute between residents" },
    });
    expect(screen.getByRole("button", { name: /^Confirm$/i })).not.toBeDisabled();
  });

  it("submits escalate mutation on Confirm and closes dialog on success", async () => {
    mockEscalate.mockResolvedValue({ id: "e-9" });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Needs counsellor input" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => {
      expect(mockEscalate).toHaveBeenCalledWith("t-1", "Needs counsellor input");
      expect(toast.success).toHaveBeenCalledWith("Ticket escalated to counsellor");
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /Escalate to counsellor/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("calls toast.error when escalate mutation fails", async () => {
    mockEscalate.mockRejectedValue(new Error("Server boom"));
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Reason long enough" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Server boom"));
  });

  it("submits notify mutation when in NOTIFY mode", async () => {
    mockNotify.mockResolvedValue({ id: "e-9" });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /Notify counsellor/i }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Heads-up to counsellor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith("t-1", "Heads-up to counsellor");
      expect(toast.success).toHaveBeenCalledWith("Counsellor notified");
    });
  });

  it("calls toast.error when notify mutation fails", async () => {
    mockNotify.mockRejectedValue(new Error("notify boom"));
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /Notify counsellor/i }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Long enough reason" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("notify boom"));
  });

  it("submits withdraw mutation with empty reason allowed", async () => {
    mockWithdraw.mockResolvedValue({ id: "e-9" });
    renderActions({
      activeEscalation: { id: "e-1", source: "ADMIN_ASSIGN", status: "PENDING" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Withdraw escalation/i }));
    expect(screen.getByRole("button", { name: /^Confirm$/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => {
      expect(mockWithdraw).toHaveBeenCalledWith("t-1", undefined);
      expect(toast.success).toHaveBeenCalledWith("Escalation withdrawn");
    });
  });

  it("submits withdraw mutation with provided reason", async () => {
    mockWithdraw.mockResolvedValue({ id: "e-9" });
    renderActions({
      activeEscalation: { id: "e-1", source: "ADMIN_ASSIGN", status: "PENDING" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Withdraw escalation/i }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "no longer needed" } });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => {
      expect(mockWithdraw).toHaveBeenCalledWith("t-1", "no longer needed");
    });
  });

  it("calls toast.error when withdraw mutation fails", async () => {
    mockWithdraw.mockRejectedValue(new Error("withdraw boom"));
    renderActions({
      activeEscalation: { id: "e-1", source: "ADMIN_ASSIGN", status: "PENDING" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Withdraw escalation/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("withdraw boom"));
  });

  it("closes dialog when Cancel is clicked", () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));
    expect(screen.getByRole("heading", { name: /Escalate to counsellor/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(
      screen.queryByRole("heading", { name: /Escalate to counsellor/i }),
    ).not.toBeInTheDocument();
  });

  it("closes dialog when Escape key is pressed (Radix onOpenChange)", async () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));
    const heading = screen.getByRole("heading", { name: /Escalate to counsellor/i });
    expect(heading).toBeInTheDocument();
    fireEvent.keyDown(heading, { key: "Escape", code: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /Escalate to counsellor/i }),
      ).not.toBeInTheDocument(),
    );
  });
});
