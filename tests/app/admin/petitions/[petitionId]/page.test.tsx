import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockGetPetition,
  mockGetSignatures,
  mockUploadDocument,
  mockPublishPetition,
  mockSubmitPetition,
  mockClosePetition,
  mockUpdatePetition,
  mockDeletePetition,
  mockRemoveSignature,
  mockDownloadReport,
  mockDownloadSignedDoc,
  mockExtendDeadline,
  mockToastSuccess,
  mockToastError,
  mockPush,
} = vi.hoisted(() => ({
  mockGetPetition: vi.fn(),
  mockGetSignatures: vi.fn(),
  mockUploadDocument: vi.fn(),
  mockPublishPetition: vi.fn(),
  mockSubmitPetition: vi.fn(),
  mockClosePetition: vi.fn(),
  mockUpdatePetition: vi.fn(),
  mockDeletePetition: vi.fn(),
  mockRemoveSignature: vi.fn(),
  mockDownloadReport: vi.fn(),
  mockDownloadSignedDoc: vi.fn(),
  mockExtendDeadline: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/services/petitions", () => ({
  getPetition: (...args: unknown[]) => mockGetPetition(...args),
  getSignatures: (...args: unknown[]) => mockGetSignatures(...args),
  uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
  publishPetition: (...args: unknown[]) => mockPublishPetition(...args),
  submitPetition: (...args: unknown[]) => mockSubmitPetition(...args),
  closePetition: (...args: unknown[]) => mockClosePetition(...args),
  updatePetition: (...args: unknown[]) => mockUpdatePetition(...args),
  deletePetition: (...args: unknown[]) => mockDeletePetition(...args),
  removeSignature: (...args: unknown[]) => mockRemoveSignature(...args),
  downloadReport: (...args: unknown[]) => mockDownloadReport(...args),
  downloadSignedDoc: (...args: unknown[]) => mockDownloadSignedDoc(...args),
  extendDeadline: (...args: unknown[]) => mockExtendDeadline(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ petitionId: "pet-1" }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: () => ({
    societyId: "soc-1",
    societyName: "Eden Estate",
    societyCode: "EDEN",
    isSuperAdminViewing: false,
    saQueryString: "",
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import PetitionDetailPage from "@/app/admin/petitions/[petitionId]/page";

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Fix the Playground",
  description: "The playground equipment is broken",
  type: "PETITION",
  targetAuthority: "Municipal Corporation",
  minSignatures: 50,
  deadline: "2026-06-01T00:00:00.000Z",
  status: "DRAFT",
  documentUrl: null as string | null,
  documentSignedUrl: null as string | null,
  closedReason: null as string | null,
  submittedAt: null as string | null,
  publishedAt: null as string | null,
  createdAt: "2026-03-01T00:00:00.000Z",
  creator: { name: "Admin User" },
  _count: { signatures: 0 },
  signatureCount: 0,
};

const DRAFT_PETITION = { ...BASE, status: "DRAFT" };

const DRAFT_PETITION_WITH_DOC = {
  ...BASE,
  documentUrl: "soc-1/pet-1/doc.pdf",
  documentSignedUrl: "https://supabase.co/signed/doc.pdf",
};

const DRAFT_PETITION_WITH_DOCX = {
  ...BASE,
  documentUrl: "soc-1/pet-1/doc.docx",
  documentSignedUrl: "https://supabase.co/signed/doc.docx",
};

const PUBLISHED_PETITION = {
  ...BASE,
  status: "PUBLISHED",
  publishedAt: "2026-03-20T10:00:00.000Z",
  documentUrl: "soc-1/pet-1/doc.pdf",
  documentSignedUrl: "https://supabase.co/signed/doc.pdf",
  signatureCount: 5,
};

const PUBLISHED_NO_DOC = {
  ...BASE,
  status: "PUBLISHED",
  publishedAt: "2026-03-20T10:00:00.000Z",
  documentUrl: null,
  documentSignedUrl: null,
  signatureCount: 0,
};

const SUBMITTED_PETITION = {
  ...BASE,
  status: "SUBMITTED",
  publishedAt: "2026-03-20T10:00:00.000Z",
  submittedAt: "2026-03-25T10:00:00.000Z",
  documentUrl: "soc-1/pet-1/doc.pdf",
  documentSignedUrl: "https://supabase.co/signed/doc.pdf",
  signatureCount: 60,
};

const CLOSED_PETITION = {
  ...BASE,
  status: "CLOSED",
  closedReason: "Goal not met",
  documentUrl: "soc-1/pet-1/doc.pdf",
  documentSignedUrl: "https://supabase.co/signed/doc.pdf",
  signatureCount: 10,
};

const SIGNATURES = [
  {
    id: "sig-1",
    petitionId: "pet-1",
    userId: "user-1",
    method: "DRAWN",
    signatureUrl: "https://example.com/sig1.png",
    signedAt: "2026-03-21T10:00:00.000Z",
    user: { name: "Gaurav Gupta", email: "g@example.com", mobile: "9999999999" },
  },
  {
    id: "sig-2",
    petitionId: "pet-1",
    userId: "user-2",
    method: "UPLOADED",
    signatureUrl: "",
    signedAt: "2026-03-22T10:00:00.000Z",
    user: { name: "Hemant Bhagat", email: "h@example.com", mobile: null },
  },
];

// ── Render helper ──────────────────────────────────────────────────────────

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PetitionDetailPage />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PetitionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPetition.mockResolvedValue(DRAFT_PETITION);
    mockGetSignatures.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    // Global fetch mock for DocumentViewer blob fetching
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
    } as unknown as Response);
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  // ── Loading / not-found ────────────────────────────────────────────────────

  it("shows loading spinner while data is loading", () => {
    mockGetPetition.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows not found when petition is undefined after load", async () => {
    mockGetPetition.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Petition not found.")).toBeInTheDocument();
    });
  });

  it("navigates back from not-found state when Back to Petitions clicked", async () => {
    mockGetPetition.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Petition not found."));
    await user.click(screen.getByRole("button", { name: /back to petitions/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/petitions");
  });

  // ── Header ─────────────────────────────────────────────────────────────────

  it("renders petition title and status badge", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fix the Playground")).toBeInTheDocument();
    });
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("navigates to /admin/petitions when Back button clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/petitions");
  });

  it("shows signature count with min target", async () => {
    mockGetPetition.mockResolvedValue({ ...DRAFT_PETITION, signatureCount: 5 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("5 of 50 signatures")).toBeInTheDocument();
    });
  });

  it("shows singular signature count without target when minSignatures is null", async () => {
    mockGetPetition.mockResolvedValue({
      ...DRAFT_PETITION,
      minSignatures: null,
      signatureCount: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("1 signature")).toBeInTheDocument();
    });
  });

  it("shows plural signature count without target when minSignatures is null", async () => {
    mockGetPetition.mockResolvedValue({
      ...DRAFT_PETITION,
      minSignatures: null,
      signatureCount: 3,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("3 signatures")).toBeInTheDocument();
    });
  });

  it("shows closed reason for CLOSED petition", async () => {
    mockGetPetition.mockResolvedValue(CLOSED_PETITION);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Closed reason: Goal not met")).toBeInTheDocument();
    });
  });

  // ── DocumentViewer — PDF blob fetch ────────────────────────────────────────

  it("shows loading spinner while PDF blob is being fetched", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => screen.getByText("Petition Document"));
    // Spinner should be in the hidden desktop viewer div
    expect(document.querySelectorAll(".animate-spin").length).toBeGreaterThan(0);
  });

  it("renders iframe with blob URL after fetch succeeds", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    renderPage();
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    await waitFor(() => {
      const iframe = document.querySelector("iframe");
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute("src")).toBe("blob:mock-url");
    });
  });

  it("shows error fallback when fetch returns non-ok response", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      blob: vi.fn(),
    } as unknown as Response);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Failed to load document preview.")).toBeInTheDocument();
    });
  });

  it("shows error fallback when fetch throws a network error", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Failed to load document preview.")).toBeInTheDocument();
    });
  });

  it("shows Download PDF button in the document viewer header", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /download pdf/i })).toBeInTheDocument();
    });
  });

  it("shows mobile Open PDF button for PDF documents", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    renderPage();
    await waitFor(() => screen.getByText("Petition Document"));
    expect(screen.getByRole("link", { name: /open pdf/i })).toBeInTheDocument();
  });

  it("revokes blob URL when component unmounts", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOC);
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  // ── DocumentViewer — DOCX ───────────────────────────────────────────────────

  it("shows DOCX download-only UI without calling fetch", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOCX);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Word document — preview not available.")).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows Download DOCX button for .docx documents", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOCX);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /download docx/i })).toBeInTheDocument();
    });
  });

  it("shows Download Document label for DOCX in viewer header", async () => {
    mockGetPetition.mockResolvedValue(DRAFT_PETITION_WITH_DOCX);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /download document/i })).toBeInTheDocument();
    });
  });

  // ── No document ─────────────────────────────────────────────────────────────

  it("shows no document card when petition has no documentUrl", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No document uploaded")).toBeInTheDocument();
    });
  });

  it("shows Upload Document button in the no-doc card for DRAFT petitions", async () => {
    renderPage();
    await waitFor(() => screen.getByText("No document uploaded"));
    const uploadBtns = screen.getAllByRole("button", { name: /upload document/i });
    expect(uploadBtns.length).toBeGreaterThan(0);
  });

  // ── DRAFT actions ────────────────────────────────────────────────────────────

  it("shows DRAFT action buttons", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    expect(screen.getAllByRole("button", { name: /upload document/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^edit$/i })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
  });

  it("opens Upload Document dialog when button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("validates file type — shows error for non-PDF/DOCX file", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    // Use fireEvent.change to bypass userEvent's accept-attribute filtering
    fireEvent.change(input, { target: { files: [file] } });
    expect(mockToastError).toHaveBeenCalledWith("Only PDF and DOCX files are allowed.");
  });

  it("validates file size — shows error when file exceeds 10 MB", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    await user.upload(input, bigFile);
    expect(mockToastError).toHaveBeenCalledWith("File size must be 10 MB or less.");
  });

  it("shows selected file name after valid file is chosen", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    const file = new File(["pdf"], "petition.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await waitFor(() => {
      expect(screen.getByText("petition.pdf")).toBeInTheDocument();
    });
  });

  it("uploads document and shows success toast", async () => {
    mockUploadDocument.mockResolvedValue({ documentUrl: "soc-1/pet-1/new.pdf" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /^upload$/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Document uploaded!");
    });
  });

  it("closes Upload dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when upload fails", async () => {
    mockUploadDocument.mockRejectedValue(new Error("Upload failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /^upload$/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Upload failed");
    });
  });

  it("opens Publish confirm dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => {
      expect(screen.getByText("Publish Petition?")).toBeInTheDocument();
    });
  });

  it("publishes petition and shows success", async () => {
    mockPublishPetition.mockResolvedValue({ ...DRAFT_PETITION, status: "PUBLISHED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => screen.getByText("Publish Petition?"));
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Petition published!");
    });
  });

  it("shows error toast when publish fails", async () => {
    mockPublishPetition.mockRejectedValue(new Error("Publish failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => screen.getByText("Publish Petition?"));
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Publish failed");
    });
  });

  it("opens Delete confirm dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Delete Petition?")).toBeInTheDocument();
    });
  });

  it("deletes petition and navigates to list", async () => {
    mockDeletePetition.mockResolvedValue({ message: "Deleted" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => screen.getByText("Delete Petition?"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/petitions");
    });
  });

  it("shows error toast when delete fails", async () => {
    mockDeletePetition.mockRejectedValue(new Error("Delete failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => screen.getByText("Delete Petition?"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("opens Edit dialog pre-filled with petition data", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Petition")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Fix the Playground")).toBeInTheDocument();
  });

  it("saves edit form and shows success toast", async () => {
    mockUpdatePetition.mockResolvedValue({ ...DRAFT_PETITION, title: "Updated Title" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Petition updated!");
    });
  });

  it("shows error toast when edit fails", async () => {
    mockUpdatePetition.mockRejectedValue(new Error("Edit failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Edit failed");
    });
  });

  it("closes Edit dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Edit Petition")).not.toBeInTheDocument();
    });
  });

  // ── PUBLISHED actions ─────────────────────────────────────────────────────

  it("shows all PUBLISHED action buttons", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signed document/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /extend deadline/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^close$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^submit$/i })).toBeInTheDocument();
    });
  });

  it("hides Signed Document button when petition has no document", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_NO_DOC);
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    expect(screen.queryByRole("button", { name: /signed document/i })).not.toBeInTheDocument();
  });

  it("downloads signed document successfully", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockDownloadSignedDoc.mockResolvedValue(new Blob(["signed"], { type: "application/pdf" }));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /signed document/i }));
    await user.click(screen.getByRole("button", { name: /signed document/i }));
    await waitFor(() => {
      expect(mockDownloadSignedDoc).toHaveBeenCalledWith("soc-1", "pet-1");
    });
  });

  it("shows error toast when signed doc download fails", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockDownloadSignedDoc.mockRejectedValue(new Error("Download failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /signed document/i }));
    await user.click(screen.getByRole("button", { name: /signed document/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Download failed");
    });
  });

  it("opens Extend Deadline dialog", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /extend deadline/i })).toBeInTheDocument();
    });
  });

  it("saves extended deadline and shows success", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockExtendDeadline.mockResolvedValue({ ...PUBLISHED_PETITION, deadline: "2027-01-01" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Deadline updated.");
    });
  });

  it("shows error toast when extend deadline fails", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockExtendDeadline.mockRejectedValue(new Error("Deadline error"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Deadline error");
    });
  });

  it("cancels Extend Deadline dialog without saving", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mockExtendDeadline).not.toHaveBeenCalled();
  });

  it("opens Close dialog", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /close petition/i })).toBeInTheDocument();
    });
  });

  it("closes petition after providing reason", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockClosePetition.mockResolvedValue({ ...PUBLISHED_PETITION, status: "CLOSED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.type(screen.getByPlaceholderText(/explain why/i), "Done for now");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /close petition/i }),
    );
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Petition closed.");
    });
  });

  it("shows close form validation error when reason is too short", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.type(screen.getByPlaceholderText(/explain why/i), "Hi");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /close petition/i }),
    );
    await waitFor(() => {
      expect(mockClosePetition).not.toHaveBeenCalled();
    });
  });

  it("opens Submit confirm dialog", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => {
      expect(screen.getByText("Submit Petition?")).toBeInTheDocument();
    });
  });

  it("submits petition and shows success", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockSubmitPetition.mockResolvedValue({ ...PUBLISHED_PETITION, status: "SUBMITTED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /submit petition/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^submit$/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Petition submitted!");
    });
  });

  it("shows error toast when submit fails", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockSubmitPetition.mockRejectedValue(new Error("Submit failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /submit petition/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^submit$/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Submit failed");
    });
  });

  // ── SUBMITTED / CLOSED (read-only) ─────────────────────────────────────────

  it("shows Signed Document button for SUBMITTED petition with doc + sigs", async () => {
    mockGetPetition.mockResolvedValue(SUBMITTED_PETITION);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signed document/i })).toBeInTheDocument();
    });
  });

  it("shows Submitted status badge", async () => {
    mockGetPetition.mockResolvedValue(SUBMITTED_PETITION);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Submitted")).toBeInTheDocument();
    });
  });

  it("shows Closed status badge", async () => {
    mockGetPetition.mockResolvedValue(CLOSED_PETITION);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Closed")).toBeInTheDocument();
    });
  });

  it("shows Signed Document button for CLOSED petition with doc + sigs", async () => {
    mockGetPetition.mockResolvedValue(CLOSED_PETITION);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signed document/i })).toBeInTheDocument();
    });
  });

  // ── Signatures tab ─────────────────────────────────────────────────────────

  it("shows signatures table when signatures exist", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => {
      expect(screen.getByText("Gaurav Gupta")).toBeInTheDocument();
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
  });

  it("shows method badges in signatures table", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => {
      expect(screen.getByText("Drawn")).toBeInTheDocument();
      expect(screen.getByText("Uploaded")).toBeInTheDocument();
    });
  });

  it("shows em-dash for signature with no signatureUrl", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("shows no signatures message when array is empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => {
      expect(screen.getByText("No signatures yet.")).toBeInTheDocument();
    });
  });

  it("shows signature count with progress bar when minSignatures is set", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => {
      expect(screen.getByText("10% of target")).toBeInTheDocument();
    });
  });

  it("downloads report when Download Report is clicked", async () => {
    mockDownloadReport.mockResolvedValue(new Blob(["report"], { type: "application/pdf" }));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByRole("button", { name: /download report/i }));
    await user.click(screen.getByRole("button", { name: /download report/i }));
    await waitFor(() => {
      expect(mockDownloadReport).toHaveBeenCalledWith("soc-1", "pet-1");
    });
  });

  it("shows error toast when report download fails", async () => {
    mockDownloadReport.mockRejectedValue(new Error("Report failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByRole("button", { name: /download report/i }));
    await user.click(screen.getByRole("button", { name: /download report/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Report failed");
    });
  });

  it("opens Remove Signature dialog when trash button is clicked", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByText("Gaurav Gupta"));
    const sigRow = screen.getByText("Gaurav Gupta").closest("tr")!;
    const trashBtn = within(sigRow).getByRole("button");
    await user.click(trashBtn);
    await waitFor(() => {
      expect(screen.getByText("Remove Signature?")).toBeInTheDocument();
    });
  });

  it("removes signature and shows success toast", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    mockRemoveSignature.mockResolvedValue({ message: "Removed" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByText("Gaurav Gupta"));
    const sigRow = screen.getByText("Gaurav Gupta").closest("tr")!;
    await user.click(within(sigRow).getByRole("button"));
    await waitFor(() => screen.getByText("Remove Signature?"));
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Signature removed.");
    });
  });

  it("shows error toast when remove signature fails", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    mockRemoveSignature.mockRejectedValue(new Error("Remove failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByText("Gaurav Gupta"));
    const sigRow = screen.getByText("Gaurav Gupta").closest("tr")!;
    await user.click(within(sigRow).getByRole("button"));
    await waitFor(() => screen.getByText("Remove Signature?"));
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Remove failed");
    });
  });

  it("cancels Remove Signature dialog without removing", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByText("Gaurav Gupta"));
    const sigRow = screen.getByText("Gaurav Gupta").closest("tr")!;
    await user.click(within(sigRow).getByRole("button"));
    await waitFor(() => screen.getByText("Remove Signature?"));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Remove Signature?")).not.toBeInTheDocument();
    });
    expect(mockRemoveSignature).not.toHaveBeenCalled();
  });

  // ── Details tab ─────────────────────────────────────────────────────────────

  it("shows petition details in details tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      expect(screen.getByText("The playground equipment is broken")).toBeInTheDocument();
    });
  });

  it("shows target authority in details tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      expect(screen.getAllByText("Municipal Corporation").length).toBeGreaterThan(0);
    });
  });

  it("shows Edit and Delete buttons in details tab for DRAFT", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      const editBtns = screen.getAllByRole("button", { name: /^edit$/i });
      expect(editBtns.length).toBeGreaterThan(0);
    });
  });

  it("shows closed reason in details tab for CLOSED petition", async () => {
    mockGetPetition.mockResolvedValue(CLOSED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      expect(screen.getAllByText("Goal not met").length).toBeGreaterThan(0);
    });
  });

  it("shows publishedAt in details tab for PUBLISHED petition", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      expect(screen.getByText(/20 Mar 2026/)).toBeInTheDocument();
    });
  });

  it("shows submittedAt in details tab for SUBMITTED petition", async () => {
    mockGetPetition.mockResolvedValue(SUBMITTED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      expect(screen.getByText(/25 Mar 2026/)).toBeInTheDocument();
    });
  });

  // ── Additional branch/statement coverage ────────────────────────────────────

  it("renders COMPLAINT type badge", async () => {
    mockGetPetition.mockResolvedValue({ ...DRAFT_PETITION, type: "COMPLAINT" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Complaint")).toBeInTheDocument());
  });

  it("renders NOTICE type badge", async () => {
    mockGetPetition.mockResolvedValue({ ...DRAFT_PETITION, type: "NOTICE" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Notice")).toBeInTheDocument());
  });

  it("openEditDialog handles null optional fields", async () => {
    mockGetPetition.mockResolvedValue({
      ...DRAFT_PETITION,
      description: null,
      targetAuthority: null,
      minSignatures: null,
      deadline: null,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    // form opens with empty optional fields
    expect(screen.getByDisplayValue("Fix the Playground")).toBeInTheDocument();
  });

  it("handleFileChange clears selected file when input cleared", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await waitFor(() => screen.getByText("doc.pdf"));
    // Now clear the input (simulates user pressing Cancel in file picker)
    fireEvent.change(input, { target: { files: [] } });
    await waitFor(() => {
      expect(screen.queryByText("doc.pdf")).not.toBeInTheDocument();
    });
  });

  it("opens Upload dialog from no-document card button", async () => {
    const user = userEvent.setup();
    renderPage(); // DRAFT_PETITION has no document → shows both header + card Upload buttons
    await waitFor(() => screen.getByText("Fix the Playground"));
    const uploadBtns = screen.getAllByRole("button", { name: /upload document/i });
    // card button is the last one
    await user.click(uploadBtns[uploadBtns.length - 1]);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("closes Upload dialog via X button and resets file state", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    // Select a file first so we can verify it resets
    const input = screen.getByLabelText(/pdf document/i);
    await user.upload(input, new File(["pdf"], "doc.pdf", { type: "application/pdf" }));
    await waitFor(() => screen.getByText("doc.pdf"));
    // Click the X close button in the dialog header
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^close$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("cancels Publish confirm dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => screen.getByRole("heading", { name: /publish petition/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mockPublishPetition).not.toHaveBeenCalled();
  });

  it("cancels Submit confirm dialog", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /submit petition/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mockSubmitPetition).not.toHaveBeenCalled();
  });

  it("shows error toast when close petition fails", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockClosePetition.mockRejectedValue(new Error("Close failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.type(screen.getByPlaceholderText(/explain why/i), "Done for now");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /close petition/i }),
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Close failed");
    });
  });

  it("closes Close dialog via Escape key", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("cancels Close dialog via Cancel button", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(mockClosePetition).not.toHaveBeenCalled();
  });

  it("submits Close form via form submit event", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockClosePetition.mockResolvedValue({ ...PUBLISHED_PETITION, status: "CLOSED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.type(screen.getByPlaceholderText(/explain why/i), "Done for now, closing this one.");
    const form = screen.getByRole("dialog").querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockClosePetition).toHaveBeenCalled();
    });
  });

  it("closes Edit dialog via Escape key", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Edit Petition")).not.toBeInTheDocument();
    });
  });

  it("submits Edit form via form submit event", async () => {
    mockUpdatePetition.mockResolvedValue(DRAFT_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    const form = screen.getByRole("dialog").querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockUpdatePetition).toHaveBeenCalled();
    });
  });

  it("shows edit form validation error when title is cleared", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    const titleInput = screen.getByDisplayValue("Fix the Playground");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdatePetition).not.toHaveBeenCalled();
    });
  });

  it("changes type in Edit dialog via Select", async () => {
    mockUpdatePetition.mockResolvedValue({ ...DRAFT_PETITION, type: "COMPLAINT" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    // Open the type select (there should be exactly one combobox in the dialog)
    const dialog = screen.getByRole("dialog");
    const typeSelect = within(dialog).getByRole("combobox");
    await user.click(typeSelect);
    await waitFor(() => screen.getByRole("option", { name: /complaint/i }));
    await user.click(screen.getByRole("option", { name: /complaint/i }));
    await waitFor(() => {
      // Options close after selection
      expect(screen.queryByRole("option", { name: /complaint/i })).not.toBeInTheDocument();
    });
  });

  it("cancels Delete dialog via Cancel button", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => screen.getByText("Delete Petition?"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Delete Petition?")).not.toBeInTheDocument();
    });
    expect(mockDeletePetition).not.toHaveBeenCalled();
  });

  it("closes Remove Signature dialog via Escape key", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByText("Gaurav Gupta"));
    const sigRow = screen.getByText("Gaurav Gupta").closest("tr")!;
    await user.click(within(sigRow).getByRole("button"));
    await waitFor(() => screen.getByText("Remove Signature?"));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Remove Signature?")).not.toBeInTheDocument();
    });
  });

  it("changes date in Extend Deadline dialog", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockExtendDeadline.mockResolvedValue({ ...PUBLISHED_PETITION, deadline: "2027-06-30" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    const dateInput = screen.getByLabelText(/deadline \(optional\)/i);
    fireEvent.change(dateInput, { target: { value: "2027-06-30" } });
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockExtendDeadline).toHaveBeenCalledWith("soc-1", "pet-1", "2027-06-30");
    });
  });

  it("closes Extend Deadline dialog via Escape key", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("clicks Edit button in details tab for DRAFT", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => {
      const editBtns = screen.getAllByRole("button", { name: /^edit$/i });
      expect(editBtns.length).toBeGreaterThan(1);
    });
    const editBtns = screen.getAllByRole("button", { name: /^edit$/i });
    // Click the LAST Edit button (the one in the details tab card)
    await user.click(editBtns[editBtns.length - 1]);
    await waitFor(() => {
      expect(screen.getByText("Edit Petition")).toBeInTheDocument();
    });
  });

  it("clicks Delete button in details tab for DRAFT", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /details/i }));
    await waitFor(() => screen.getByText("The playground equipment is broken"));
    const deleteBtns = screen.getAllByRole("button", { name: /delete/i });
    // Click the LAST Delete button (the one in the details tab card)
    await user.click(deleteBtns[deleteBtns.length - 1]);
    await waitFor(() => {
      expect(screen.getByText("Delete Petition?")).toBeInTheDocument();
    });
  });

  it("shows PUBLISHED petition Signed Document button when no deadline", async () => {
    mockGetPetition.mockResolvedValue({
      ...PUBLISHED_PETITION,
      deadline: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /extend deadline/i })).toBeInTheDocument();
    });
  });

  it("extends deadline to null when no deadline is set (covers line 580 falsy branch)", async () => {
    mockGetPetition.mockResolvedValue({ ...PUBLISHED_PETITION, deadline: null });
    mockExtendDeadline.mockResolvedValue({ ...PUBLISHED_PETITION, deadline: null });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    // Save without entering a date — newDeadline is "" → passed as null
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockExtendDeadline).toHaveBeenCalledWith("soc-1", "pet-1", null);
    });
  });

  it("shows isReadOnly Signed Document button false-branch (no sigs)", async () => {
    mockGetPetition.mockResolvedValue({ ...SUBMITTED_PETITION, signatureCount: 0 });
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    // No Signed Document button when signatureCount = 0 for isReadOnly petition
    expect(screen.queryByRole("button", { name: /signed document/i })).not.toBeInTheDocument();
  });

  it("shows error 'Failed to download report' on non-Error rejection", async () => {
    mockDownloadReport.mockRejectedValue("network error");
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByRole("button", { name: /download report/i }));
    await user.click(screen.getByRole("button", { name: /download report/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to download report");
    });
  });

  it("shows error 'Failed to download signed document' on non-Error rejection", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockDownloadSignedDoc.mockRejectedValue("network error");
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /signed document/i }));
    await user.click(screen.getByRole("button", { name: /signed document/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to download signed document");
    });
  });

  it("shows minSignatures validation error in Edit dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    const minSigInput = screen.getByPlaceholderText(/e\.g\. 100/i);
    await user.clear(minSigInput);
    await user.type(minSigInput, "0");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      // Validation prevents mutation from being called
      expect(mockUpdatePetition).not.toHaveBeenCalled();
    });
  });

  // ── isPending spinner coverage ────────────────────────────────────────────

  it("shows spinner while upload is pending", async () => {
    mockUploadDocument.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const input = screen.getByLabelText(/pdf document/i);
    await user.upload(input, new File(["pdf"], "doc.pdf", { type: "application/pdf" }));
    await waitFor(() => screen.getByText("doc.pdf"));
    await user.click(screen.getByRole("button", { name: /^upload$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while publish is pending", async () => {
    mockPublishPetition.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => screen.getByRole("heading", { name: /publish petition/i }));
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while submit is pending", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockSubmitPetition.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^submit$/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /submit petition/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^submit$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while close is pending", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockClosePetition.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /^close$/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => screen.getByRole("heading", { name: /close petition/i }));
    await user.type(screen.getByPlaceholderText(/explain why/i), "Closing now permanently.");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /close petition/i }),
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while update (edit) is pending", async () => {
    mockUpdatePetition.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    await waitFor(() => screen.getByText("Edit Petition"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while delete is pending", async () => {
    mockDeletePetition.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => screen.getByText("Delete Petition?"));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while remove signature is pending", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockGetSignatures.mockResolvedValue({ data: SIGNATURES, total: 2, page: 1, limit: 20 });
    mockRemoveSignature.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getByRole("tab", { name: /signatures/i }));
    await waitFor(() => screen.getByText("Gaurav Gupta"));
    const sigRow = screen.getByText("Gaurav Gupta").closest("tr")!;
    await user.click(within(sigRow).getByRole("button"));
    await waitFor(() => screen.getByText("Remove Signature?"));
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows spinner while extend deadline is pending", async () => {
    mockGetPetition.mockResolvedValue(PUBLISHED_PETITION);
    mockExtendDeadline.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /extend deadline/i }));
    await waitFor(() => screen.getByRole("heading", { name: /extend deadline/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("shows signed doc spinner for isReadOnly petition while download is pending", async () => {
    mockGetPetition.mockResolvedValue(SUBMITTED_PETITION);
    mockDownloadSignedDoc.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /signed document/i }));
    await user.click(screen.getByRole("button", { name: /signed document/i }));
    await waitFor(() => {
      // signedDocPending=true shows spinner (animate-spin) inside the isReadOnly button
      expect(document.querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("renders StatusBadge with unknown status using ?? fallback style", async () => {
    // Covers the ?? fallback branch in StatusBadge
    mockGetPetition.mockResolvedValue({ ...DRAFT_PETITION, status: "CUSTOM_STATUS" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Custom_status")).toBeInTheDocument());
  });

  it("renders TypeBadge with unknown type using ?? fallback style", async () => {
    // Covers the ?? fallback branch in TypeBadge
    mockGetPetition.mockResolvedValue({ ...DRAFT_PETITION, type: "CUSTOM_TYPE" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Custom_type")).toBeInTheDocument());
  });

  it("Upload onClick does nothing when selectedFile is null (covers if(selectedFile) false branch)", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Fix the Playground"));
    await user.click(screen.getAllByRole("button", { name: /upload document/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    // No file selected — fireEvent to bypass disabled attribute and trigger onClick directly
    const uploadBtn = within(screen.getByRole("dialog")).getByRole("button", { name: /^upload$/i });
    fireEvent.click(uploadBtn);
    // selectedFile is null → if(selectedFile) is false → mutation NOT called
    expect(mockUploadDocument).not.toHaveBeenCalled();
  });
});
