import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetVehicles, mockDeleteVehicle, mockGetFamilyMembers, mockFetch } = vi.hoisted(() => ({
  mockGetVehicles: vi.fn(),
  mockDeleteVehicle: vi.fn(),
  mockGetFamilyMembers: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/services/vehicles", () => ({
  getVehicles: mockGetVehicles,
  deleteVehicle: mockDeleteVehicle,
}));

vi.mock("@/services/family", () => ({
  getFamilyMembers: mockGetFamilyMembers,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/features/vehicles/VehicleDialog", () => ({
  VehicleDialog: ({ open, onSaved }: { open: boolean; onSaved: () => void }) =>
    open ? (
      <div data-testid="vehicle-dialog">
        <button onClick={onSaved}>trigger-saved</button>
      </div>
    ) : null,
}));

import ResidentVehiclesPage from "@/app/r/profile/vehicles/page";
import type { Vehicle } from "@/services/vehicles";

const baseVehicle: Vehicle = {
  id: "v-1",
  unitId: "11111111-1111-4111-8111-111111111111",
  societyId: "soc-1",
  vehicleType: "FOUR_WHEELER",
  registrationNumber: "DL3CAB1234",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  parkingSlot: "B-12",
  fastagId: null,
  notes: null,
  ownerId: "u-1",
  dependentOwnerId: null,
  vehiclePhotoUrl: null,
  rcDocUrl: null,
  rcDocSignedUrl: null,
  rcExpiry: "2027-01-15",
  rcStatus: "VALID",
  insuranceUrl: null,
  insuranceSignedUrl: null,
  insuranceExpiry: "2026-05-01",
  insuranceStatus: "EXPIRING_SOON",
  pucExpiry: null,
  pucStatus: "NOT_SET",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  owner: { name: "Hemant" },
  dependentOwner: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResidentVehiclesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ units: [{ id: "u1", displayLabel: "A-101" }] }),
  });
  mockGetVehicles.mockResolvedValue({
    vehicles: [baseVehicle],
    total: 1,
    page: 1,
    limit: 10,
  });
  mockGetFamilyMembers.mockResolvedValue([]);
  mockDeleteVehicle.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ResidentVehiclesPage", () => {
  it("renders loading skeleton then the vehicle grid", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /back to profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add vehicle/i })).toBeInTheDocument();
  });

  it("shows error state and retries when Try again clicked", async () => {
    mockGetVehicles.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/unable to load vehicles/i)).toBeInTheDocument();
    });
    mockGetVehicles.mockResolvedValueOnce({
      vehicles: [baseVehicle],
      total: 1,
      page: 1,
      limit: 10,
    });
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
  });

  it("renders empty state and opens dialog when Register first vehicle clicked", async () => {
    mockGetVehicles.mockResolvedValueOnce({
      vehicles: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no vehicles registered/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /register your first vehicle/i }));
    expect(screen.getByTestId("vehicle-dialog")).toBeInTheDocument();
  });

  it("opens dialog when top Add Vehicle clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    expect(screen.getByTestId("vehicle-dialog")).toBeInTheDocument();
  });

  it("opens edit dialog when card edit button clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/edit vehicle DL3CAB1234/i));
    expect(screen.getByTestId("vehicle-dialog")).toBeInTheDocument();
  });

  it("opens deactivate confirmation and deactivates the vehicle", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/deactivate vehicle DL3CAB1234/i));
    expect(screen.getByText(/deactivate vehicle\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^deactivate$/i }));
    await waitFor(() => {
      expect(mockDeleteVehicle).toHaveBeenCalledWith("v-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Vehicle deactivated");
  });

  it("cancels deactivate confirmation without calling delete", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/deactivate vehicle DL3CAB1234/i));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockDeleteVehicle).not.toHaveBeenCalled();
  });

  it("surfaces deactivate error toast", async () => {
    mockDeleteVehicle.mockRejectedValueOnce(new Error("Nope"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/deactivate vehicle DL3CAB1234/i));
    await user.click(screen.getByRole("button", { name: /^deactivate$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });

  it("surfaces generic deactivate error when error has no message", async () => {
    mockDeleteVehicle.mockRejectedValueOnce(new Error(""));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/deactivate vehicle DL3CAB1234/i));
    await user.click(screen.getByRole("button", { name: /^deactivate$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to deactivate vehicle");
    });
  });

  it("paginates when total exceeds page size", async () => {
    mockGetVehicles.mockResolvedValueOnce({
      vehicles: [baseVehicle],
      total: 25,
      page: 1,
      limit: 10,
    });
    mockGetVehicles.mockResolvedValueOnce({
      vehicles: [{ ...baseVehicle, id: "v-2", registrationNumber: "MH12AB5678" }],
      total: 25,
      page: 2,
      limit: 10,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /previous/i }));
    await waitFor(() => {
      expect(mockGetVehicles).toHaveBeenLastCalledWith({ page: 1, limit: 10 });
    });
  });

  it("calls onSaved without throwing", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await user.click(screen.getByRole("button", { name: /trigger-saved/i }));
    expect(screen.getByTestId("vehicle-dialog")).toBeInTheDocument();
  });

  it("handles fetchMe failure gracefully (still renders)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/registration DL3CAB1234/i)).toBeInTheDocument();
    });
  });
});
