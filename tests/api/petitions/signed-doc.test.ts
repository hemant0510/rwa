import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  petition: { findUnique: vi.fn() },
  petitionSignature: { findMany: vi.fn() },
  society: { findUnique: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

const mockSupabaseStorage = vi.hoisted(() => ({ from: vi.fn() }));
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({ storage: mockSupabaseStorage }),
);

const mockPDFDocumentLoad = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateClient }));
vi.mock("pdf-lib", () => ({
  PDFDocument: { load: (...args: unknown[]) => mockPDFDocumentLoad(...args) },
  StandardFonts: { Helvetica: "Helvetica", HelveticaBold: "Helvetica-Bold" },
  rgb: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0 }),
}));

import { GET } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/signed-doc/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest() {
  return new NextRequest("http://localhost/test");
}

function makeParams(societyId = "soc-1", petitionId = "pet-1") {
  return { params: Promise.resolve({ id: societyId, petitionId }) };
}

function makeBlobWithData(data: Uint8Array = new Uint8Array([37, 80, 68, 70])) {
  return { arrayBuffer: () => Promise.resolve(data.buffer as ArrayBuffer) };
}

// ---------------------------------------------------------------------------
// Mock pdf-lib page / font / image factories
// ---------------------------------------------------------------------------

function makeMockPage(width = 595, height = 842) {
  return {
    getSize: vi.fn().mockReturnValue({ width, height }),
    drawText: vi.fn(),
    drawLine: vi.fn(),
    drawRectangle: vi.fn(),
    drawImage: vi.fn(),
  };
}

function makeMockFont() {
  return {
    widthOfTextAtSize: vi.fn().mockReturnValue(50),
  };
}

function makeMockImage(w = 100, h = 40) {
  return {
    scale: vi.fn().mockImplementation((s: number) => ({ width: w * s, height: h * s })),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockPetition = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Fix the Playground",
  type: "PETITION",
  targetAuthority: "Municipal Corporation",
  submittedAt: null,
  documentUrl: "soc-1/pet-1/document.pdf",
  _count: { signatures: 2 },
};

const mockSociety = { name: "Greenwood Residency" };

const mockSignatures = [
  {
    id: "sig-1",
    petitionId: "pet-1",
    userId: "user-1",
    societyId: "soc-1",
    method: "DRAWN",
    signatureUrl: "soc-1/pet-1/user-1.png",
    signedAt: new Date("2026-04-01T10:00:00Z"),
    user: {
      name: "Gaurav Gupta",
      userUnits: [{ unit: { displayLabel: "A-101" } }],
    },
  },
  {
    id: "sig-2",
    petitionId: "pet-1",
    userId: "user-2",
    societyId: "soc-1",
    method: "UPLOADED",
    signatureUrl: "soc-1/pet-1/user-2.png",
    signedAt: new Date("2026-04-02T10:00:00Z"),
    user: {
      name: "Arjun Kapoor",
      userUnits: [],
    },
  },
];

const mockMergedBytes = new Uint8Array([37, 80, 68, 70, 45, 49]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/petitions/[petitionId]/signed-doc", () => {
  let mockPage: ReturnType<typeof makeMockPage>;
  let mockFont: ReturnType<typeof makeMockFont>;
  let mockImage: ReturnType<typeof makeMockImage>;
  let mockPdfDoc: {
    getPages: ReturnType<typeof vi.fn>;
    addPage: ReturnType<typeof vi.fn>;
    embedFont: ReturnType<typeof vi.fn>;
    embedPng: ReturnType<typeof vi.fn>;
    embedJpg: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPetition);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.petitionSignature.findMany.mockResolvedValue(mockSignatures);

    mockPage = makeMockPage();
    mockFont = makeMockFont();
    mockImage = makeMockImage();

    mockPdfDoc = {
      getPages: vi.fn().mockReturnValue([mockPage]),
      addPage: vi.fn().mockReturnValue(mockPage),
      embedFont: vi.fn().mockResolvedValue(mockFont),
      embedPng: vi.fn().mockResolvedValue(mockImage),
      embedJpg: vi.fn().mockResolvedValue(mockImage),
      save: vi.fn().mockResolvedValue(mockMergedBytes),
    };

    mockPDFDocumentLoad.mockReset();
    mockPDFDocumentLoad.mockResolvedValue(mockPdfDoc);

    // Storage: petition-docs returns original PDF bytes; petition-signatures returns PNG bytes
    mockSupabaseStorage.from.mockImplementation((bucket: string) => {
      if (bucket === "petition-docs") {
        return {
          download: vi.fn().mockResolvedValue({
            data: makeBlobWithData(new Uint8Array([37, 80, 68, 70])),
            error: null,
          }),
        };
      }
      return {
        download: vi.fn().mockResolvedValue({
          data: makeBlobWithData(new Uint8Array([137, 80, 78, 71])),
          error: null,
        }),
      };
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated as admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  // ── Not found guards ──────────────────────────────────────────────────────

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockPetition, societyId: "other-soc" });
    const res = await GET(makeGetRequest(), makeParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when society is not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  // ── Business rule guards ──────────────────────────────────────────────────

  it("returns 400 NO_DOCUMENT when petition has no documentUrl", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockPetition, documentUrl: null });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_DOCUMENT");
  });

  it("returns 400 NO_SIGNATURES when petition has zero signatures", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      _count: { signatures: 0 },
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_SIGNATURES");
  });

  // ── Storage failures ──────────────────────────────────────────────────────

  it("returns 500 when original PDF download returns an error", async () => {
    mockSupabaseStorage.from.mockImplementation((bucket: string) => {
      if (bucket === "petition-docs") {
        return {
          download: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Storage unavailable"),
          }),
        };
      }
      return {
        download: vi.fn().mockResolvedValue({ data: makeBlobWithData(), error: null }),
      };
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 when original PDF download data is null (no error)", async () => {
    mockSupabaseStorage.from.mockImplementation((bucket: string) => {
      if (bucket === "petition-docs") {
        return { download: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return {
        download: vi.fn().mockResolvedValue({ data: makeBlobWithData(), error: null }),
      };
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns 200 with application/pdf content-type on success", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns Content-Disposition attachment header", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".pdf");
  });

  it("sanitizes petition title into the filename", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    const disposition = res.headers.get("Content-Disposition") ?? "";
    // "Fix the Playground" → "fix-the-playground"
    expect(disposition).toContain("fix-the-playground");
  });

  // ── New dedicated signature page ──────────────────────────────────────────

  it("always adds a fresh page for the signature section", async () => {
    await GET(makeGetRequest(), makeParams());
    // addPage must be called at least once (for the initial signature page)
    expect(mockPdfDoc.addPage).toHaveBeenCalled();
  });

  it("reads the original PDF page dimensions via getPages + getSize", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPdfDoc.getPages).toHaveBeenCalled();
    expect(mockPage.getSize).toHaveBeenCalled();
  });

  it("draws the society name in the signature page header", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("Greenwood Residency");
  });

  it("draws the petition title in the signature page header", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("Fix the Playground");
  });

  it("draws the generated date in the header", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls.some((t) => t.startsWith("Generated:"))).toBe(true);
  });

  // ── PDF manipulation ──────────────────────────────────────────────────────

  it("loads PDFDocument once for the original PDF", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPDFDocumentLoad).toHaveBeenCalledOnce();
  });

  it("embeds Helvetica and Helvetica-Bold fonts", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPdfDoc.embedFont).toHaveBeenCalledWith("Helvetica");
    expect(mockPdfDoc.embedFont).toHaveBeenCalledWith("Helvetica-Bold");
    expect(mockPdfDoc.embedFont).toHaveBeenCalledTimes(2);
  });

  it("draws SIGNATURES section label", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("SIGNATURES");
  });

  it("draws table header labels: #, NAME, UNIT, DATE SIGNED, SIGNATURE", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("#");
    expect(textCalls).toContain("NAME");
    expect(textCalls).toContain("UNIT");
    expect(textCalls).toContain("DATE SIGNED");
    expect(textCalls).toContain("SIGNATURE");
  });

  it("draws the signatory names in the table rows", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("Gaurav Gupta");
    expect(textCalls).toContain("Arjun Kapoor");
  });

  it("draws the unit displayLabel for each signatory", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("A-101");
  });

  it("draws em-dash for signatories with no unit", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    // Arjun Kapoor has no userUnits → falls back to "—"
    expect(textCalls).toContain("—");
  });

  it("draws the total signature count at the end", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls.some((t) => t.includes("Total Signatures: 2"))).toBe(true);
  });

  it("draws separator lines on the page", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPage.drawLine).toHaveBeenCalled();
  });

  it("draws the dark table header background rectangle", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPage.drawRectangle).toHaveBeenCalled();
  });

  it("calls pdfDoc.save() to produce the final bytes", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPdfDoc.save).toHaveBeenCalledOnce();
  });

  // ── Signature image handling ──────────────────────────────────────────────

  it("fetches original PDF from petition-docs bucket", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-docs");
  });

  it("fetches signature images from petition-signatures bucket", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-signatures");
  });

  it("calls embedPng for each signature that has image bytes", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPdfDoc.embedPng).toHaveBeenCalledTimes(mockSignatures.length);
  });

  it("calls drawImage when a signature PNG embeds successfully", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPage.drawImage).toHaveBeenCalled();
  });

  it("gracefully handles missing signature images and still returns PDF", async () => {
    mockSupabaseStorage.from.mockImplementation((bucket: string) => {
      if (bucket === "petition-docs") {
        return {
          download: vi.fn().mockResolvedValue({ data: makeBlobWithData(), error: null }),
        };
      }
      return { download: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("handles thrown error during signature image fetch (still returns PDF)", async () => {
    mockSupabaseStorage.from.mockImplementation((bucket: string) => {
      if (bucket === "petition-docs") {
        return {
          download: vi.fn().mockResolvedValue({ data: makeBlobWithData(), error: null }),
        };
      }
      return { download: vi.fn().mockRejectedValue(new Error("Network error")) };
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it("falls back to embedJpg when embedPng fails (JPEG bytes stored as .png)", async () => {
    // compressImage converts PNG→JPEG on upload, so bytes may be JPEG despite .png path
    mockPdfDoc.embedPng.mockRejectedValue(new Error("Not a PNG"));
    mockPdfDoc.embedJpg = vi.fn().mockResolvedValue(mockImage);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(mockPdfDoc.embedJpg).toHaveBeenCalled();
    expect(mockPage.drawImage).toHaveBeenCalled();
  });

  it("skips drawImage and draws dash when both embedPng and embedJpg fail", async () => {
    mockPdfDoc.embedPng.mockRejectedValue(new Error("Not a PNG"));
    mockPdfDoc.embedJpg = vi.fn().mockRejectedValue(new Error("Not a JPEG either"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(mockPage.drawImage).not.toHaveBeenCalled();
  });

  // ── Page overflow — additional pages added when needed ────────────────────

  it("adds additional pages when signature rows overflow", async () => {
    // Page so short that every ensureSpace call triggers a new page
    const tinyPage = makeMockPage(595, 100);
    const overflowPage = makeMockPage(595, 842);
    mockPdfDoc.getPages.mockReturnValue([tinyPage]);
    mockPdfDoc.addPage.mockReturnValue(overflowPage);

    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    // Multiple addPage calls: initial sig page + overflow pages
    expect(mockPdfDoc.addPage.mock.calls.length).toBeGreaterThan(1);
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 when PDFDocument.load throws", async () => {
    mockPDFDocumentLoad.mockReset();
    mockPDFDocumentLoad.mockRejectedValue(new Error("Invalid PDF"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 when embedFont throws", async () => {
    mockPdfDoc.embedFont.mockRejectedValue(new Error("Font embed failed"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 when pdfDoc.save() throws", async () => {
    mockPdfDoc.save.mockRejectedValue(new Error("Save failed"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("succeeds when petition has no targetAuthority and has submittedAt", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      targetAuthority: null,
      submittedAt: new Date("2026-03-28"),
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it("includes targetAuthority in meta line when present", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls.some((t) => t.includes("Municipal Corporation"))).toBe(true);
  });

  it("queries signatures ordered by signedAt asc with user name and unit", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { petitionId: "pet-1" },
        orderBy: { signedAt: "asc" },
        include: expect.objectContaining({
          user: expect.objectContaining({
            select: expect.objectContaining({ name: true }),
          }),
        }),
      }),
    );
  });

  it("renders row numbers starting from 1", async () => {
    await GET(makeGetRequest(), makeParams());
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls).toContain("1");
    expect(textCalls).toContain("2");
  });

  it("handles a single signatory and shows Total Signatures: 1", async () => {
    mockPrisma.petitionSignature.findMany.mockResolvedValue([mockSignatures[0]]);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      _count: { signatures: 1 },
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const textCalls = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    expect(textCalls.some((t) => t.includes("Total Signatures: 1"))).toBe(true);
  });

  it("truncates long signatory names that exceed the column width", async () => {
    // Simulate font returning wide measurements: anything longer than 3 chars is "too wide"
    // so the truncate while loop executes multiple iterations before exiting
    const narrowFont = {
      widthOfTextAtSize: vi.fn().mockImplementation((text: string) => (text.length > 3 ? 200 : 10)),
    };
    mockPdfDoc.embedFont.mockResolvedValue(narrowFont);

    const longNameSignature = [
      {
        ...mockSignatures[0],
        user: {
          name: "A Very Long Resident Name That Overflows",
          userUnits: [{ unit: { displayLabel: "A-101" } }],
        },
      },
    ];
    mockPrisma.petitionSignature.findMany.mockResolvedValue(longNameSignature);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetition,
      _count: { signatures: 1 },
    });

    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    // The truncated name should end with "…"
    const drawTextArgs = mockPage.drawText.mock.calls.map((c) => c[0] as string);
    const truncatedCall = drawTextArgs.find((t) => t.endsWith("…"));
    expect(truncatedCall).toBeDefined();
  });
});
