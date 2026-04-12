import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PlatformPaymentSetupForm } from "@/components/features/settings/PlatformPaymentSetupForm";
import { updatePlatformUpiSetup, uploadPlatformQr } from "@/services/payment-setup";

vi.mock("@/services/payment-setup", () => ({
  updatePlatformUpiSetup: vi.fn(),
  uploadPlatformQr: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUpdatePlatformUpiSetup = vi.mocked(updatePlatformUpiSetup);
const mockUploadPlatformQr = vi.mocked(uploadPlatformQr);

const defaultInitialValues: {
  platformUpiId: string | null;
  platformUpiQrUrl: string | null;
  platformUpiAccountName: string | null;
} = {
  platformUpiId: null,
  platformUpiQrUrl: null,
  platformUpiAccountName: null,
};

const populatedInitialValues = {
  platformUpiId: "rwaconnect@icici",
  platformUpiQrUrl: "https://example.com/platform-qr.png",
  platformUpiAccountName: "RWA Connect Technologies Pvt Ltd",
};

function renderForm(initialValues = defaultInitialValues) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlatformPaymentSetupForm initialValues={initialValues} />
    </QueryClientProvider>,
  );
}

describe("PlatformPaymentSetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the Platform Payment Collection card", () => {
    renderForm();
    expect(screen.getByText("Platform Payment Collection")).toBeInTheDocument();
  });

  it("renders Platform UPI ID label and input", () => {
    renderForm();
    expect(screen.getByText(/Platform UPI ID/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("rwaconnect@icici")).toBeInTheDocument();
  });

  it("renders QR code upload button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /Upload QR Image/i })).toBeInTheDocument();
  });

  it("renders account holder name field", () => {
    renderForm();
    expect(screen.getByText(/Account Holder Name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("RWA Connect Technologies Pvt Ltd")).toBeInTheDocument();
  });

  it("renders the save button", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
  });

  it("renders format hint text", () => {
    renderForm();
    expect(screen.getByText(/name@bank/)).toBeInTheDocument();
  });

  // ── Initial values ─────────────────────────────────────────────────────────

  it("pre-fills platformUpiId from initialValues", () => {
    renderForm(populatedInitialValues);
    expect(screen.getByPlaceholderText("rwaconnect@icici")).toHaveValue("rwaconnect@icici");
  });

  it("shows QR preview when initialValues has platformUpiQrUrl", () => {
    renderForm(populatedInitialValues);
    const img = screen.getByAltText("Platform UPI QR code preview") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/platform-qr.png");
  });

  it("shows 'Replace QR Image' button when QR preview is present", () => {
    renderForm(populatedInitialValues);
    expect(screen.getByRole("button", { name: /Replace QR Image/i })).toBeInTheDocument();
  });

  it("does not show QR preview when no platformUpiQrUrl", () => {
    renderForm();
    expect(screen.queryByAltText("Platform UPI QR code preview")).not.toBeInTheDocument();
  });

  it("pre-fills platformUpiAccountName from initialValues", () => {
    renderForm(populatedInitialValues);
    expect(screen.getByPlaceholderText("RWA Connect Technologies Pvt Ltd")).toHaveValue(
      "RWA Connect Technologies Pvt Ltd",
    );
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("shows validation error for missing UPI ID on submit", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Save/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invalid/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid UPI ID format", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("rwaconnect@icici"), "notvalidformat");
    await user.click(screen.getByRole("button", { name: /Save/i }));
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
    expect(mockUploadPlatformQr).not.toHaveBeenCalled();
  });

  it("calls uploadPlatformQr on file selection and shows preview", async () => {
    mockUploadPlatformQr.mockResolvedValue({ url: "https://example.com/new-qr.png" });
    const user = userEvent.setup();
    renderForm();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["(content)"], "qr.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUploadPlatformQr).toHaveBeenCalledWith(file);
      expect(toast.success).toHaveBeenCalledWith("QR image uploaded");
    });

    const img = screen.getByAltText("Platform UPI QR code preview") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/new-qr.png");
  });

  it("shows error toast when upload fails", async () => {
    mockUploadPlatformQr.mockRejectedValue(new Error("Upload failed"));
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

    expect(screen.getByAltText("Platform UPI QR code preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Remove QR image/i }));

    expect(screen.queryByAltText("Platform UPI QR code preview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload QR Image/i })).toBeInTheDocument();
  });

  // ── Form submit ────────────────────────────────────────────────────────────

  it("calls updatePlatformUpiSetup with correct values on submit", async () => {
    mockUpdatePlatformUpiSetup.mockResolvedValue({
      platformUpiId: "platform@hdfc",
      platformUpiQrUrl: null,
      platformUpiAccountName: null,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("rwaconnect@icici"), "platform@hdfc");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdatePlatformUpiSetup).toHaveBeenCalledWith(
        expect.objectContaining({ platformUpiId: "platform@hdfc" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Platform UPI settings saved");
    });
  });

  it("includes platformUpiAccountName in submit payload", async () => {
    mockUpdatePlatformUpiSetup.mockResolvedValue({
      platformUpiId: "platform@hdfc",
      platformUpiQrUrl: null,
      platformUpiAccountName: "Test Corp",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("rwaconnect@icici"), "platform@hdfc");
    await user.type(screen.getByPlaceholderText("RWA Connect Technologies Pvt Ltd"), "Test Corp");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdatePlatformUpiSetup).toHaveBeenCalledWith(
        expect.objectContaining({ platformUpiAccountName: "Test Corp" }),
      );
    });
  });

  it("shows error toast when submit fails", async () => {
    mockUpdatePlatformUpiSetup.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("rwaconnect@icici"), "platform@hdfc");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save platform UPI settings");
    });
  });

  it("disables save button while submitting", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveSubmit!: (v: any) => void;
    mockUpdatePlatformUpiSetup.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("rwaconnect@icici"), "platform@hdfc");
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    });

    resolveSubmit({
      platformUpiId: "platform@hdfc",
      platformUpiQrUrl: null,
      platformUpiAccountName: null,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("disables save button while uploading", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveUpload!: (v: any) => void;
    mockUploadPlatformQr.mockReturnValue(
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
      expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    });

    resolveUpload({ url: "https://example.com/qr.png" });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
