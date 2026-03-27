import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──

const {
  mockGetResidentPetitions,
  mockGetResidentPetition,
  mockSignPetition,
  mockRevokeSignature,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockGetResidentPetitions: vi.fn(),
  mockGetResidentPetition: vi.fn(),
  mockSignPetition: vi.fn(),
  mockRevokeSignature: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/services/petitions", () => ({
  getResidentPetitions: (...args: unknown[]) => mockGetResidentPetitions(...args),
  getResidentPetition: (...args: unknown[]) => mockGetResidentPetition(...args),
  signPetition: (...args: unknown[]) => mockSignPetition(...args),
  revokeSignature: (...args: unknown[]) => mockRevokeSignature(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/components/features/petitions/SignaturePad", () => ({
  SignaturePad: ({ onSignature }: { onSignature: (url: string) => void }) => (
    <button
      data-testid="mock-signature-pad"
      onClick={() => onSignature("data:image/png;base64,abc")}
    >
      Mock SignaturePad
    </button>
  ),
}));

vi.mock("@/components/features/petitions/SignatureUpload", () => ({
  SignatureUpload: ({ onSignature }: { onSignature: (url: string) => void }) => (
    <button
      data-testid="mock-signature-upload"
      onClick={() => onSignature("data:image/png;base64,xyz")}
    >
      Mock SignatureUpload
    </button>
  ),
}));

import ResidentPetitionsPage from "@/app/r/petitions/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Helpers ──

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: "u1",
    name: "Test User",
    role: "RESIDENT" as const,
    permission: null,
    societyId: "s1",
    societyName: "Eden",
    societyCode: "EDEN",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <ResidentPetitionsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Mock Data ──

const mockPetition = {
  id: "pet-1",
  societyId: "s1",
  title: "Fix Water Supply",
  description: "Water supply is irregular",
  type: "COMPLAINT",
  status: "PUBLISHED",
  targetAuthority: "Municipal Corporation",
  minSignatures: 100,
  deadline: "2026-06-01",
  documentUrl: "path/to/doc.pdf",
  publishedAt: "2026-03-20T10:00:00Z",
  submittedAt: null,
  closedReason: null,
  createdAt: "2026-03-19T10:00:00Z",
  creator: { name: "Admin" },
  _count: { signatures: 47 },
};

const mockPetitionDetail = {
  ...mockPetition,
  signatureCount: 47,
  documentSignedUrl: "https://signed.url/doc.pdf",
  mySignature: null,
};

const mockPetitionDetailSigned = {
  ...mockPetitionDetail,
  mySignature: { id: "sig-1", signedAt: "2026-03-21T10:00:00Z", method: "DRAWN" },
};

const mockPetitionSubmitted = {
  ...mockPetition,
  id: "pet-2",
  title: "Road Repair Request",
  status: "SUBMITTED",
  submittedAt: "2026-03-25T10:00:00Z",
};

const mockPetitionDetailSubmitted = {
  ...mockPetitionSubmitted,
  signatureCount: 110,
  documentSignedUrl: null,
  mySignature: null,
};

// ── Tests ──

describe("ResidentPetitionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Page structure ──────────────────────────────────────────────────────────

  it("renders page title", () => {
    mockGetResidentPetitions.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Petitions")).toBeInTheDocument();
  });

  it("shows loading spinner while data is pending", () => {
    mockGetResidentPetitions.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it("shows empty state when no petitions", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No Petitions")).toBeInTheDocument();
    });
    expect(screen.getByText("No active petitions at the moment.")).toBeInTheDocument();
  });

  // ── Petition cards ──────────────────────────────────────────────────────────

  it("renders petition cards with title and type badge", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fix Water Supply")).toBeInTheDocument();
    });
    expect(screen.getByText("COMPLAINT")).toBeInTheDocument();
  });

  it("renders signature count on card", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("47 of 100 signed")).toBeInTheDocument();
    });
  });

  it("renders signature count without min when minSignatures is null", async () => {
    const petitionNoMin = { ...mockPetition, minSignatures: null };
    mockGetResidentPetitions.mockResolvedValue({ data: [petitionNoMin] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("47 signed")).toBeInTheDocument();
    });
  });

  it("renders target authority on card", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    renderPage();
    await waitFor(() => {
      // targetAuthority appears on both the card and in the sheet; getAll is safe
      expect(screen.getAllByText("Municipal Corporation")[0]).toBeInTheDocument();
    });
  });

  it("renders deadline on card", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Deadline:.*01 Jun 2026/)).toBeInTheDocument();
    });
  });

  it("renders status badge on card", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("PUBLISHED")).toBeInTheDocument();
    });
  });

  it("renders SUBMITTED status badge on card", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetitionSubmitted] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
    });
  });

  // ── Detail sheet ────────────────────────────────────────────────────────────

  it("opens detail sheet when card is clicked", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    expect(mockGetResidentPetition).toHaveBeenCalledWith("pet-1");
  });

  it("shows petition title in sheet header after loading detail", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      // Title appears in the SheetTitle inside the sheet
      const allTitles = screen.getAllByText("Fix Water Supply");
      expect(allTitles.length).toBeGreaterThan(1);
    });
  });

  it("shows View Document link when documentSignedUrl is present", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view document/i });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute("href")).toBe("https://signed.url/doc.pdf");
    });
  });

  it("shows no document link when documentSignedUrl is null", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue({
      ...mockPetitionDetail,
      documentSignedUrl: null,
      documentUrl: "path/to/doc.pdf",
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      // Sheet is open and content is loaded
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /view document/i })).not.toBeInTheDocument();
  });

  // ── Action area — unsigned PUBLISHED ────────────────────────────────────────

  it("shows Sign Petition button when petition is PUBLISHED and not signed", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign Petition" })).toBeInTheDocument();
    });
  });

  it("shows Draw/Upload tabs after clicking Sign Petition", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Draw" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Upload" })).toBeInTheDocument();
    });
  });

  it("shows SignaturePad in Draw tab by default", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => {
      expect(screen.getByTestId("mock-signature-pad")).toBeInTheDocument();
    });
  });

  it("shows SignatureUpload after switching to Upload tab", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => screen.getByRole("tab", { name: "Upload" }));
    await user.click(screen.getByRole("tab", { name: "Upload" }));
    await waitFor(() => {
      expect(screen.getByTestId("mock-signature-upload")).toBeInTheDocument();
    });
  });

  it("calls signPetition with DRAWN method when SignaturePad fires onSignature", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    mockSignPetition.mockResolvedValue({ signedAt: "2026-03-27T10:00:00Z" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => screen.getByTestId("mock-signature-pad"));
    await user.click(screen.getByTestId("mock-signature-pad"));
    await waitFor(() => {
      expect(mockSignPetition).toHaveBeenCalledWith("pet-1", {
        method: "DRAWN",
        signatureDataUrl: "data:image/png;base64,abc",
      });
    });
  });

  it("calls signPetition with UPLOADED method when SignatureUpload fires onSignature", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    mockSignPetition.mockResolvedValue({ signedAt: "2026-03-27T10:00:00Z" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => screen.getByRole("tab", { name: "Upload" }));
    await user.click(screen.getByRole("tab", { name: "Upload" }));
    await waitFor(() => screen.getByTestId("mock-signature-upload"));
    await user.click(screen.getByTestId("mock-signature-upload"));
    await waitFor(() => {
      expect(mockSignPetition).toHaveBeenCalledWith("pet-1", {
        method: "UPLOADED",
        signatureDataUrl: "data:image/png;base64,xyz",
      });
    });
  });

  it("shows success toast after sign mutation succeeds", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    mockSignPetition.mockResolvedValue({ signedAt: "2026-03-27T10:00:00Z" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => screen.getByTestId("mock-signature-pad"));
    await user.click(screen.getByTestId("mock-signature-pad"));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Petition signed!");
    });
  });

  it("shows error toast when sign mutation fails", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    mockSignPetition.mockRejectedValue(new Error("Sign failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => screen.getByTestId("mock-signature-pad"));
    await user.click(screen.getByTestId("mock-signature-pad"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Sign failed");
    });
  });

  it("shows Cancel button in sign flow and hides tabs when clicked", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Sign Petition" }));
    await user.click(screen.getByRole("button", { name: "Sign Petition" }));
    await waitFor(() => screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign Petition" })).toBeInTheDocument();
    });
  });

  // ── Action area — already signed PUBLISHED ──────────────────────────────────

  it("shows You signed badge when petition is PUBLISHED and already signed", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSigned);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      expect(screen.getByText(/You signed on/)).toBeInTheDocument();
    });
  });

  it("shows Revoke Signature button when petition is PUBLISHED and signed", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSigned);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revoke Signature" })).toBeInTheDocument();
    });
  });

  it("calls revokeSignature when Revoke Signature is clicked", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSigned);
    mockRevokeSignature.mockResolvedValue({ message: "revoked" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Revoke Signature" }));
    await user.click(screen.getByRole("button", { name: "Revoke Signature" }));
    await waitFor(() => {
      expect(mockRevokeSignature).toHaveBeenCalledWith("pet-1");
    });
  });

  it("shows success toast after revoke mutation succeeds", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSigned);
    mockRevokeSignature.mockResolvedValue({ message: "revoked" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Revoke Signature" }));
    await user.click(screen.getByRole("button", { name: "Revoke Signature" }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Signature revoked.");
    });
  });

  // ── Action area — SUBMITTED ─────────────────────────────────────────────────

  it("shows read-only message for SUBMITTED petition — no sign/revoke buttons", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetitionSubmitted] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSubmitted);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Road Repair Request"));
    await user.click(screen.getByText("Road Repair Request"));
    await waitFor(() => {
      expect(
        screen.getByText("This petition has been submitted and is no longer accepting signatures."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Sign Petition" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke Signature" })).not.toBeInTheDocument();
  });

  it("shows submitted info block for SUBMITTED petition with submittedAt", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetitionSubmitted] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSubmitted);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Road Repair Request"));
    await user.click(screen.getByText("Road Repair Request"));
    await waitFor(() => {
      expect(screen.getAllByText(/Submitted to Municipal Corporation/)[0]).toBeInTheDocument();
    });
  });

  // ── Signature count in detail sheet ────────────────────────────────────────

  it("shows error toast when revoke fails", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetailSigned);
    mockRevokeSignature.mockRejectedValue(new Error("Revoke failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByRole("button", { name: "Revoke Signature" }));
    await user.click(screen.getByRole("button", { name: "Revoke Signature" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Revoke failed");
    });
  });

  it("resets state when sheet is closed", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => screen.getByText("Sign Petition"));
    // Close the sheet by pressing Escape
    await user.keyboard("{Escape}");
    // Sheet content should disappear
    await waitFor(() => {
      expect(screen.queryByText("Sign Petition")).not.toBeInTheDocument();
    });
  });

  it("renders card without optional fields (no authority, deadline, minSignatures)", async () => {
    const minimalPetition = {
      ...mockPetition,
      id: "pet-min",
      targetAuthority: null,
      deadline: null,
      minSignatures: null,
      _count: { signatures: 3 },
    };
    mockGetResidentPetitions.mockResolvedValue({ data: [minimalPetition] });
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    // Should show "3 signed" without "of X"
    expect(screen.getByText("3 signed")).toBeInTheDocument();
    // Should NOT show "Deadline:" or authority text
    expect(screen.queryByText(/Deadline/)).not.toBeInTheDocument();
    expect(screen.queryByText("Municipal Corporation")).not.toBeInTheDocument();
  });

  it("shows signature count with progress in detail sheet", async () => {
    mockGetResidentPetitions.mockResolvedValue({ data: [mockPetition] });
    mockGetResidentPetition.mockResolvedValue(mockPetitionDetail);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    await user.click(screen.getByText("Fix Water Supply"));
    await waitFor(() => {
      // getAll to handle card + sheet instances
      expect(screen.getAllByText("47 of 100 signed").length).toBeGreaterThan(0);
    });
  });
});
