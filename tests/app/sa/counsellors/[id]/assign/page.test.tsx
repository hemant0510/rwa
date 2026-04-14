import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAvailable = vi.hoisted(() => vi.fn());
const mockAssignSocieties = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: "c-1" })));
const mockPapaParse = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/services/counsellors", () => ({
  listAvailableSocieties: mockListAvailable,
  assignSocieties: mockAssignSocieties,
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));
vi.mock("papaparse", () => ({
  default: { parse: mockPapaParse },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AssignSocietiesPage from "@/app/sa/counsellors/[id]/assign/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AssignSocietiesPage />
    </QueryClientProvider>,
  );
}

const sampleSocieties = [
  {
    id: "s-1",
    name: "Eden Park",
    societyCode: "EDEN",
    city: "Delhi",
    state: "DL",
    totalUnits: 200,
    plan: "STANDARD",
  },
  {
    id: "s-2",
    name: "Green Valley",
    societyCode: "GREEN",
    city: "Mumbai",
    state: "MH",
    totalUnits: 150,
    plan: "BASIC",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListAvailable.mockResolvedValue({ societies: sampleSocieties });
});

describe("AssignSocietiesPage", () => {
  it("renders header, search, and CSV upload UI", async () => {
    renderPage();
    expect(screen.getByText("Assign Societies")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name/)).toBeInTheDocument();
    expect(screen.getByText(/Bulk upload \(CSV\)/)).toBeInTheDocument();
  });

  it("clicking Choose CSV triggers hidden file input click", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByTestId("csv-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: /Choose CSV/ }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("shows skeleton while loading", () => {
    mockListAvailable.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("shows empty state when no available societies", async () => {
    mockListAvailable.mockResolvedValue({ societies: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No available societies")).toBeInTheDocument();
    });
  });

  it("shows error banner on query failure", async () => {
    mockListAvailable.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load societies/)).toBeInTheDocument();
    });
  });

  it("renders society rows with code/city/state/units/plan", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Eden Park")).toBeInTheDocument();
      expect(screen.getByText("Green Valley")).toBeInTheDocument();
      expect(screen.getByText(/EDEN.*Delhi.*DL.*200.*STANDARD/)).toBeInTheDocument();
    });
  });

  it("toggles selection of a single row and updates count", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is "select all", next two are rows
    await user.click(checkboxes[1]);
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();
  });

  it("toggles a row OFF when clicked again", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();
    await user.click(checkboxes[1]);
    expect(screen.getByText(/0 of 2 selected/)).toBeInTheDocument();
  });

  it("uses 'ies' plural in the success toast for >1 society", async () => {
    mockAssignSocieties.mockResolvedValue({ assigned: 2, reactivated: 0, alreadyActive: 0 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Select all"));
    await user.click(screen.getByRole("button", { name: /Assign 2 societies/ }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Assigned 2 societies"),
      );
    });
  });

  it("handles CSV row with empty first cell (uses ?? fallback)", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.complete({ data: [[undefined], ["EDEN"]] });
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    await user.upload(screen.getByTestId("csv-input") as HTMLInputElement, new File([], "x.csv"));
    await waitFor(() => expect(screen.getByText(/1 code loaded/)).toBeInTheDocument());
  });

  it("toggles all rows via select-all checkbox", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const selectAll = screen.getByLabelText("Select all");
    await user.click(selectAll);
    expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();
    await user.click(selectAll);
    expect(screen.getByText(/0 of 2 selected/)).toBeInTheDocument();
  });

  it("filters by search input", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/Search by name/), "delhi");
    await waitFor(() => {
      expect(mockListAvailable).toHaveBeenCalledWith("c-1", "delhi");
    });
  });

  it("disables Assign button when nothing selected", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Assign 0 societies/ })).toBeDisabled();
  });

  it("calls assignSocieties and shows success toast on success", async () => {
    mockAssignSocieties.mockResolvedValue({ assigned: 1, reactivated: 0, alreadyActive: 0 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: /Assign 1 society/ }));
    await waitFor(() => {
      expect(mockAssignSocieties).toHaveBeenCalledWith("c-1", { societyIds: ["s-1"] });
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/sa/counsellors/c-1");
    });
  });

  it("shows informational toast when all selected were already assigned", async () => {
    mockAssignSocieties.mockResolvedValue({ assigned: 0, reactivated: 0, alreadyActive: 1 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: /Assign/ }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("already assigned"));
    });
  });

  it("shows toast.error when assignSocieties fails", async () => {
    mockAssignSocieties.mockRejectedValue(new Error("forbidden"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: /Assign 1 society/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("forbidden");
    });
  });

  it("navigates back to detail page on Cancel", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPush).toHaveBeenCalledWith("/sa/counsellors/c-1");
  });

  it("parses CSV file and reports matched/unmatched counts", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.complete({ data: [["EDEN"], ["UNKNOWN"]] });
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());

    const file = new File(["EDEN\nUNKNOWN"], "codes.csv", { type: "text/csv" });
    const input = screen.getByTestId("csv-input") as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/2 codes loaded/)).toBeInTheDocument();
      expect(screen.getByText(/1 matched, 1 unmatched/)).toBeInTheDocument();
    });
  });

  it("skips header row 'society_code' when parsing CSV", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.complete({ data: [["society_code"], ["EDEN"]] });
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const file = new File(["society_code\nEDEN"], "codes.csv", { type: "text/csv" });
    await user.upload(screen.getByTestId("csv-input") as HTMLInputElement, file);
    await waitFor(() => {
      expect(screen.getByText(/1 code loaded/)).toBeInTheDocument();
    });
  });

  it("shows error toast when CSV parse fails", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.error?.();
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    const file = new File(["bad"], "codes.csv", { type: "text/csv" });
    await user.upload(screen.getByTestId("csv-input") as HTMLInputElement, file);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to parse CSV file");
    });
  });

  it("applies CSV selection when matched codes exist", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.complete({ data: [["EDEN"]] });
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    await user.upload(
      screen.getByTestId("csv-input") as HTMLInputElement,
      new File(["EDEN"], "x.csv"),
    );
    await waitFor(() => expect(screen.getByText(/1 code loaded/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Apply CSV selection/ }));
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("Pre-selected 1"));
  });

  it("shows error toast when applying CSV with no matches", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.complete({ data: [["UNKNOWN"]] });
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    await user.upload(
      screen.getByTestId("csv-input") as HTMLInputElement,
      new File(["UNKNOWN"], "x.csv"),
    );
    await waitFor(() => expect(screen.getByText(/1 code loaded/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Apply CSV selection/ }));
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("No matching societies"));
  });

  it("indicates unmatched codes in success message when some don't match", async () => {
    mockPapaParse.mockImplementation((_file, opts) => {
      opts.complete({ data: [["EDEN"], ["UNKNOWN"]] });
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Park")).toBeInTheDocument());
    await user.upload(screen.getByTestId("csv-input") as HTMLInputElement, new File([], "x.csv"));
    await waitFor(() => expect(screen.getByText(/2 codes loaded/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Apply CSV selection/ }));
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("did not match"));
  });
});
