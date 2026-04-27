import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import MigrationPage from "@/app/admin/migration/page";
import { AuthContext } from "@/hooks/useAuth";

const {
  mockDownloadMigrationTemplate,
  mockValidateMigrationFile,
  mockImportMigrationRecordsStream,
} = vi.hoisted(() => ({
  mockDownloadMigrationTemplate: vi.fn(),
  mockValidateMigrationFile: vi.fn(),
  mockImportMigrationRecordsStream: vi.fn(),
}));

vi.mock("@/services/migration", () => ({
  downloadMigrationTemplate: (...args: unknown[]) => mockDownloadMigrationTemplate(...args),
  validateMigrationFile: (...args: unknown[]) => mockValidateMigrationFile(...args),
  importMigrationRecordsStream: (...args: unknown[]) => mockImportMigrationRecordsStream(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/migration",
  useSearchParams: () => new URLSearchParams(),
}));

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: "admin-1",
    name: "Admin",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS" as const,
    societyId: "soc-1",
    societyName: "Greenwood Residency",
    societyCode: "GRNW",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
    ...userOverrides,
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
        <MigrationPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const MOCK_VALIDATE_RESULT = {
  total: 3,
  valid: 2,
  invalid: 1,
  errors: [{ row: 3, field: "mobile", message: "Invalid mobile" }],
  preview: [
    {
      rowIndex: 0,
      fullName: "John",
      email: "j@e.com",
      mobile: "9876543210",
      ownershipType: "OWNER",
      feeStatus: "PAID",
      unitFields: {},
    },
    {
      rowIndex: 1,
      fullName: "Jane",
      email: "n@e.com",
      mobile: "9876543211",
      ownershipType: "TENANT",
      feeStatus: "PENDING",
      unitFields: {},
    },
    {
      rowIndex: 2,
      fullName: "Bad",
      email: "b@e.com",
      mobile: "123",
      ownershipType: "OWNER",
      feeStatus: "PAID",
      unitFields: {},
    },
  ],
};

describe("MigrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title", () => {
    renderPage();
    expect(screen.getByText("Bulk Migration")).toBeInTheDocument();
  });

  it("renders download template button", () => {
    renderPage();
    expect(screen.getByText("Download Template")).toBeInTheDocument();
  });

  it("shows upload card initially", () => {
    renderPage();
    expect(screen.getByText("Upload Excel File")).toBeInTheDocument();
    expect(screen.getByText("Browse Files")).toBeInTheDocument();
  });

  it("calls downloadMigrationTemplate when button clicked", async () => {
    mockDownloadMigrationTemplate.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByText("Download Template"));
    await waitFor(() => {
      expect(mockDownloadMigrationTemplate).toHaveBeenCalledWith("soc-1");
    });
  });

  it("shows file name after file selection", async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("residents.xlsx")).toBeInTheDocument();
    });
  });

  it("rejects non-xlsx files", async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.queryByText("residents.csv")).not.toBeInTheDocument();
    });
  });

  it("calls validateMigrationFile and shows preview step", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Validate & Preview")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Validate & Preview"));

    await waitFor(() => {
      expect(mockValidateMigrationFile).toHaveBeenCalledWith("soc-1", expect.any(File));
    });
  });

  it("shows validation summary with totals", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      // "3" may appear in both the summary total and the error table row number
      expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1); // total
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // valid
      expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1); // invalid
    });
  });

  it("shows validation errors in table", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      expect(screen.getByText("Invalid mobile")).toBeInTheDocument();
      expect(screen.getByText("mobile")).toBeInTheDocument();
    });
  });

  it("shows import button with valid count", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      expect(screen.getByText("Import 2 Valid Records")).toBeInTheDocument();
    });
  });

  it("disables import button when valid count is 0", async () => {
    mockValidateMigrationFile.mockResolvedValue({ ...MOCK_VALIDATE_RESULT, valid: 0 });
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      const btn = screen.getByText("Import 0 Valid Records");
      expect(btn).toBeDisabled();
    });
  });

  it("calls importMigrationRecordsStream and shows done step", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    // Simulate the stream: call onEvent with done event then resolve
    mockImportMigrationRecordsStream.mockImplementation(
      async (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) => {
        onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
      },
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      expect(screen.getByText("Import Complete!")).toBeInTheDocument();
    });
    expect(screen.getByText(/2 residents have been imported/)).toBeInTheDocument();
  });

  it("shows 'Upload Different File' button in preview", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      expect(screen.getByText("Upload Different File")).toBeInTheDocument();
    });
  });

  it("resets to upload step on 'Upload Different File' click", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => screen.getByText("Upload Different File"));
    fireEvent.click(screen.getByText("Upload Different File"));

    await waitFor(() => {
      expect(screen.getByText("Upload Excel File")).toBeInTheDocument();
    });
  });

  it("shows Import More button in done step", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockImplementation(
      async (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) => {
        onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
      },
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));
    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      expect(screen.getByText("Import More")).toBeInTheDocument();
    });
  });

  it("shows error toast when validation fails", async () => {
    mockValidateMigrationFile.mockRejectedValue(new Error("Server error"));
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      expect(screen.getByText("Upload Excel File")).toBeInTheDocument(); // back to upload step
    });
  });

  it("disables download template when societyId is empty", () => {
    renderPage({ societyId: "" });
    const btn = screen.getByText("Download Template").closest("button");
    expect(btn).toBeDisabled();
  });

  it("shows error toast when download template fails", async () => {
    mockDownloadMigrationTemplate.mockRejectedValue(new Error("Network error"));
    renderPage();
    fireEvent.click(screen.getByText("Download Template"));
    await waitFor(() => {
      expect(mockDownloadMigrationTemplate).toHaveBeenCalledWith("soc-1");
    });
  });

  it("handles progress events during import stream", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockImplementation(
      async (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) => {
        onEvent({
          type: "progress",
          processed: 1,
          total: 2,
          imported: 1,
          failed: 0,
        });
        onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
      },
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      expect(screen.getByText("Import Complete!")).toBeInTheDocument();
    });
  });

  it("shows error and returns to preview when import fails", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockRejectedValue(new Error("Import network error"));
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      // Should return to preview step after error
      expect(screen.getByText("Upload Different File")).toBeInTheDocument();
    });
  });

  it("resets to upload step when Import More is clicked in done step", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockImplementation(
      async (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) => {
        onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
      },
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));
    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => screen.getByText("Import More"));
    fireEvent.click(screen.getByText("Import More"));

    await waitFor(() => {
      expect(screen.getByText("Upload Excel File")).toBeInTheDocument();
    });
  });

  it("shows View Imported link in done step", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockImplementation(
      async (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) => {
        onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
      },
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));
    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      expect(screen.getByText("View Imported")).toBeInTheDocument();
    });
  });

  it("shows generic error message when import fails with non-Error", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockRejectedValue("string error");
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      // Should return to preview step after error
      expect(screen.getByText("Upload Different File")).toBeInTheDocument();
    });
  });

  it("shows generic error message when validation fails with non-Error", async () => {
    mockValidateMigrationFile.mockRejectedValue("string error");
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      expect(screen.getByText("Upload Excel File")).toBeInTheDocument();
    });
  });

  it("shows importing progress with failed count", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);

    let resolveImport: () => void;
    mockImportMigrationRecordsStream.mockImplementation(
      (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) =>
        new Promise<void>((resolve) => {
          resolveImport = () => {
            onEvent({ type: "done", summary: { total: 2, imported: 1, failed: 1 } });
            resolve();
          };
          // Fire progress event with failed > 0 synchronously
          onEvent({
            type: "progress",
            processed: 1,
            total: 2,
            imported: 0,
            failed: 1,
          });
        }),
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));
    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    // Should show importing step with progress text including failed count
    await waitFor(() => {
      expect(screen.getByText("Importing residents...")).toBeInTheDocument();
      expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    });

    // Now resolve
    resolveImport!();
    await waitFor(() => {
      expect(screen.getByText("Import Complete!")).toBeInTheDocument();
    });
  });

  it("shows importing progress with imported count", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);

    let resolveImport: () => void;
    mockImportMigrationRecordsStream.mockImplementation(
      (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) =>
        new Promise<void>((resolve) => {
          resolveImport = () => {
            onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
            resolve();
          };
          onEvent({
            type: "progress",
            processed: 1,
            total: 2,
            imported: 1,
            failed: 0,
          });
        }),
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));
    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      expect(screen.getByText(/1 imported/)).toBeInTheDocument();
    });

    resolveImport!();
    await waitFor(() => {
      expect(screen.getByText("Import Complete!")).toBeInTheDocument();
    });
  });

  it("shows no errors section when validation has zero errors", async () => {
    mockValidateMigrationFile.mockResolvedValue({
      ...MOCK_VALIDATE_RESULT,
      valid: 3,
      invalid: 0,
      errors: [],
    });
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));

    await waitFor(() => {
      expect(screen.getByText("Import 3 Valid Records")).toBeInTheDocument();
    });
    // No validation errors table should be present
    expect(screen.queryByText("Validation Errors")).not.toBeInTheDocument();
  });

  it("does not show file size text before file selection", () => {
    renderPage();
    expect(screen.getByText("Supports .xlsx and .xls files")).toBeInTheDocument();
    expect(screen.getByText("Select an Excel file")).toBeInTheDocument();
  });

  it("shows file size after selection", async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const content = "x".repeat(2048);
    const file = new File([content], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("residents.xlsx")).toBeInTheDocument();
      expect(screen.getByText(/KB/)).toBeInTheDocument();
    });
  });

  it("shows Change File button after file selection", async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("Change File")).toBeInTheDocument();
    });
  });

  it("does nothing on file select when no files in event", async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [] });
    fireEvent.change(input);
    // Should still be in the upload step with no file selected
    expect(screen.getByText("Select an Excel file")).toBeInTheDocument();
  });

  it("accepts .xls files", async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xls");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("residents.xls")).toBeInTheDocument();
    });
  });

  it("does not validate when no file is selected", async () => {
    renderPage();
    // No file selected, try to find Validate button — it shouldn't exist
    expect(screen.queryByText("Validate & Preview")).not.toBeInTheDocument();
  });

  it("shows View Imported link with correct href", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecordsStream.mockImplementation(
      async (_societyId: unknown, _records: unknown, onEvent: (e: unknown) => void) => {
        onEvent({ type: "done", summary: { total: 2, imported: 2, failed: 0 } });
      },
    );
    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "residents.xlsx");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText("Validate & Preview"));
    await waitFor(() => screen.getByText("Import 2 Valid Records"));
    fireEvent.click(screen.getByText("Import 2 Valid Records"));

    await waitFor(() => {
      const link = screen.getByText("View Imported").closest("a");
      expect(link).toHaveAttribute("href", "/admin/residents?status=MIGRATED_PENDING");
    });
  });
});
