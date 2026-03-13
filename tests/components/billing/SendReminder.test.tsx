import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SendReminderDialog } from "@/components/features/billing/SendReminder";

vi.mock("@/services/billing", () => ({
  sendReminder: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { sendReminder } from "@/services/billing";

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
});
