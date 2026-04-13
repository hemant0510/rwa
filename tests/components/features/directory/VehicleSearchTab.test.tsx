import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchVehicles } = vi.hoisted(() => ({
  mockSearchVehicles: vi.fn(),
}));

vi.mock("@/services/vehicles", () => ({
  searchVehicles: mockSearchVehicles,
}));

import { VehicleSearchTab } from "@/components/features/directory/VehicleSearchTab";
import type { VehicleSearchResult } from "@/services/vehicles";

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VehicleSearchTab />
    </QueryClientProvider>,
  );
}

const sample: VehicleSearchResult = {
  id: "v1",
  registrationNumber: "DL3CAB1234",
  vehicleType: "FOUR_WHEELER",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  unit: { displayLabel: "A-101" },
  owner: { name: "Hemant" },
  dependentOwner: { name: "Asha" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockSearchVehicles.mockResolvedValue([sample]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("VehicleSearchTab", () => {
  it("shows guidance when query is too short", () => {
    renderTab();
    expect(screen.getByText(/type at least 3 characters/i)).toBeInTheDocument();
  });

  it("does not call searchVehicles until query length >= 3", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTab();
    await user.type(screen.getByLabelText(/search vehicles/i), "DL");
    vi.advanceTimersByTime(500);
    expect(mockSearchVehicles).not.toHaveBeenCalled();
  });

  it("calls searchVehicles after debounce when query length >= 3", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTab();
    await user.type(screen.getByLabelText(/search vehicles/i), "DL3");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(mockSearchVehicles).toHaveBeenCalledWith("DL3");
    });
  });

  it("renders result card without phone field", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTab();
    await user.type(screen.getByLabelText(/search vehicles/i), "DL3CAB");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
    });
    expect(screen.getByText(/Maruti Swift/)).toBeInTheDocument();
    expect(screen.getByText(/A-101/)).toBeInTheDocument();
    expect(screen.getByText(/Owner: Hemant/)).toBeInTheDocument();
    expect(screen.getByText(/Driver: Asha/)).toBeInTheDocument();
    // No phone number anywhere in the rendered result
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument();
  });

  it("shows empty state when no results", async () => {
    mockSearchVehicles.mockResolvedValueOnce([]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTab();
    await user.type(screen.getByLabelText(/search vehicles/i), "ZZZ");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(screen.getByText(/no matching vehicles/i)).toBeInTheDocument();
    });
  });

  it("handles minimal result record (only reg + unit)", async () => {
    mockSearchVehicles.mockResolvedValueOnce([
      {
        id: "v2",
        registrationNumber: "MH01AB0001",
        vehicleType: "TWO_WHEELER",
        make: null,
        model: null,
        colour: null,
        unit: null,
        owner: null,
        dependentOwner: null,
      },
    ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTab();
    await user.type(screen.getByLabelText(/search vehicles/i), "MH0");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(screen.getByText("MH01AB0001")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Owner:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Driver:/)).not.toBeInTheDocument();
  });
});
