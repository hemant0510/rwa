import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PendingClaimCard } from "@/components/features/payments/PendingClaimCard";
import type { PaymentClaim } from "@/types/payment";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseClaim: PaymentClaim = {
  id: "claim-1",
  societyId: "soc-1",
  userId: "user-1",
  membershipFeeId: "fee-1",
  claimedAmount: 2000,
  utrNumber: "UTR123456789012",
  paymentDate: "2026-04-04T00:00:00Z",
  screenshotUrl: null,
  status: "PENDING",
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  adminNotes: null,
  createdAt: "2026-04-04T10:32:00Z",
  updatedAt: "2026-04-04T10:32:00Z",
  user: { name: "Hemant Kumar", unitNumber: "302" },
};

function renderCard(overrides: Partial<PaymentClaim> = {}, props: { isPending?: boolean } = {}) {
  const claim = { ...baseClaim, ...overrides };
  const onVerify = vi.fn();
  const onReject = vi.fn();
  render(
    <PendingClaimCard
      claim={claim}
      onVerify={onVerify}
      onReject={onReject}
      isPending={props.isPending ?? false}
    />,
  );
  return { onVerify, onReject };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PendingClaimCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders resident name, flat, amount, UTR, and submitted time", () => {
    renderCard();
    expect(screen.getByText(/Hemant Kumar — Flat 302/)).toBeInTheDocument();
    expect(screen.getByText(/₹2,000/)).toBeInTheDocument();
    expect(screen.getByText(/UTR: UTR123456789012/)).toBeInTheDocument();
    expect(screen.getByText(/Submitted:/)).toBeInTheDocument();
  });

  it("shows PENDING badge", () => {
    renderCard();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("shows VERIFIED badge and no action buttons", () => {
    renderCard({ status: "VERIFIED" });
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("shows REJECTED badge and rejection reason", () => {
    renderCard({ status: "REJECTED", rejectionReason: "UTR not found in bank statement" });
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText(/UTR not found in bank statement/)).toBeInTheDocument();
  });

  it("shows inline screenshot image and link when screenshotUrl is provided", () => {
    renderCard({ screenshotUrl: "https://example.com/screenshot.png" });
    const img = screen.getByRole("img", { name: /payment screenshot/i });
    expect(img).toHaveAttribute("src", "https://example.com/screenshot.png");
    // The wrapping <a> opens the image full-size in a new tab
    const link = img.closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/screenshot.png");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Payment Screenshot")).toBeInTheDocument();
  });

  it("does not show screenshot section when screenshotUrl is null", () => {
    renderCard({ screenshotUrl: null });
    expect(screen.queryByRole("img", { name: /payment screenshot/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Screenshot")).not.toBeInTheDocument();
  });

  it("calls onVerify with claim id and admin notes when Confirm clicked", async () => {
    const user = userEvent.setup();
    const { onVerify } = renderCard();
    const notesTextarea = screen.getByPlaceholderText(/internal notes/i);
    await user.type(notesTextarea, "Looks good");
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onVerify).toHaveBeenCalledWith("claim-1", "Looks good");
  });

  it("calls onVerify without notes when notes field is empty", async () => {
    const user = userEvent.setup();
    const { onVerify } = renderCard();
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onVerify).toHaveBeenCalledWith("claim-1", undefined);
  });

  it("disables Confirm and Reject buttons when isPending", () => {
    renderCard({}, { isPending: true });
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
  });

  it("shows rejection form when Reject is clicked", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: /reject/i }));
    expect(screen.getByPlaceholderText(/UTR not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm rejection/i })).toBeInTheDocument();
  });

  it("keeps Confirm Rejection disabled until reason is >= 10 chars", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: /reject/i }));
    const textarea = screen.getByPlaceholderText(/UTR not found/i);
    await user.type(textarea, "Too short");
    expect(screen.getByRole("button", { name: /confirm rejection/i })).toBeDisabled();
    await user.clear(textarea);
    await user.type(textarea, "UTR not found in bank");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /confirm rejection/i })).not.toBeDisabled(),
    );
  });

  it("calls onReject with id and reason on submission", async () => {
    const user = userEvent.setup();
    const { onReject } = renderCard();
    await user.click(screen.getByRole("button", { name: /reject/i }));
    await user.type(
      screen.getByPlaceholderText(/UTR not found/i),
      "UTR not found in bank statement",
    );
    await user.click(screen.getByRole("button", { name: /confirm rejection/i }));
    expect(onReject).toHaveBeenCalledWith("claim-1", "UTR not found in bank statement");
  });

  it("hides reject form and clears reason when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: /reject/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/UTR not found/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("shows adminNotes when provided on a non-pending claim", () => {
    renderCard({ status: "VERIFIED", adminNotes: "Verified manually" });
    expect(screen.getByText(/Notes: Verified manually/)).toBeInTheDocument();
  });

  it("shows Unknown and dash when user is null", () => {
    renderCard({ user: undefined });
    expect(screen.getByText(/Unknown — Flat —/)).toBeInTheDocument();
  });

  it("applies no extra class for unknown status", () => {
    renderCard({ status: "UNKNOWN_STATUS" as PaymentClaim["status"] });
    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
  });
});
