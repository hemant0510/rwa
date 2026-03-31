import { NextRequest, NextResponse } from "next/server";

import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string; petitionId: string }> };

// ── Layout constants ──
const MARGIN = 40;
const BOTTOM_MARGIN = 56;
const HEADER_FONT_SIZE = 9;
const ROW_FONT_SIZE = 8;
const ROW_H_IMG = 52; // row height when signature image is present
const ROW_H_TEXT = 16; // row height when text-only (no image)
const TABLE_HEADER_H = 18;
const COL_NO_W = 24;
const COL_NAME_W = 130;
const COL_UNIT_W = 80;
const COL_DATE_W = 72;

type EmbeddedFont = Awaited<ReturnType<PDFDocument["embedFont"]>>;

function truncate(font: EmbeddedFont, text: string, maxWidth: number, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const [petition, society] = await Promise.all([
      prisma.petition.findUnique({
        where: { id: petitionId },
        select: {
          id: true,
          title: true,
          type: true,
          targetAuthority: true,
          submittedAt: true,
          documentUrl: true,
          societyId: true,
          _count: { select: { signatures: true } },
        },
      }),
      prisma.society.findUnique({
        where: { id: societyId },
        select: { name: true },
      }),
    ]);

    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");
    if (!society) return notFoundError("Society not found");

    if (!petition.documentUrl) {
      return NextResponse.json(
        { error: { code: "NO_DOCUMENT", message: "Petition has no uploaded document" } },
        { status: 400 },
      );
    }

    if (petition._count.signatures === 0) {
      return NextResponse.json(
        { error: { code: "NO_SIGNATURES", message: "Petition has no signatures" } },
        { status: 400 },
      );
    }

    const signatures = await prisma.petitionSignature.findMany({
      where: { petitionId },
      include: {
        user: {
          select: {
            name: true,
            userUnits: {
              select: { unit: { select: { displayLabel: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { signedAt: "asc" },
    });

    const supabase = createAdminClient();

    // Download original petition PDF
    const { data: originalPdfData, error: originalPdfError } = await supabase.storage
      .from("petition-docs")
      .download(petition.documentUrl);

    if (originalPdfError || !originalPdfData) {
      return internalError("Failed to fetch original petition document");
    }

    const originalPdfBytes = new Uint8Array(await originalPdfData.arrayBuffer());

    // Fetch signature images (fail gracefully per sig)
    const signatoriesWithImages = await Promise.all(
      signatures.map(async (sig) => {
        let imageBytes: Uint8Array | null = null;
        try {
          const { data: imgData } = await supabase.storage
            .from("petition-signatures")
            .download(sig.signatureUrl);
          if (imgData) {
            imageBytes = new Uint8Array(await imgData.arrayBuffer());
          }
        } catch {
          // fall through — imageBytes stays null
        }
        return {
          name: sig.user.name,
          unit: sig.user.userUnits[0]?.unit.displayLabel ?? "—",
          signedAt: sig.signedAt,
          imageBytes,
        };
      }),
    );

    // ── Build the signed document ──
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);
    const grey = rgb(0.42, 0.42, 0.42);
    const lightGrey = rgb(0.88, 0.88, 0.88);
    const altRow = rgb(0.97, 0.97, 0.97);
    const darkHeader = rgb(0.18, 0.18, 0.18);

    // Use the last page's dimensions for all signature pages
    const pages = pdfDoc.getPages();
    const { width: W, height: H } = pages[pages.length - 1].getSize();

    const sigColX = MARGIN + COL_NO_W + COL_NAME_W + COL_UNIT_W + COL_DATE_W;
    const sigColW = W - MARGIN - sigColX;

    // ── Always append a fresh dedicated page for signatures ──
    // (pdf-lib cannot detect where existing content ends, so drawing on the
    //  last page risks overlapping the original document's content)
    const state: { page: PDFPage; y: number } = {
      page: pdfDoc.addPage([W, H]),
      y: H - MARGIN,
    };

    function ensureSpace(neededH: number) {
      if (state.y - neededH < BOTTOM_MARGIN) {
        state.page = pdfDoc.addPage([W, H]);
        state.y = H - MARGIN;
      }
    }

    // ── Page header: petition info ──
    state.page.drawText(society.name, {
      x: MARGIN,
      y: state.y,
      font: fontBold,
      size: 13,
      color: black,
    });
    state.y -= 18;

    state.page.drawText(petition.title, {
      x: MARGIN,
      y: state.y,
      font: fontBold,
      size: 10,
      color: black,
    });
    state.y -= 14;

    const metaParts: string[] = [petition.type];
    if (petition.targetAuthority) metaParts.push(`To: ${petition.targetAuthority}`);
    if (petition.submittedAt) {
      metaParts.push(
        `Submitted: ${petition.submittedAt.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
      );
    }
    state.page.drawText(metaParts.join("   ·   "), {
      x: MARGIN,
      y: state.y,
      font,
      size: 8,
      color: grey,
    });
    state.y -= 12;

    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    state.page.drawText(`Generated: ${generatedAt}`, {
      x: MARGIN,
      y: state.y,
      font,
      size: 8,
      color: grey,
    });
    state.y -= 16;

    // Header separator
    state.page.drawLine({
      start: { x: MARGIN, y: state.y },
      end: { x: W - MARGIN, y: state.y },
      thickness: 1,
      color: lightGrey,
    });
    state.y -= 14;

    // Section label
    state.page.drawText("SIGNATURES", {
      x: MARGIN,
      y: state.y,
      font: fontBold,
      size: 9,
      color: grey,
    });
    state.y -= 10;

    // ── Table header row (dark background, white text) ──
    ensureSpace(TABLE_HEADER_H + 4);
    state.page.drawRectangle({
      x: MARGIN,
      y: state.y - TABLE_HEADER_H,
      width: W - 2 * MARGIN,
      height: TABLE_HEADER_H,
      color: darkHeader,
    });
    const headerTextY = state.y - TABLE_HEADER_H + (TABLE_HEADER_H - HEADER_FONT_SIZE) / 2;
    state.page.drawText("#", {
      x: MARGIN + 4,
      y: headerTextY,
      font: fontBold,
      size: HEADER_FONT_SIZE,
      color: white,
    });
    state.page.drawText("NAME", {
      x: MARGIN + COL_NO_W + 4,
      y: headerTextY,
      font: fontBold,
      size: HEADER_FONT_SIZE,
      color: white,
    });
    state.page.drawText("UNIT", {
      x: MARGIN + COL_NO_W + COL_NAME_W + 4,
      y: headerTextY,
      font: fontBold,
      size: HEADER_FONT_SIZE,
      color: white,
    });
    state.page.drawText("DATE SIGNED", {
      x: MARGIN + COL_NO_W + COL_NAME_W + COL_UNIT_W + 4,
      y: headerTextY,
      font: fontBold,
      size: HEADER_FONT_SIZE,
      color: white,
    });
    state.page.drawText("SIGNATURE", {
      x: sigColX + 4,
      y: headerTextY,
      font: fontBold,
      size: HEADER_FONT_SIZE,
      color: white,
    });
    state.y -= TABLE_HEADER_H + 2;

    // ── Signature rows ──
    for (let i = 0; i < signatoriesWithImages.length; i++) {
      const sig = signatoriesWithImages[i];

      // Embed signature image — try PNG first, fall back to JPEG
      // (compressImage on the client converts PNGs to JPEG, so stored bytes may be JPEG
      //  even though the path ends in .png and the content-type says image/png)
      let pdfImg: PDFImage | null = null;
      if (sig.imageBytes) {
        try {
          pdfImg = await pdfDoc.embedPng(sig.imageBytes);
        } catch {
          try {
            pdfImg = await pdfDoc.embedJpg(sig.imageBytes);
          } catch {
            // not a recognized image format — skip
          }
        }
      }

      const rowH = pdfImg ? ROW_H_IMG : ROW_H_TEXT + 4;
      ensureSpace(rowH);

      const rowTopY = state.y;
      const textY = rowTopY - ROW_FONT_SIZE - 4;

      // Alternate row background
      if (i % 2 === 1) {
        state.page.drawRectangle({
          x: MARGIN,
          y: rowTopY - rowH,
          width: W - 2 * MARGIN,
          height: rowH,
          color: altRow,
        });
      }

      // Row bottom border
      state.page.drawLine({
        start: { x: MARGIN, y: rowTopY - rowH },
        end: { x: W - MARGIN, y: rowTopY - rowH },
        thickness: 0.3,
        color: lightGrey,
      });

      // Vertical column dividers
      const dividers = [
        MARGIN + COL_NO_W,
        MARGIN + COL_NO_W + COL_NAME_W,
        MARGIN + COL_NO_W + COL_NAME_W + COL_UNIT_W,
        MARGIN + COL_NO_W + COL_NAME_W + COL_UNIT_W + COL_DATE_W,
      ];
      for (const x of dividers) {
        state.page.drawLine({
          start: { x, y: rowTopY },
          end: { x, y: rowTopY - rowH },
          thickness: 0.3,
          color: lightGrey,
        });
      }

      // Text cells
      state.page.drawText(String(i + 1), {
        x: MARGIN + 4,
        y: textY,
        font,
        size: ROW_FONT_SIZE,
        color: black,
      });

      state.page.drawText(truncate(font, sig.name, COL_NAME_W - 8, ROW_FONT_SIZE), {
        x: MARGIN + COL_NO_W + 4,
        y: textY,
        font,
        size: ROW_FONT_SIZE,
        color: black,
      });

      state.page.drawText(truncate(font, sig.unit, COL_UNIT_W - 8, ROW_FONT_SIZE), {
        x: MARGIN + COL_NO_W + COL_NAME_W + 4,
        y: textY,
        font,
        size: ROW_FONT_SIZE,
        color: black,
      });

      const dateText = sig.signedAt.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      state.page.drawText(dateText, {
        x: MARGIN + COL_NO_W + COL_NAME_W + COL_UNIT_W + 4,
        y: textY,
        font,
        size: ROW_FONT_SIZE,
        color: black,
      });

      // Signature image or dash
      if (pdfImg) {
        const maxImgW = sigColW - 8;
        const maxImgH = rowH - 8;
        const dims = pdfImg.scale(1);
        const scale = Math.min(maxImgW / dims.width, maxImgH / dims.height, 1);
        const scaled = pdfImg.scale(scale);
        state.page.drawImage(pdfImg, {
          x: sigColX + 4,
          y: rowTopY - rowH + (rowH - scaled.height) / 2,
          width: scaled.width,
          height: scaled.height,
        });
      } else {
        state.page.drawText("—", {
          x: sigColX + 4,
          y: textY,
          font,
          size: ROW_FONT_SIZE,
          color: grey,
        });
      }

      state.y -= rowH;
    }

    // ── Total count ──
    ensureSpace(24);
    state.y -= 8;
    state.page.drawLine({
      start: { x: MARGIN, y: state.y },
      end: { x: W - MARGIN, y: state.y },
      thickness: 0.5,
      color: lightGrey,
    });
    state.y -= 14;
    state.page.drawText(`Total Signatures: ${signatoriesWithImages.length}`, {
      x: MARGIN,
      y: state.y,
      font: fontBold,
      size: ROW_FONT_SIZE + 1,
      color: black,
    });

    const mergedBytes = await pdfDoc.save();
    const safeTitle = petition.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    return new NextResponse(Buffer.from(mergedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signed-doc-${safeTitle}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate signed document");
  }
}
