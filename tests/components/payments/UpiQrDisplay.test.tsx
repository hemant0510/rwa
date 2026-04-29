import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { UpiQrDisplay } from "@/components/features/payments/UpiQrDisplay";

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    style,
  }: React.ImgHTMLAttributes<HTMLImageElement> & { width?: number; height?: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src as string} alt={alt} width={width} height={height} style={style} />
  ),
}));

const defaultProps = {
  upiQrUrl: "https://example.com/qr.png",
  upiId: "society@sbi",
  accountName: "Greenwood Residency RWA",
  amount: 2000,
};

describe("UpiQrDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders the amount prominently", () => {
    render(<UpiQrDisplay {...defaultProps} />);
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
  });

  it("renders the QR image when upiQrUrl is provided", () => {
    render(<UpiQrDisplay {...defaultProps} />);
    const img = screen.getByAltText("Society UPI QR code");
    expect(img).toBeInTheDocument();
  });

  it("renders 'QR not configured' placeholder when upiQrUrl is null", () => {
    render(<UpiQrDisplay {...defaultProps} upiQrUrl={null} />);
    expect(screen.getByText("QR not configured")).toBeInTheDocument();
    expect(screen.queryByAltText("Society UPI QR code")).not.toBeInTheDocument();
  });

  it("renders the UPI ID", () => {
    render(<UpiQrDisplay {...defaultProps} />);
    expect(screen.getByText("society@sbi")).toBeInTheDocument();
  });

  it("renders the copy button", () => {
    render(<UpiQrDisplay {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Copy UPI/i })).toBeInTheDocument();
  });

  it("renders the account name", () => {
    render(<UpiQrDisplay {...defaultProps} />);
    expect(screen.getByText("Greenwood Residency RWA")).toBeInTheDocument();
  });

  it("does not render UPI ID or copy button when upiId is null", () => {
    render(<UpiQrDisplay {...defaultProps} upiId={null} />);
    expect(screen.queryByText("society@sbi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy UPI/i })).not.toBeInTheDocument();
  });

  it("does not render account name when accountName is null", () => {
    render(<UpiQrDisplay {...defaultProps} accountName={null} />);
    expect(screen.queryByText("Greenwood Residency RWA")).not.toBeInTheDocument();
  });

  // ── Copy behaviour ─────────────────────────────────────────────────────────

  it("copies UPI ID to clipboard on copy button click", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own Clipboard stub on navigator.clipboard;
    // spy on it AFTER setup so we track the actual object that gets called.
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");
    render(<UpiQrDisplay {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Copy UPI/i }));
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith("society@sbi");
    });
  });

  it("shows toast after copying", async () => {
    const user = userEvent.setup();
    render(<UpiQrDisplay {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Copy UPI/i }));
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith("Copied!", expect.objectContaining({ duration: 1500 }));
    });
  });

  it("shows 'Copied!' text on button after clicking copy", async () => {
    const user = userEvent.setup();
    render(<UpiQrDisplay {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Copy UPI/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copied!/i })).toBeInTheDocument();
    });
  });

  it("formats large amounts with Indian locale commas", () => {
    render(<UpiQrDisplay {...defaultProps} amount={12000} />);
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
  });
});
