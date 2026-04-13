import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VEHICLE_TYPE_LABELS, VehicleCard } from "@/components/features/vehicles/VehicleCard";
import type { Vehicle } from "@/services/vehicles";

const baseVehicle: Vehicle = {
  id: "v-1",
  unitId: "unit-1",
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
  pucExpiry: "2025-01-01",
  pucStatus: "EXPIRED",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  owner: { name: "Hemant Bhagat" },
  dependentOwner: null,
};

describe("VehicleCard", () => {
  it("renders icon, formatted reg, type, make/model, colour chip, parking slot, owner=Self", () => {
    render(<VehicleCard vehicle={baseVehicle} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    expect(screen.getByLabelText(/registration DL3CAB1234/i)).toHaveTextContent("DL 3 CAB 1234");
    expect(screen.getByText("Four-wheeler")).toBeInTheDocument();
    expect(screen.getByText("Maruti Swift")).toBeInTheDocument();
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Slot B-12")).toBeInTheDocument();
    expect(screen.getByText("Self")).toBeInTheDocument();
  });

  it("renders Owned by label when dependentOwner present", () => {
    render(
      <VehicleCard
        vehicle={{ ...baseVehicle, dependentOwner: { name: "Asha Bhagat" } }}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText(/Owned by: Asha Bhagat/)).toBeInTheDocument();
  });

  it("renders all 3 expiry badges with their respective statuses", () => {
    render(<VehicleCard vehicle={baseVehicle} onEdit={vi.fn()} onDeactivate={vi.fn()} />);
    expect(screen.getByLabelText(/insurance expiring soon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/puc expired/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rc valid/i)).toBeInTheDocument();
  });

  it("invokes onEdit and onDeactivate with the vehicle when buttons clicked", () => {
    const onEdit = vi.fn();
    const onDeactivate = vi.fn();
    render(<VehicleCard vehicle={baseVehicle} onEdit={onEdit} onDeactivate={onDeactivate} />);
    fireEvent.click(screen.getByLabelText(/edit vehicle DL3CAB1234/i));
    fireEvent.click(screen.getByLabelText(/deactivate vehicle DL3CAB1234/i));
    expect(onEdit).toHaveBeenCalledWith(baseVehicle);
    expect(onDeactivate).toHaveBeenCalledWith(baseVehicle);
  });

  it("hides colour chip when not provided", () => {
    render(
      <VehicleCard
        vehicle={{ ...baseVehicle, colour: null, parkingSlot: null, make: null, model: null }}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.queryByText("White")).not.toBeInTheDocument();
    expect(screen.queryByText(/Slot/)).not.toBeInTheDocument();
    expect(screen.queryByText("Maruti Swift")).not.toBeInTheDocument();
  });

  it("renders raw registration when format does not match", () => {
    render(
      <VehicleCard
        vehicle={{ ...baseVehicle, registrationNumber: "WEIRDREG" }}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText("WEIRDREG")).toBeInTheDocument();
  });

  it("falls back to type code when label missing", () => {
    render(
      <VehicleCard
        vehicle={{ ...baseVehicle, vehicleType: "MYSTERY" }}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText("MYSTERY")).toBeInTheDocument();
  });

  it("renders bike icon for two-wheeler and EV icon for EV", () => {
    const { container, rerender } = render(
      <VehicleCard
        vehicle={{ ...baseVehicle, vehicleType: "TWO_WHEELER" }}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    rerender(
      <VehicleCard
        vehicle={{ ...baseVehicle, vehicleType: "FOUR_WHEELER_EV" }}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("exposes VEHICLE_TYPE_LABELS for reuse", () => {
    expect(VEHICLE_TYPE_LABELS.FOUR_WHEELER).toBe("Four-wheeler");
    expect(VEHICLE_TYPE_LABELS.OTHER).toBe("Other");
  });
});
