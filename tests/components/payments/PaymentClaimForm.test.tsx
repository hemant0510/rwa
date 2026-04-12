import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PaymentClaimForm } from "@/components/features/payments/PaymentClaimForm";
import { submitPaymentClaim, uploadClaimScreenshot } from "@/services/payment-claims";

vi.mock("@/services/payment-claims", () => ({
  submitPaymentClaim: vi.fn(),
  uploadClaimScreenshot: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSubmit = vi.mocked(submitPaymentClaim);
const mockUpload = vi.mocked(uploadClaimScreenshot);

const FEE_ID = "00000000-0000-4000-8000-000000000003";
const AMOUNT_DUE = 2000;
const mockOnSuccess = vi.fn();

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaymentClaimForm membershipFeeId={FEE_ID} amountDue={AMOUNT_DUE} onSuccess={mockOnSuccess} />
    </QueryClientProvider>,
  );
}

describe("PaymentClaimForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders UTR field", () => {
    renderForm();
    expect(screen.getByPlaceholderText(/425619876543/)).toBeInTheDocument();
  });

  it("renders payment date field", () => {
    renderForm();
    expect(screen.getByLabelText(/Payment date/)).toBeInTheDocument();
  });

  it("renders amount field pre-filled with amountDue", () => {
    renderForm();
    const input = screen.getByLabelText(/Amount paid/) as HTMLInputElement;
    expect(input.value).toBe(String(AMOUNT_DUE));
  });

  it("renders upload screenshot button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /Upload screenshot/i })).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /Submit for verification/i })).toBeInTheDocument();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows validation error when UTR is empty on submit", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Submit for verification/i }));
    await waitFor(() => {
      expect(screen.getByText(/UTR must be at least/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when UTR has invalid characters", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText(/425619876543/), "UTR-INVALID!!!");
    await user.click(screen.getByRole("button", { name: /Submit for verification/i }));
    await waitFor(() => {
      expect(screen.getByText(/letters and numbers/i)).toBeInTheDocument();
    });
  });

  // ── Screenshot upload ──────────────────────────────────────────────────────

  it("clicking upload button triggers the file input", async () => {
    const user = userEvent.setup();
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    await user.click(screen.getByRole("button", { name: /Upload screenshot/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("does nothing when change fires with empty files", () => {
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("uploads screenshot on file selection and shows preview", async () => {
    mockUpload.mockResolvedValue({ url: "https://example.com/ss.png" });
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "ss.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file);
      expect(toast.success).toHaveBeenCalledWith("Screenshot uploaded");
    });

    expect(screen.getByAltText("Payment screenshot preview")).toBeInTheDocument();
  });

  it("shows error toast when upload fails", async () => {
    mockUpload.mockRejectedValue(new Error("Upload failed"));
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "ss.png", { type: "image/png" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to upload screenshot. Max 2MB, JPG/PNG/WebP only.",
      );
    });
  });

  it("removes screenshot preview on X button click", async () => {
    mockUpload.mockResolvedValue({ url: "https://example.com/ss.png" });
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "ss.png", { type: "image/png" }));
    await waitFor(() =>
      expect(screen.getByAltText("Payment screenshot preview")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /Remove screenshot/i }));
    expect(screen.queryByAltText("Payment screenshot preview")).not.toBeInTheDocument();
  });

  // ── Form submit ────────────────────────────────────────────────────────────

  it("calls submitPaymentClaim with correct values on submit", async () => {
    mockSubmit.mockResolvedValue({ claim: { id: "c-1" } as never });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/425619876543/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit for verification/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          membershipFeeId: FEE_ID,
          claimedAmount: AMOUNT_DUE,
          utrNumber: "ABCD1234567890",
        }),
      );
    });
  });

  it("calls onSuccess and shows success toast after submit", async () => {
    mockSubmit.mockResolvedValue({ claim: { id: "c-1" } as never });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/425619876543/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit for verification/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Claim submitted — admin will verify within 24 hours.",
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it("shows API error message in toast on submit failure", async () => {
    mockSubmit.mockRejectedValue(new Error("You already have a pending claim"));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/425619876543/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit for verification/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("You already have a pending claim");
    });
  });

  it("disables submit button while submitting", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveSubmit!: (v: any) => void;
    mockSubmit.mockReturnValue(
      new Promise((r) => {
        resolveSubmit = r;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(/425619876543/), "ABCD1234567890");
    await user.click(screen.getByRole("button", { name: /Submit for verification/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit for verification/i })).toBeDisabled();
    });

    resolveSubmit({ claim: { id: "c-1" } });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("disables submit button while uploading", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveUpload!: (v: any) => void;
    mockUpload.mockReturnValue(
      new Promise((r) => {
        resolveUpload = r;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "ss.png", { type: "image/png" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit for verification/i })).toBeDisabled();
    });

    resolveUpload({ url: "https://example.com/ss.png" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Screenshot uploaded"));
  });
});
