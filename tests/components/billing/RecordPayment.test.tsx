import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RecordSubscriptionPaymentDialog } from "@/components/features/billing/RecordPayment";
import { recordSubscriptionPayment, getSubscription } from "@/services/billing";

vi.mock("@/services/billing", () => ({
  recordSubscriptionPayment: vi.fn(),
  getSubscription: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRecordPayment = vi.mocked(recordSubscriptionPayment);
const mockGetSubscription = vi.mocked(getSubscription);

const MOCK_SUBSCRIPTION_TRIAL = {
  id: "sub-1",
  status: "TRIAL",
  currentPeriodEnd: null as string | null,
  finalPrice: null as number | null,
  plan: {
    id: "plan-1",
    name: "Basic",
    billingOptions: [
      { id: "opt-monthly", billingCycle: "MONTHLY", price: 499 },
      { id: "opt-annual", billingCycle: "ANNUAL", price: 4990 },
      { id: "opt-2yr", billingCycle: "TWO_YEAR", price: 9600 },
      { id: "opt-3yr", billingCycle: "THREE_YEAR", price: 13500 },
    ],
  },
  billingOption: null as { id: string; billingCycle: string; price: number } | null,
};

const MOCK_SUBSCRIPTION_ACTIVE = {
  ...MOCK_SUBSCRIPTION_TRIAL,
  status: "ACTIVE",
  currentPeriodEnd: "2027-03-25T00:00:00.000Z",
  finalPrice: 4990,
  billingOption: { id: "opt-annual", billingCycle: "ANNUAL", price: 4990 },
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("RecordSubscriptionPaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: TRIAL subscription with plan but no billing option
    mockGetSubscription.mockResolvedValue(MOCK_SUBSCRIPTION_TRIAL);
  });

  // ── Trigger & basic rendering ──────────────────────────────────────────────

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
    expect(screen.getByText(/Required for UPI/)).toBeInTheDocument();
  });

  it("renders notes and payment date fields", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Payment Date")).toBeInTheDocument();
  });

  // ── Billing cycle selector ─────────────────────────────────────────────────

  it("shows billing cycle buttons when plan has options", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => {
      expect(screen.getByText("Billing Cycle")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Monthly/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Annual/ })).toBeInTheDocument();
    });
  });

  it("does not show billing cycle section when subscription has no plan", async () => {
    mockGetSubscription.mockResolvedValue({
      ...MOCK_SUBSCRIPTION_TRIAL,
      plan: null,
    });
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => {
      expect(screen.queryByText("Billing Cycle")).not.toBeInTheDocument();
    });
  });

  it("prefills amount when a cycle is selected", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => expect(screen.getByRole("button", { name: /Annual/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Annual/ }));

    const amountInput = screen.getByRole("spinbutton");
    expect(amountInput).toHaveValue(4990);
  });

  it("updates amount when switching cycles", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Monthly/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Monthly/ }));
    expect(screen.getByRole("spinbutton")).toHaveValue(499);

    await user.click(screen.getByRole("button", { name: /Annual/ }));
    expect(screen.getByRole("spinbutton")).toHaveValue(4990);
  });

  it("resets manual amount override when cycle changes", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Monthly/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Monthly/ }));

    // Manually override the amount
    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(amountInput, "300");
    expect(amountInput).toHaveValue(300);

    // Switch cycle → amount should reset to Annual price
    await user.click(screen.getByRole("button", { name: /Annual/ }));
    expect(screen.getByRole("spinbutton")).toHaveValue(4990);
  });

  it("shows '2-Year' and '3-Year' cycle labels", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /2-Year/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /3-Year/ })).toBeInTheDocument();
    });
  });

  it("shows 'from today' hint when subscription has no period end (TRIAL)", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Monthly/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Monthly/ }));

    await waitFor(() => {
      expect(screen.getByText(/from today/)).toBeInTheDocument();
    });
  });

  it("shows 'from current expiry' hint when subscription is still active", async () => {
    mockGetSubscription.mockResolvedValue(MOCK_SUBSCRIPTION_ACTIVE);
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    // Annual is the current option, should be auto-selected via effectiveCycleId
    await waitFor(() => {
      expect(screen.getByText(/from current expiry/)).toBeInTheDocument();
    });
  });

  it("shows correct duration text for MONTHLY cycle", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Monthly/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Monthly/ }));

    await waitFor(() => {
      expect(screen.getByText(/1 month/)).toBeInTheDocument();
    });
  });

  it("shows correct duration text for ANNUAL cycle", async () => {
    mockGetSubscription.mockResolvedValue(MOCK_SUBSCRIPTION_ACTIVE);
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => {
      expect(screen.getByText(/1 year/)).toBeInTheDocument();
    });
  });

  it("shows correct duration text for TWO_YEAR cycle", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => expect(screen.getByRole("button", { name: /2-Year/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /2-Year/ }));

    await waitFor(() => {
      expect(screen.getByText(/2 years/)).toBeInTheDocument();
    });
  });

  it("shows correct duration text for THREE_YEAR cycle", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() => expect(screen.getByRole("button", { name: /3-Year/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /3-Year/ }));

    await waitFor(() => {
      expect(screen.getByText(/3 years/)).toBeInTheDocument();
    });
  });

  // ── Save button state ──────────────────────────────────────────────────────

  it("save button is disabled when amount is empty (no cycle selected)", async () => {
    mockGetSubscription.mockResolvedValue({ ...MOCK_SUBSCRIPTION_TRIAL, plan: null });
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));
    expect(screen.getByText("Save Payment")).toBeDisabled();
  });

  // ── Submission ─────────────────────────────────────────────────────────────

  it(
    "calls recordSubscriptionPayment with billingOptionId when cycle selected",
    { timeout: 15000 },
    async () => {
      mockRecordPayment.mockResolvedValue({ id: "p1" });
      const user = userEvent.setup();
      renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
      await user.click(screen.getByText("Record Payment"));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Annual/ })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /Annual/ }));

      // Fill reference number (UPI mode)
      const inputs = screen.getAllByRole("textbox");
      await user.type(inputs[0], "UPI-REF-123");

      await waitFor(() => expect(screen.getByText("Save Payment")).not.toBeDisabled());
      await user.click(screen.getByText("Save Payment"));

      await waitFor(() => {
        expect(mockRecordPayment).toHaveBeenCalledWith(
          "soc-1",
          expect.objectContaining({
            amount: 4990,
            billingOptionId: "opt-annual",
          }),
        );
        expect(toast.success).toHaveBeenCalledWith("Payment recorded");
      });
    },
  );

  it(
    "calls recordSubscriptionPayment on submit and shows success toast",
    { timeout: 15000 },
    async () => {
      mockRecordPayment.mockResolvedValue({ id: "p1" });
      const user = userEvent.setup();
      renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
      await user.click(screen.getByText("Record Payment"));

      // Fill in amount manually (no cycle selected yet)
      const amountInput = screen.getByRole("spinbutton");
      await user.type(amountInput, "5000");

      // Fill in reference number (required for UPI)
      const inputs = screen.getAllByRole("textbox");
      await user.type(inputs[0], "UPI-REF-123");

      await waitFor(() => expect(screen.getByText("Save Payment")).not.toBeDisabled());
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
        expect(toast.success).toHaveBeenCalledWith("Payment recorded");
      });
    },
  );

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

  // ── Form fields ────────────────────────────────────────────────────────────

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

  it("changes payment mode via Select onValueChange", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Cash" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "Cash" }));

    await waitFor(() => {
      expect(screen.queryByText(/Required for/)).not.toBeInTheDocument();
    });
  });

  it("toggles send email checkbox via onCheckedChange", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("allows typing notes", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    const textboxes = screen.getAllByRole("textbox");
    const notesInput = textboxes[textboxes.length - 1];
    await user.type(notesInput, "Paid via cash");
    expect(notesInput).toHaveValue("Paid via cash");
  });

  it("manual amount override reflects in the input", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecordSubscriptionPaymentDialog societyId="soc-1" />);
    await user.click(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Monthly/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Monthly/ }));

    // Amount starts at 499 (plan price); override to a custom value
    const amountInput = screen.getByRole("spinbutton");
    // Append digits to the existing value (499 → 4993)
    await user.type(amountInput, "3");
    expect(amountInput).toHaveValue(4993);
  });
});
