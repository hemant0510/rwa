import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RecordSubscriptionPaymentDialog } from "@/components/features/billing/RecordPayment";
import { recordSubscriptionPayment } from "@/services/billing";

vi.mock("@/services/billing", () => ({
  recordSubscriptionPayment: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRecordPayment = vi.mocked(recordSubscriptionPayment);

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("RecordSubscriptionPaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button", () => {
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    expect(screen.getByText("Record Payment")).toBeInTheDocument();
  });

  it("opens dialog on click", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    expect(screen.getByText("Record Subscription Payment")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Payment Mode")).toBeInTheDocument();
  });

  it("shows email checkbox", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    expect(
      screen.getByText("Send payment confirmation email to society admins"),
    ).toBeInTheDocument();
  });

  it("shows reference required validation for UPI mode", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    // Default mode is UPI, so reference required message should appear
    expect(screen.getByText(/Required for UPI/)).toBeInTheDocument();
  });

  it("save button is disabled when amount is empty", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    expect(screen.getByText("Save Payment")).toBeDisabled();
  });

  it("calls recordSubscriptionPayment on submit and shows success toast", async () => {
    mockRecordPayment.mockResolvedValue({ id: "p1" });
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    // Fill in amount
    const amountInput = screen.getByRole("spinbutton");
    await user.type(amountInput, "5000");

    // Fill in reference number (required for UPI)
    const inputs = screen.getAllByRole("textbox");
    const refInput = inputs[0]; // first textbox is reference no
    await user.type(refInput, "UPI-REF-123");

    // Click save
    await user.click(screen.getByText("Save Payment"));

    await waitFor(() => {
      expect(mockRecordPayment).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({
          amount: 5000,
          paymentMode: "UPI",
          referenceNo: "UPI-REF-123",
        }),
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Payment recorded");
    });
  });

  it("shows error toast on failure", async () => {
    mockRecordPayment.mockRejectedValue(new Error("No active subscription"));
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    const amountInput = screen.getByRole("spinbutton");
    await user.type(amountInput, "5000");

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "REF-1");

    await user.click(screen.getByText("Save Payment"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("No active subscription");
    });
  });

  it("renders notes and payment date fields", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Payment Date")).toBeInTheDocument();
  });

  it("shows 'Saving...' while mutation is in progress", async () => {
    let resolvePayment!: (v: unknown) => void;
    mockRecordPayment.mockReturnValue(
      new Promise((resolve) => {
        resolvePayment = resolve;
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    const amountInput = screen.getByRole("spinbutton");
    await user.type(amountInput, "5000");

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "REF-123");

    await user.click(screen.getByText("Save Payment"));

    await waitFor(() => expect(screen.getByText("Saving...")).toBeInTheDocument());

    resolvePayment({ id: "p1" });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("allows changing payment date", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    const dateInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    await user.clear(dateInput);
    await user.type(dateInput, "2025-06-15");
    expect(dateInput).toHaveValue("2025-06-15");
  });

  it("allows typing notes", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    // Notes is the last textbox in the dialog
    const textboxes = screen.getAllByRole("textbox");
    const notesInput = textboxes[textboxes.length - 1];
    await user.type(notesInput, "Paid via cash");
    expect(notesInput).toHaveValue("Paid via cash");
  });
});
