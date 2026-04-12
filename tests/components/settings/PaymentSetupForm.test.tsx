import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PaymentSetupForm } from "@/components/features/settings/PaymentSetupForm";
import { updateUpiSetup, uploadSocietyQr } from "@/services/payment-setup";

vi.mock("@/services/payment-setup", () => ({
  updateUpiSetup: vi.fn(),
  uploadSocietyQr: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdateUpiSetup = vi.mocked(updateUpiSetup);
const mockUploadSocietyQr = vi.mocked(uploadSocietyQr);

const SOCIETY_ID = "soc-1";

const defaultInitialValues: {
  upiId: string | null;
  upiQrUrl: string | null;
  upiAccountName: string | null;
} = {
  upiId: null,
  upiQrUrl: null,
  upiAccountName: null,
};

const populatedInitialValues = {
  upiId: "edenestate@sbi",
  upiQrUrl: "https://example.com/qr.png",
  upiAccountName: "Eden Estate RWA",
};

function renderForm(initialValues = defaultInitialValues) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaymentSetupForm societyId={SOCIETY_ID} initialValues={initialValues} />
    </QueryClientProvider>,
  );
}

describe("PaymentSetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the UPI Payment Setup card", () => {
    renderForm();
    expect(screen.getByText("UPI Payment Setup")).toBeInTheDocument();
  });

  it("renders UPI ID label and input", () => {
    renderForm();
    expect(screen.getByText(/Society UPI ID/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("edenestate@sbi")).toBeInTheDocument();
  });

  it("renders QR code upload button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /Upload QR Image/i })).toBeInTheDocument();
  });

  it("renders account name field", () => {
    renderForm();
    expect(screen.getByText(/Bank Account Name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Eden Estate RWA")).toBeInTheDocument();
  });

  it("renders the save button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /Save UPI Settings/i })).toBeInTheDocument();
  });

  it("renders format hint text", () => {
    renderForm();
    expect(screen.getByText(/name@bank/)).toBeInTheDocument();
  });

  it("renders security warning", () => {
    renderForm();
    expect(screen.getByText(/official bank account/)).toBeInTheDocument();
  });

  // ── Initial values ─────────────────────────────────────────────────────────

  it("pre-fills upiId from initialValues", () => {
    renderForm(populatedInitialValues);
    expect(screen.getByPlaceholderText("edenestate@sbi")).toHaveValue("edenestate@sbi");
  });

  it("shows QR preview when initialValues has upiQrUrl", () => {
    renderForm(populatedInitialValues);
    const img = screen.getByAltText("UPI QR code preview") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/qr.png");
  });

  it("shows 'Replace QR Image' button when QR preview is present", () => {
    renderForm(populatedInitialValues);
    expect(screen.getByRole("button", { name: /Replace QR Image/i })).toBeInTheDocument();
  });

  it("does not show QR preview when no upiQrUrl in initialValues", () => {
    renderForm();
    expect(screen.queryByAltText("UPI QR code preview")).not.toBeInTheDocument();
  });

  it("pre-fills upiAccountName from initialValues", () => {
    renderForm(populatedInitialValues);
    const accountInput = screen.getByPlaceholderText("Eden Estate RWA");
    expect(accountInput).toHaveValue("Eden Estate RWA");
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows validation error for missing UPI ID on submit", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Save UPI Settings/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invalid UPI ID format/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid UPI ID format", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("edenestate@sbi"), "notvalidformat");
    await user.click(screen.getByRole("button", { name: /Save UPI Settings/i }));
    await waitFor(() => {
      expect(screen.getByText(/name@bank/i)).toBeInTheDocument();
    });
  });

  // ── QR upload ──────────────────────────────────────────────────────────────

  it("clicking the upload button triggers the file input", async () => {
    const user = userEvent.setup();
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    await user.click(screen.getByRole("button", { name: /Upload QR Image/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("does nothing when change fires with no file selected", () => {
    renderForm();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockUploadSocietyQr).not.toHaveBeenCalled();
  });

  it("calls uploadSocietyQr on file selection and shows preview", async () => {
    mockUploadSocietyQr.mockResolvedValue({ url: "https://example.com/new-qr.png" });
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["(content)"], "qr.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUploadSocietyQr).toHaveBeenCalledWith(SOCIETY_ID, file);
      expect(toast.success).toHaveBeenCalledWith("QR image uploaded");
    });

    const img = screen.getByAltText("UPI QR code preview") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/new-qr.png");
  });

  it("shows error toast when upload fails", async () => {
    mockUploadSocietyQr.mockRejectedValue(new Error("Upload failed"));
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["(content)"], "qr.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to upload QR image. Max 2MB, JPG/PNG/WebP only.",
      );
    });
  });

  it("removes QR preview when X button is clicked", async () => {
    const user = userEvent.setup();
    renderForm(populatedInitialValues);

    expect(screen.getByAltText("UPI QR code preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remove QR image/i }));

    expect(screen.queryByAltText("UPI QR code preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload QR Image/i })).toBeInTheDocument();
  });

  // ── Form submit ────────────────────────────────────────────────────────────

  it("calls updateUpiSetup with correct values on submit", async () => {
    mockUpdateUpiSetup.mockResolvedValue({
      upiId: "society@hdfc",
      upiQrUrl: null,
      upiAccountName: null,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("edenestate@sbi"), "society@hdfc");
    await user.click(screen.getByRole("button", { name: /Save UPI Settings/i }));

    await waitFor(() => {
      expect(mockUpdateUpiSetup).toHaveBeenCalledWith(
        SOCIETY_ID,
        expect.objectContaining({ upiId: "society@hdfc" }),
      );
      expect(toast.success).toHaveBeenCalledWith("UPI payment settings saved");
    });
  });

  it("includes upiAccountName in submit payload", async () => {
    mockUpdateUpiSetup.mockResolvedValue({
      upiId: "society@hdfc",
      upiQrUrl: null,
      upiAccountName: "Test RWA",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("edenestate@sbi"), "society@hdfc");
    await user.type(screen.getByPlaceholderText("Eden Estate RWA"), "Test RWA");
    await user.click(screen.getByRole("button", { name: /Save UPI Settings/i }));

    await waitFor(() => {
      expect(mockUpdateUpiSetup).toHaveBeenCalledWith(
        SOCIETY_ID,
        expect.objectContaining({ upiAccountName: "Test RWA" }),
      );
    });
  });

  it("shows error toast when submit fails", async () => {
    mockUpdateUpiSetup.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("edenestate@sbi"), "society@hdfc");
    await user.click(screen.getByRole("button", { name: /Save UPI Settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save UPI settings");
    });
  });

  it("disables save button while submitting", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveSubmit!: (v: any) => void;
    mockUpdateUpiSetup.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("edenestate@sbi"), "society@hdfc");
    await user.click(screen.getByRole("button", { name: /Save UPI Settings/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save UPI Settings/i })).toBeDisabled();
    });

    resolveSubmit({ upiId: "society@hdfc", upiQrUrl: null, upiAccountName: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("disables save button while uploading", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveUpload!: (v: any) => void;
    mockUploadSocietyQr.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["(content)"], "qr.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save UPI Settings/i })).toBeDisabled();
    });

    resolveUpload({ url: "https://example.com/qr.png" });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
