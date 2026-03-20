import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuthContext } from "@/hooks/useAuth";

const { mockDownloadMigrationTemplate, mockValidateMigrationFile, mockImportMigrationRecords } =
  vi.hoisted(() => ({
    mockDownloadMigrationTemplate: vi.fn(),
    mockValidateMigrationFile: vi.fn(),
    mockImportMigrationRecords: vi.fn(),
  }));

vi.mock("@/services/migration", () => ({
  downloadMigrationTemplate: (...args: unknown[]) => mockDownloadMigrationTemplate(...args),
  validateMigrationFile: (...args: unknown[]) => mockValidateMigrationFile(...args),
  importMigrationRecords: (...args: unknown[]) => mockImportMigrationRecords(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/migration",
}));

import MigrationPage from "@/app/admin/migration/page";

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: "admin-1",
    name: "Admin",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS",
    societyId: "soc-1",
    societyName: "Eden Estate",
    societyCode: "EDEN",
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

const MOCK_IMPORT_RESULT = {
  results: [
    { rowIndex: 0, success: true, rwaid: "RWA-1" },
    { rowIndex: 1, success: true, rwaid: "RWA-2" },
  ],
  summary: { total: 2, imported: 2, failed: 0 },
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

  it("calls importMigrationRecords and shows done step", async () => {
    mockValidateMigrationFile.mockResolvedValue(MOCK_VALIDATE_RESULT);
    mockImportMigrationRecords.mockResolvedValue(MOCK_IMPORT_RESULT);
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
    mockImportMigrationRecords.mockResolvedValue(MOCK_IMPORT_RESULT);
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
});
