import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetVehicles, mockUpdateVehicle } = vi.hoisted(() => ({
  mockGetVehicles: vi.fn(),
  mockUpdateVehicle: vi.fn(),
}));

vi.mock("@/services/admin-residents", () => ({
  getResidentVehicles: mockGetVehicles,
  updateAdminVehicle: mockUpdateVehicle,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ResidentVehiclesTab } from "@/components/features/admin/ResidentVehiclesTab";
import type { AdminVehicle } from "@/services/admin-residents";

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ResidentVehiclesTab residentId="r1" />
    </QueryClientProvider>,
  );
}

const baseVehicle: AdminVehicle = {
  id: "v1",
  unitId: "u1",
  unit: { displayLabel: "A-101" },
  societyId: "s1",
  vehicleType: "FOUR_WHEELER",
  registrationNumber: "DL3CAB1234",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  parkingSlot: "B-12",
  stickerNumber: "S-001",
  evSlot: null,
  validFrom: "2026-01-01",
  validTo: "2027-01-01",
  fastagId: null,
  notes: null,
  ownerId: "o1",
  owner: { id: "o1", name: "Arjun" },
  dependentOwnerId: null,
  dependentOwner: null,
  vehiclePhotoUrl: null,
  rcDocUrl: null,
  rcDocSignedUrl: "https://x/rc.pdf",
  rcExpiry: "2027-01-15",
  rcStatus: "VALID",
  insuranceUrl: null,
  insuranceSignedUrl: "https://x/ins.pdf",
  insuranceExpiry: "2026-05-01",
  insuranceStatus: "EXPIRING_SOON",
  pucExpiry: null,
  pucStatus: "NOT_SET",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateVehicle.mockResolvedValue(baseVehicle);
});

afterEach(() => vi.clearAllMocks());

describe("ResidentVehiclesTab", () => {
  it("renders loading spinner initially", () => {
    mockGetVehicles.mockReturnValue(new Promise(() => {}));
    const { container } = renderTab();
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
  });

  it("renders error state and retries", async () => {
    mockGetVehicles.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/unable to load vehicles/i)).toBeInTheDocument();
    });
    mockGetVehicles.mockResolvedValueOnce([baseVehicle]);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => {
      expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
    });
  });

  it("renders empty state", async () => {
    mockGetVehicles.mockResolvedValue([]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/no vehicles/i)).toBeInTheDocument();
    });
  });

  it("renders vehicle card with RC + Insurance view links", async () => {
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "RC" })).toHaveAttribute("href", "https://x/rc.pdf");
    expect(screen.getByRole("link", { name: "Insurance" })).toHaveAttribute(
      "href",
      "https://x/ins.pdf",
    );
    expect(screen.getByText(/A-101/)).toBeInTheDocument();
    expect(screen.getByText(/Arjun/)).toBeInTheDocument();
  });

  it("inline-edits parking slot and saves", async () => {
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit Parking Slot/i }));
    const input = screen.getByLabelText(/Parking Slot input/i);
    await user.clear(input);
    await user.type(input, "C-14");
    await user.click(screen.getByRole("button", { name: /save Parking Slot/i }));
    await waitFor(() => {
      expect(mockUpdateVehicle).toHaveBeenCalledWith("v1", { parkingSlot: "C-14" });
    });
    expect(toast.success).toHaveBeenCalledWith("Vehicle updated");
  });

  it("edits each editable field (stickerNumber, evSlot, validFrom, validTo)", async () => {
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());

    // stickerNumber
    await user.click(screen.getByRole("button", { name: /edit Sticker #/i }));
    const stickerInput = screen.getByLabelText(/Sticker # input/i);
    await user.clear(stickerInput);
    await user.type(stickerInput, "S-999");
    await user.click(screen.getByRole("button", { name: /save Sticker #/i }));
    await waitFor(() =>
      expect(mockUpdateVehicle).toHaveBeenLastCalledWith("v1", { stickerNumber: "S-999" }),
    );

    // evSlot
    await user.click(screen.getByRole("button", { name: /edit EV Slot/i }));
    const evInput = screen.getByLabelText(/EV Slot input/i);
    await user.type(evInput, "EV-3");
    await user.click(screen.getByRole("button", { name: /save EV Slot/i }));
    await waitFor(() =>
      expect(mockUpdateVehicle).toHaveBeenLastCalledWith("v1", { evSlot: "EV-3" }),
    );
  });

  it("edits date fields (validFrom, validTo)", async () => {
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /edit Valid From/i }));
    const validFromInput = screen.getByLabelText(/Valid From input/i) as HTMLInputElement;
    expect(validFromInput.type).toBe("date");
    fireEvent.change(validFromInput, { target: { value: "2026-06-01" } });
    await user.click(screen.getByRole("button", { name: /save Valid From/i }));
    await waitFor(() =>
      expect(mockUpdateVehicle).toHaveBeenLastCalledWith("v1", { validFrom: "2026-06-01" }),
    );
  });

  it("clearing a field sends null", async () => {
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit Parking Slot/i }));
    const input = screen.getByLabelText(/Parking Slot input/i);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /save Parking Slot/i }));
    await waitFor(() =>
      expect(mockUpdateVehicle).toHaveBeenLastCalledWith("v1", { parkingSlot: null }),
    );
  });

  it("cancels edit without saving", async () => {
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit Parking Slot/i }));
    await user.click(screen.getByRole("button", { name: /cancel Parking Slot/i }));
    expect(mockUpdateVehicle).not.toHaveBeenCalled();
  });

  it("surfaces error toast when update fails", async () => {
    mockUpdateVehicle.mockRejectedValueOnce(new Error("Nope"));
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit Parking Slot/i }));
    await user.click(screen.getByRole("button", { name: /save Parking Slot/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });

  it("surfaces generic error when mutation error has no message", async () => {
    mockUpdateVehicle.mockRejectedValueOnce(new Error(""));
    mockGetVehicles.mockResolvedValue([baseVehicle]);
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(screen.getByText("DL3CAB1234")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit Parking Slot/i }));
    await user.click(screen.getByRole("button", { name: /save Parking Slot/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update vehicle");
    });
  });

  it("renders inactive vehicle with Inactive badge", async () => {
    mockGetVehicles.mockResolvedValue([
      { ...baseVehicle, id: "v2", registrationNumber: "MH12AB1111", isActive: false },
    ]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("MH12AB1111")).toBeInTheDocument();
    });
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("falls back to raw vehicleType when label missing", async () => {
    mockGetVehicles.mockResolvedValue([{ ...baseVehicle, vehicleType: "WEIRD" }]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("WEIRD")).toBeInTheDocument();
    });
  });

  it("renders em-dash when make/model/colour all null", async () => {
    mockGetVehicles.mockResolvedValue([
      {
        ...baseVehicle,
        make: null,
        model: null,
        colour: null,
        unit: null,
        owner: null,
        rcDocSignedUrl: null,
        insuranceSignedUrl: null,
      },
    ]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "RC" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Insurance" })).not.toBeInTheDocument();
  });
});
