import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SendReminderDialog } from "@/components/features/billing/SendReminder";
import { sendReminder } from "@/services/billing";

vi.mock("@/services/billing", () => ({
  sendReminder: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSendReminder = vi.mocked(sendReminder);

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SendReminderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button", () => {
    renderWithClient(<SendReminderDialog societyId="soc-1" />);
    expect(screen.getByText("Send Reminder")).toBeInTheDocument();
  });

  it("opens dialog with template selector", async () => {
    const user = userEvent.setup();
    renderWithClient(<SendReminderDialog societyId="soc-1" />);
    await user.click(screen.getByText("Send Reminder"));
    expect(screen.getAllByText("Send Reminder").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("calls sendReminder on submit and shows success toast", async () => {
    mockSendReminder.mockResolvedValue({ sent: 1 });
    const user = userEvent.setup();
    renderWithClient(<SendReminderDialog societyId="soc-1" />);
    await user.click(screen.getByText("Send Reminder"));

    // Click the Send button
    await user.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(mockSendReminder).toHaveBeenCalledWith("soc-1", "expiry-reminder");
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Reminder sent");
    });
  });

  it("shows error toast on failure", async () => {
    mockSendReminder.mockRejectedValue(new Error("No admins found"));
    const user = userEvent.setup();
    renderWithClient(<SendReminderDialog societyId="soc-1" />);
    await user.click(screen.getByText("Send Reminder"));

    await user.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("No admins found");
    });
  });

  it("changes template via Select onValueChange", async () => {
    mockSendReminder.mockResolvedValue({ sent: 1 });
    const user = userEvent.setup();
    renderWithClient(<SendReminderDialog societyId="soc-1" />);
    await user.click(screen.getByText("Send Reminder"));

    // Open the template select
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    // Select "Overdue Reminder" option
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Overdue Reminder" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "Overdue Reminder" }));

    await user.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(mockSendReminder).toHaveBeenCalledWith("soc-1", "overdue-reminder");
    });
  });

  it("shows 'Sending...' while mutation is in progress", async () => {
    let resolveReminder!: (v: unknown) => void;
    mockSendReminder.mockReturnValue(
      new Promise((resolve) => {
        resolveReminder = resolve;
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<SendReminderDialog societyId="soc-1" />);
    await user.click(screen.getByText("Send Reminder"));
    await user.click(screen.getByText("Send"));

    await waitFor(() => expect(screen.getByText("Sending...")).toBeInTheDocument());

    resolveReminder({ sent: 1 });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
