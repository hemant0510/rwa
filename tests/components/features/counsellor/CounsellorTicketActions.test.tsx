import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAck, mockResolve, mockDefer } = vi.hoisted(() => ({
  mockAck: vi.fn(),
  mockResolve: vi.fn(),
  mockDefer: vi.fn(),
}));

vi.mock("@/services/counsellor-self", () => ({
  acknowledgeEscalation: mockAck,
  resolveEscalation: mockResolve,
  deferEscalation: mockDefer,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { CounsellorTicketActions } from "@/components/features/counsellor/CounsellorTicketActions";

function renderActions(status: string = "PENDING") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorTicketActions escalationId="e-1" status={status} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorTicketActions", () => {
  it("enables Acknowledge from PENDING, disables Resolve/Defer", () => {
    renderActions("PENDING");
    expect(screen.getByRole("button", { name: /Acknowledge/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^Resolve$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Defer to admin/ })).toBeDisabled();
  });

  it("enables Resolve/Defer from ACKNOWLEDGED, disables Acknowledge", () => {
    renderActions("ACKNOWLEDGED");
    expect(screen.getByRole("button", { name: /Acknowledge/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Resolve$/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Defer to admin/ })).not.toBeDisabled();
  });

  it("disables all buttons when status is terminal", () => {
    renderActions("RESOLVED_BY_COUNSELLOR");
    expect(screen.getByRole("button", { name: /Acknowledge/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Resolve$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Defer to admin/ })).toBeDisabled();
  });

  it("opens Acknowledge dialog and submits without text", async () => {
    mockAck.mockResolvedValueOnce({ id: "e-1", status: "ACKNOWLEDGED", acknowledgedAt: "now" });
    renderActions("PENDING");
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(screen.getByText(/Confirm that you are starting/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    await waitFor(() => expect(mockAck).toHaveBeenCalledWith("e-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Escalation acknowledged"));
  });

  it("opens Resolve dialog, validates min 10 chars, submits summary", async () => {
    mockResolve.mockResolvedValueOnce({
      id: "e-1",
      status: "RESOLVED_BY_COUNSELLOR",
      resolvedAt: "now",
    });
    renderActions("ACKNOWLEDGED");
    fireEvent.click(screen.getByRole("button", { name: /^Resolve$/ }));
    const confirm = screen.getByRole("button", { name: /Confirm/ });
    expect(confirm).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Minimum 10 characters/);
    fireEvent.change(textarea, { target: { value: "short" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "This is the resolution summary" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith("e-1", {
        summary: "This is the resolution summary",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Escalation resolved"));
  });

  it("opens Defer dialog and submits reason", async () => {
    mockDefer.mockResolvedValueOnce({ id: "e-1", status: "DEFERRED_TO_ADMIN" });
    renderActions("ACKNOWLEDGED");
    fireEvent.click(screen.getByRole("button", { name: /Defer to admin/ }));
    const textarea = screen.getByPlaceholderText(/Minimum 10 characters/);
    fireEvent.change(textarea, { target: { value: "Needs policy decision" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    await waitFor(() =>
      expect(mockDefer).toHaveBeenCalledWith("e-1", { reason: "Needs policy decision" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Escalation deferred to admin"));
  });

  it("shows error toast when ack mutation fails", async () => {
    mockAck.mockRejectedValueOnce(new Error("Boom"));
    renderActions("PENDING");
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Boom"));
  });

  it("shows error toast when resolve mutation fails", async () => {
    mockResolve.mockRejectedValueOnce(new Error("ResolveFail"));
    renderActions("ACKNOWLEDGED");
    fireEvent.click(screen.getByRole("button", { name: /^Resolve$/ }));
    fireEvent.change(screen.getByPlaceholderText(/Minimum 10 characters/), {
      target: { value: "Valid summary here" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("ResolveFail"));
  });

  it("shows error toast when defer mutation fails", async () => {
    mockDefer.mockRejectedValueOnce(new Error("DeferFail"));
    renderActions("ACKNOWLEDGED");
    fireEvent.click(screen.getByRole("button", { name: /Defer to admin/ }));
    fireEvent.change(screen.getByPlaceholderText(/Minimum 10 characters/), {
      target: { value: "Valid defer reason" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("DeferFail"));
  });

  it("closes dialog via Cancel button", () => {
    renderActions("PENDING");
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(screen.getByText(/Confirm that you are starting/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.queryByText(/Confirm that you are starting/)).not.toBeInTheDocument();
  });

  it("closes dialog via Escape key (onOpenChange)", () => {
    renderActions("PENDING");
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(screen.getByText(/Confirm that you are starting/)).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
      code: "Escape",
    });
    expect(screen.queryByText(/Confirm that you are starting/)).not.toBeInTheDocument();
  });
});
