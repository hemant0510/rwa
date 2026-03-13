import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { BulkReminderSheet } from "@/components/features/billing/BulkReminder";

vi.mock("@/services/billing", () => ({
  sendBulkReminders: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { sendBulkReminders } from "@/services/billing";

const mockSendBulkReminders = vi.mocked(sendBulkReminders);

const societies = [
  { id: "s1", name: "Green Park" },
  { id: "s2", name: "Blue Valley" },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BulkReminderSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button", () => {
    renderWithClient(<BulkReminderSheet societies={societies} />);
    expect(screen.getByText("Bulk Send Reminders")).toBeInTheDocument();
  });

  it("opens sheet with societies list", async () => {
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));
    expect(screen.getByText("Bulk Reminder")).toBeInTheDocument();
    expect(screen.getByText("Green Park")).toBeInTheDocument();
    expect(screen.getByText("Blue Valley")).toBeInTheDocument();
  });

  it("shows send button disabled when none selected", async () => {
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));
    const sendBtn = screen.getByText("Send (0)");
    expect(sendBtn).toBeDisabled();
  });

  it("shows template select with Reminder Type label", async () => {
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));
    expect(screen.getByText("Reminder Type")).toBeInTheDocument();
  });

  it("enables send button after selecting a society", async () => {
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));

    // Click on the checkbox for "Green Park"
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    expect(screen.getByText("Send (1)")).toBeEnabled();
  });

  it("toggles society selection off when clicked twice", async () => {
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // select
    expect(screen.getByText("Send (1)")).toBeInTheDocument();
    await user.click(checkboxes[0]); // deselect
    expect(screen.getByText("Send (0)")).toBeInTheDocument();
  });

  it("calls sendBulkReminders on submit and shows success toast", async () => {
    mockSendBulkReminders.mockResolvedValue({ sent: 1, failed: 0 });
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(screen.getByText("Send (1)"));

    await waitFor(() => {
      expect(mockSendBulkReminders).toHaveBeenCalledWith(["s1"], "expiry-reminder");
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Bulk reminders sent");
    });
  });

  it("shows error toast on failure", async () => {
    mockSendBulkReminders.mockRejectedValue(new Error("Rate limited"));
    const user = userEvent.setup();
    renderWithClient(<BulkReminderSheet societies={societies} />);
    await user.click(screen.getByText("Bulk Send Reminders"));

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(screen.getByText("Send (1)"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Rate limited");
    });
  });
});
