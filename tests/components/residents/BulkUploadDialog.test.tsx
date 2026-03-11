import React from "react";

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they can be referenced in vi.mock factories
const { mockPapaParse, mockBulkUpload } = vi.hoisted(() => ({
  mockPapaParse: {
    parse: vi.fn(),
    unparse: vi.fn((rows: Record<string, unknown>[]) =>
      [Object.keys(rows[0] ?? {}).join(",")]
        .concat(rows.map((r) => Object.values(r).join(",")))
        .join("\n"),
    ),
  },
  mockBulkUpload: vi.fn(),
}));

vi.mock("papaparse", () => ({ default: mockPapaParse }));
vi.mock("xlsx", () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn(() => []) },
}));
vi.mock("@/services/residents", () => ({
  bulkUploadResidents: (...args: unknown[]) => mockBulkUpload(...args),
}));

global.URL.createObjectURL = vi.fn(() => "blob:mock");
global.URL.revokeObjectURL = vi.fn();

// Suppress DialogContent aria warning in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("aria-describedby")) return;
    originalConsoleError(...args);
  };
});

import { BulkUploadDialog } from "@/components/residents/BulkUploadDialog";

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  societyCode: "EDEN",
  onSuccess: vi.fn(),
};

const validRow: Record<string, string> = {
  "Full Name": "John Doe",
  Email: "john@example.com",
  Mobile: "9876543210",
  "Ownership Type": "OWNER",
  "Flat/Unit Number": "A-101",
  "Block/Tower": "A",
  "Floor Level": "FIRST",
  "Registration Year": "2026",
};

/** Trigger Papa.parse to call back with the given rows */
function setParsedRows(rows: Record<string, string>[]) {
  mockPapaParse.parse.mockImplementationOnce(
    (_file: File, opts: { complete: (r: { data: Record<string, string>[] }) => void }) => {
      opts.complete({ data: rows });
    },
  );
}

/** Render the dialog, upload a CSV file, and wait for the validate step */
async function uploadAndValidate(
  rows: Record<string, string>[],
  props: Partial<typeof defaultProps> = {},
) {
  setParsedRows(rows);
  const utils = render(<BulkUploadDialog {...defaultProps} {...props} />);
  // Radix UI Dialog renders via portal to document.body, outside the render container
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["content"], "test.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(/Total rows/i)).toBeInTheDocument());
  return utils;
}

describe("BulkUploadDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Step 1: Upload UI ──────────────────────────────────────────────────────

  describe("Step 1: Upload UI", () => {
    it("renders drop zone with correct text", () => {
      render(<BulkUploadDialog {...defaultProps} />);
      expect(screen.getByText(/Drop your file here or click to browse/i)).toBeInTheDocument();
    });

    it("renders sample template download link", () => {
      render(<BulkUploadDialog {...defaultProps} />);
      const link = screen.getByRole("link", { name: /Download sample template/i });
      expect(link).toHaveAttribute("href", "/templates/residents-import-template.csv");
    });

    it("renders Cancel button", () => {
      render(<BulkUploadDialog {...defaultProps} />);
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("calls onOpenChange(false) when Cancel is clicked", () => {
      const onOpenChange = vi.fn();
      render(<BulkUploadDialog {...defaultProps} onOpenChange={onOpenChange} />);
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("has a hidden file input accepting csv/xlsx/xls", () => {
      render(<BulkUploadDialog {...defaultProps} />);
      // Radix UI Dialog renders via portal to document.body
      const input = document.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      expect(input).toHaveAttribute("accept", ".csv,.xlsx,.xls");
    });
  });

  // ── Step 2: Validation results ─────────────────────────────────────────────

  describe("Step 2: Validation results", () => {
    it("shows validation step after CSV is parsed", async () => {
      await uploadAndValidate([validRow]);
      expect(screen.getByText(/Total rows/i)).toBeInTheDocument();
    });

    it("shows 1 valid and 0 invalid for a valid row", async () => {
      await uploadAndValidate([validRow]);
      expect(screen.getByText(/Proceed with 1/i)).toBeInTheDocument();
      // Summary shows 0 in the invalid count block
      expect(screen.queryByText(/Download invalid records/i)).not.toBeInTheDocument();
    });

    it("marks row invalid when Full Name is too short", async () => {
      await uploadAndValidate([{ ...validRow, "Full Name": "J" }]);
      expect(screen.getByText(/Full Name is required/i)).toBeInTheDocument();
    });

    it("marks row invalid when email is malformed", async () => {
      await uploadAndValidate([{ ...validRow, Email: "not-an-email" }]);
      expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
    });

    it("marks row invalid when mobile is not 10 digits starting 6-9", async () => {
      await uploadAndValidate([{ ...validRow, Mobile: "12345" }]);
      expect(screen.getByText(/10-digit Indian number/i)).toBeInTheDocument();
    });

    it("marks row invalid when Ownership Type is not OWNER or TENANT", async () => {
      await uploadAndValidate([{ ...validRow, "Ownership Type": "PARTNER" }]);
      expect(screen.getByText(/Ownership Type must be OWNER or TENANT/i)).toBeInTheDocument();
    });

    it("marks row invalid when Registration Year is out of range", async () => {
      await uploadAndValidate([{ ...validRow, "Registration Year": "1990" }]);
      expect(screen.getByText(/Registration Year must be between/i)).toBeInTheDocument();
    });

    it("accepts blank Registration Year as valid", async () => {
      await uploadAndValidate([{ ...validRow, "Registration Year": "" }]);
      expect(screen.queryByText(/Registration Year must be between/i)).not.toBeInTheDocument();
    });

    it("shows 'Download invalid records' button when invalid rows exist", async () => {
      await uploadAndValidate([{ ...validRow, "Full Name": "J" }]);
      expect(screen.getByRole("button", { name: /Download invalid records/i })).toBeInTheDocument();
    });

    it("disables Proceed button when all rows are invalid", async () => {
      await uploadAndValidate([{ ...validRow, "Full Name": "J" }]);
      expect(screen.getByRole("button", { name: /Proceed with/i })).toBeDisabled();
    });

    it("enables Proceed button when valid rows exist", async () => {
      await uploadAndValidate([validRow]);
      expect(screen.getByRole("button", { name: /Proceed with 1/i })).not.toBeDisabled();
    });

    it("shows 'Change file' button to reset back to upload", async () => {
      await uploadAndValidate([validRow]);
      expect(screen.getByRole("button", { name: /Change file/i })).toBeInTheDocument();
    });

    it("shows 'no valid records' message when all rows are invalid", async () => {
      await uploadAndValidate([{ ...validRow, "Full Name": "J" }]);
      expect(screen.getByText(/No valid records to import/i)).toBeInTheDocument();
    });

    it("resets to upload step when 'Change file' is clicked", async () => {
      await uploadAndValidate([validRow]);
      fireEvent.click(screen.getByRole("button", { name: /Change file/i }));
      expect(screen.getByText(/Drop your file here/i)).toBeInTheDocument();
    });
  });

  // ── Step 3: Processing & Results ───────────────────────────────────────────

  describe("Step 3: Processing and results", () => {
    it("calls bulkUploadResidents when Proceed is clicked", async () => {
      mockBulkUpload.mockResolvedValue({
        results: [{ rowIndex: 0, success: true, rwaid: "RWA-001" }],
      });
      await uploadAndValidate([validRow]);
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => expect(mockBulkUpload).toHaveBeenCalledTimes(1));
    });

    it("calls bulkUploadResidents with correct societyCode", async () => {
      mockBulkUpload.mockResolvedValue({ results: [{ rowIndex: 0, success: true, rwaid: "R-1" }] });
      await uploadAndValidate([validRow]);
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => expect(mockBulkUpload).toHaveBeenCalledWith("EDEN", expect.any(Array)));
    });

    it("shows success count on done step", async () => {
      mockBulkUpload.mockResolvedValue({
        results: [{ rowIndex: 0, success: true, rwaid: "RWA-001" }],
      });
      await uploadAndValidate([validRow]);
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => screen.getByText("Residents added"));
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("calls onSuccess when at least one record is added", async () => {
      mockBulkUpload.mockResolvedValue({
        results: [{ rowIndex: 0, success: true, rwaid: "RWA-001" }],
      });
      const onSuccess = vi.fn();
      await uploadAndValidate([validRow], { onSuccess });
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    });

    it("does not call onSuccess when all records fail", async () => {
      mockBulkUpload.mockResolvedValue({
        results: [{ rowIndex: 0, success: false, error: "Duplicate email" }],
      });
      const onSuccess = vi.fn();
      await uploadAndValidate([validRow], { onSuccess });
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => screen.getByText("Failed"));
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("shows failed records and download button when records fail", async () => {
      mockBulkUpload.mockResolvedValue({
        results: [{ rowIndex: 0, success: false, error: "Duplicate email" }],
      });
      await uploadAndValidate([validRow]);
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => screen.getByText("Failed"));
      expect(screen.getByRole("button", { name: /Download failed records/i })).toBeInTheDocument();
    });

    it("shows Close button on done step", async () => {
      mockBulkUpload.mockResolvedValue({
        results: [{ rowIndex: 0, success: true, rwaid: "RWA-001" }],
      });
      await uploadAndValidate([validRow]);
      fireEvent.click(screen.getByRole("button", { name: /Proceed with 1/i }));
      await waitFor(() => screen.getByRole("button", { name: /^Close$/i }));
    });

    it("resets dialog to upload step on close and reopen", () => {
      const { rerender } = render(<BulkUploadDialog {...defaultProps} />);
      rerender(<BulkUploadDialog {...defaultProps} open={false} />);
      rerender(<BulkUploadDialog {...defaultProps} open={true} />);
      expect(screen.getByText(/Drop your file here/i)).toBeInTheDocument();
    });
  });
});
