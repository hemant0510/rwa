import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SubscriptionPaymentClaimForm } from "@/components/features/subscription/SubscriptionPaymentClaimForm";
import { uploadClaimScreenshot } from "@/services/payment-claims";
import { submitSubscriptionClaim } from "@/services/subscription-payment-claims";

vi.mock("@/services/payment-claims", () => ({
  uploadClaimScreenshot: vi.fn(),
}));

vi.mock("@/services/subscription-payment-claims", () => ({
  submitSubscriptionClaim: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSubmit = vi.mocked(submitSubscriptionClaim);
const mockUpload = vi.mocked(uploadClaimScreenshot);

const SOCIETY_ID = "00000000-0000-4000-8000-000000000001";
const AMOUNT_DUE = 5000;
const PERIOD_START = "2026-04-01";
const PERIOD_END = "2026-06-30";
const mockOnSuccess = vi.fn();

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SubscriptionPaymentClaimForm
        societyId={SOCIETY_ID}
        amountDue={AMOUNT_DUE}
        periodStart={PERIOD_START}
        periodEnd={PERIOD_END}
        onSuccess={mockOnSuccess}
      />
    </QueryClientProvider>,
  );
}

async function openDialog() {
  const user = userEvent.setup();
  renderForm();
  await user.click(screen.getByRole("button", { name: /I've paid — confirm payment/i }));
  return user;
}

describe("SubscriptionPaymentClaimForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders trigger button", () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: /I've paid — confirm payment/i }),
    ).toBeInTheDocument();
  });

  it("opens dialog on trigger button click", async () => {
    await openDialog();
    expect(screen.getByText("Confirm Subscription Payment")).toBeInTheDocument();
  });

  it("renders UTR field in dialog", async () => {
    await openDialog();
    expect(screen.getByLabelText(/UTR/)).toBeInTheDocument();
  });

  it("renders amount field in dialog", async () => {
    await openDialog();
    expect(screen.getByLabelText(/Amount Paid/)).toBeInTheDocument();
  });

  it("renders payment date field in dialog", async () => {
    await openDialog();
    expect(screen.getByLabelText(/Payment Date/)).toBeInTheDocument();
  });

  it("renders period start field in dialog", async () => {
    await openDialog();
    expect(screen.getByLabelText(/Period Start/)).toBeInTheDocument();
  });

  it("renders period end field in dialog", async () => {
    await openDialog();
    expect(screen.getByLabelText(/Period End/)).toBeInTheDocument();
  });

  it("renders upload screenshot button in dialog", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: /Upload Screenshot/i })).toBeInTheDocument();
  });

  it("renders submit button in dialog", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: /Submit Payment Claim/i })).toBeInTheDocument();
  });

  // ── Pre-filled values ─────────────────────────────────────────────────────

  it("pre-fills amount from amountDue prop", async () => {
    await openDialog();
    const input = screen.getByLabelText(/Amount Paid/) as HTMLInputElement;
    expect(input.value).toBe(String(AMOUNT_DUE));
  });

  it("pre-fills period start from prop", async () => {
    await openDialog();
    const input = screen.getByLabelText(/Period Start/) as HTMLInputElement;
    expect(input.value).toBe(PERIOD_START);
  });

  it("pre-fills period end from prop", async () => {
    await openDialog();
    const input = screen.getByLabelText(/Period End/) as HTMLInputElement;
    expect(input.value).toBe(PERIOD_END);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows validation error when UTR is empty on submit", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));
    await waitFor(() => {
      expect(screen.getByText(/expected string to have >=10 characters/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid amount", async () => {
    const user = await openDialog();
    const amountInput = screen.getByLabelText(/Amount Paid/) as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "0");
    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));
    await waitFor(() => {
      // amount error branch exercised — the exact message varies by Zod version
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for empty payment date", async () => {
    const user = await openDialog();
    const dateInput = screen.getByLabelText(/Payment Date/) as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));
    await waitFor(() => {
      // paymentDate error renders
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for empty period start", async () => {
    const user = await openDialog();
    const periodInput = screen.getByLabelText(/Period Start/) as HTMLInputElement;
    await user.clear(periodInput);
    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for empty period end", async () => {
    const user = await openDialog();
    const periodInput = screen.getByLabelText(/Period End/) as HTMLInputElement;
    await user.clear(periodInput);
    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Screenshot upload ──────────────────────────────────────────────────────

  it("clicking upload button triggers the file input", async () => {
    await openDialog();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Upload Screenshot/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("does nothing when change fires with empty files", async () => {
    await openDialog();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("uploads screenshot on file selection and shows preview", async () => {
    mockUpload.mockResolvedValue({ url: "https://example.com/ss.png" });
    const user = await openDialog();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "ss.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file);
      expect(toast.success).toHaveBeenCalledWith("Screenshot uploaded");
    });

    expect(screen.getByAltText("Payment screenshot")).toBeInTheDocument();
  });

  it("shows error toast when upload fails", async () => {
    mockUpload.mockRejectedValue(new Error("Upload failed"));
    const user = await openDialog();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "ss.png", { type: "image/png" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to upload screenshot");
    });
  });

  it("removes screenshot preview on X button click", async () => {
    mockUpload.mockResolvedValue({ url: "https://example.com/ss.png" });
    const user = await openDialog();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "ss.png", { type: "image/png" }));
    await waitFor(() => expect(screen.getByAltText("Payment screenshot")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Remove screenshot/i }));
    expect(screen.queryByAltText("Payment screenshot")).not.toBeInTheDocument();
  });

  // ── Form submit ────────────────────────────────────────────────────────────

  it("calls submitSubscriptionClaim with correct values on submit", async () => {
    mockSubmit.mockResolvedValue({ claim: { id: "c-1" } as never });
    const user = await openDialog();

    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        SOCIETY_ID,
        expect.objectContaining({
          amount: AMOUNT_DUE,
          utrNumber: "ABCD1234567890",
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
        }),
      );
    });
  });

  it("calls onSuccess and shows success toast after submit", async () => {
    mockSubmit.mockResolvedValue({ claim: { id: "c-1" } as never });
    const user = await openDialog();

    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Your payment claim has been submitted. SA will verify within 2 business days.",
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it("shows error toast on submit failure", async () => {
    mockSubmit.mockRejectedValue(new Error("Server error"));
    const user = await openDialog();

    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit payment claim");
    });
  });

  it("disables submit button while submitting", async () => {
    let resolveSubmit!: (v: unknown) => void;
    mockSubmit.mockReturnValue(
      new Promise((r) => {
        resolveSubmit = r;
      }),
    );
    const user = await openDialog();

    await user.type(screen.getByLabelText(/UTR/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit Payment Claim/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit Payment Claim/i })).toBeDisabled();
    });

    resolveSubmit({ claim: { id: "c-1" } });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("disables submit button while uploading", async () => {
    let resolveUpload!: (v: unknown) => void;
    mockUpload.mockReturnValue(
      new Promise((r) => {
        resolveUpload = r;
      }),
    );
    const user = await openDialog();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "ss.png", { type: "image/png" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit Payment Claim/i })).toBeDisabled();
    });

    resolveUpload({ url: "https://example.com/ss.png" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Screenshot uploaded"));
  });
});
