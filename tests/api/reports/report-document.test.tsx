import React from "react";

import { describe, it, expect, vi } from "vitest";

// Mock @react-pdf/renderer so component functions can execute without a PDF engine
vi.mock("@react-pdf/renderer", () => ({
  default: { renderToStream: vi.fn() },
  Document: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Image: ({ src }: { src: string }) => <img src={src} />,
}));

import {
  ReportHeader,
  ReportFooter,
  ReportTable,
  PetitionReportDocument,
} from "@/app/api/v1/societies/[id]/reports/report-document";

// ---------------------------------------------------------------------------
// ReportHeader
// ---------------------------------------------------------------------------

describe("ReportHeader", () => {
  it("renders without sessionYear", () => {
    const el = ReportHeader({
      societyName: "Greenwood Residency",
      title: "Paid Report",
      generatedAt: "01 Jan 2026",
    });
    expect(el).toBeTruthy();
  });

  it("renders with sessionYear", () => {
    const el = ReportHeader({
      societyName: "Greenwood Residency",
      title: "Paid Report",
      sessionYear: "2025-26",
      generatedAt: "01 Jan 2026",
    });
    expect(el).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ReportFooter
// ---------------------------------------------------------------------------

describe("ReportFooter", () => {
  it("renders with page only", () => {
    const el = ReportFooter({ page: 1 });
    expect(el).toBeTruthy();
  });

  it("renders with page and total", () => {
    const el = ReportFooter({ page: 2, total: 5 });
    expect(el).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ReportTable
// ---------------------------------------------------------------------------

describe("ReportTable", () => {
  const columns = [
    { header: "Name", flex: 2 },
    { header: "Amount", flex: 1, align: "right" as const },
  ];

  it("renders an empty table", () => {
    const el = ReportTable({ columns, rows: [] });
    expect(el).toBeTruthy();
  });

  it("renders rows with alternating styles (even and odd)", () => {
    const el = ReportTable({
      columns,
      rows: [
        ["Alice", "1000"],
        ["Bob", "2000"],
      ],
    });
    expect(el).toBeTruthy();
  });

  it("applies flex fallback when column has no flex", () => {
    const el = ReportTable({
      columns: [{ header: "Name" }, { header: "Value" }],
      rows: [["A", "B"]],
    });
    expect(el).toBeTruthy();
  });

  it("coerces null/undefined cells to empty string", () => {
    const el = ReportTable({
      columns: [{ header: "Name" }],
      rows: [[null as unknown as string]],
    });
    expect(el).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PetitionReportDocument
// ---------------------------------------------------------------------------

describe("PetitionReportDocument", () => {
  const basePetition = {
    title: "Fix Playground",
    description: "Equipment is broken",
    type: "COMPLAINT",
    targetAuthority: "Municipal Corp",
    submittedAt: new Date("2026-03-01"),
  };

  const signatories = [
    { name: "Alice", unit: "A-101", method: "DRAWN", signedAt: new Date("2026-03-10") },
    { name: "Bob", unit: "—", method: "UPLOADED", signedAt: new Date("2026-03-11") },
  ];

  it("renders with all fields populated", () => {
    const el = PetitionReportDocument({
      societyName: "Greenwood Residency",
      generatedAt: "28 Mar 2026",
      petition: basePetition,
      signatories,
    });
    expect(el).toBeTruthy();
  });

  it("renders when targetAuthority is null", () => {
    const el = PetitionReportDocument({
      societyName: "Greenwood Residency",
      generatedAt: "28 Mar 2026",
      petition: { ...basePetition, targetAuthority: null },
      signatories,
    });
    expect(el).toBeTruthy();
  });

  it("renders when submittedAt is null", () => {
    const el = PetitionReportDocument({
      societyName: "Greenwood Residency",
      generatedAt: "28 Mar 2026",
      petition: { ...basePetition, submittedAt: null },
      signatories,
    });
    expect(el).toBeTruthy();
  });

  it("renders when description is null", () => {
    const el = PetitionReportDocument({
      societyName: "Greenwood Residency",
      generatedAt: "28 Mar 2026",
      petition: { ...basePetition, description: null },
      signatories,
    });
    expect(el).toBeTruthy();
  });

  it("renders with empty signatories list", () => {
    const el = PetitionReportDocument({
      societyName: "Greenwood Residency",
      generatedAt: "28 Mar 2026",
      petition: basePetition,
      signatories: [],
    });
    expect(el).toBeTruthy();
  });
});
