import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateVehicle,
  mockUpdateVehicle,
  mockUploadPhoto,
  mockUploadRc,
  mockUploadInsurance,
  mockCompressImage,
} = vi.hoisted(() => ({
  mockCreateVehicle: vi.fn(),
  mockUpdateVehicle: vi.fn(),
  mockUploadPhoto: vi.fn(),
  mockUploadRc: vi.fn(),
  mockUploadInsurance: vi.fn(),
  mockCompressImage: vi.fn(),
}));

vi.mock("@/services/vehicles", () => ({
  createVehicle: mockCreateVehicle,
  updateVehicle: mockUpdateVehicle,
  uploadVehiclePhoto: mockUploadPhoto,
  uploadVehicleRc: mockUploadRc,
  uploadVehicleInsurance: mockUploadInsurance,
}));

vi.mock("@/lib/utils/compress-image", () => ({
  compressImage: mockCompressImage,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { VehicleDialog } from "@/components/features/vehicles/VehicleDialog";
import type { Vehicle } from "@/services/vehicles";

const UNIT_1 = "11111111-1111-4111-8111-111111111111";
const UNIT_2 = "22222222-2222-4222-8222-222222222222";
const DEP_1 = "33333333-3333-4333-8333-333333333333";

const baseVehicle: Vehicle = {
  id: "v-1",
  unitId: UNIT_1,
  societyId: "soc-1",
  vehicleType: "FOUR_WHEELER",
  registrationNumber: "DL3CAB1234",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  parkingSlot: "B-12",
  fastagId: "FT-001",
  notes: "Family car",
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
  owner: { name: "Arjun Kapoor" },
  dependentOwner: null,
};

const units = [{ id: UNIT_1, displayLabel: "A-101" }];
const dependents = [{ id: DEP_1, name: "Asha Bhagat" }];

beforeEach(() => {
  vi.clearAllMocks();
  mockCompressImage.mockImplementation(async (f: File) => f);
  mockCreateVehicle.mockResolvedValue({ ...baseVehicle, id: "new-id" });
  mockUpdateVehicle.mockResolvedValue(baseVehicle);
  mockUploadPhoto.mockResolvedValue({ url: "https://x/photo" });
  mockUploadRc.mockResolvedValue({ url: "https://x/rc" });
  mockUploadInsurance.mockResolvedValue({ url: "https://x/ins" });
});

afterEach(() => vi.clearAllMocks());

describe("VehicleDialog — create flow", () => {
  it("renders Add Vehicle title and read-only single unit", () => {
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Add Vehicle" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Unit/) as HTMLInputElement).toHaveValue("A-101");
    expect(screen.getByLabelText(/^Unit/)).toBeDisabled();
  });

  it("creates a vehicle when valid fields submitted", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <VehicleDialog
        open
        onOpenChange={onOpenChange}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={onSaved}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "dl3cab1234");
    fireEvent.blur(screen.getByLabelText(/Registration Number/i));
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => expect(mockCreateVehicle).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Vehicle added");
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows duplicate error inline when API returns already registered", async () => {
    mockCreateVehicle.mockRejectedValueOnce(
      new Error("Registration DL3CAB1234 is already registered to unit B-204."),
    );
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    });
    // typing into reg number clears the duplicate error
    await user.type(screen.getByLabelText(/Registration Number/i), "X");
    await waitFor(() => {
      expect(screen.queryByText(/already registered/i)).not.toBeInTheDocument();
    });
  });

  it("shows limit-reached banner when API returns limit error", async () => {
    mockCreateVehicle.mockRejectedValueOnce(
      new Error("This unit has reached its vehicle limit (3). Contact admin to increase."),
    );
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(screen.getByText(/vehicle limit/i)).toBeInTheDocument();
    });
  });

  it("shows generic toast for other errors", async () => {
    mockCreateVehicle.mockRejectedValueOnce(new Error("Boom"));
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Boom");
    });
  });

  it("falls back to generic message when error has no message", async () => {
    mockCreateVehicle.mockRejectedValueOnce("oops");
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save vehicle");
    });
  });

  it("uploads photo, RC, insurance after creating vehicle", async () => {
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    const photo = new File(["x"], "p.jpg", { type: "image/jpeg" });
    const rc = new File(["y"], "rc.pdf", { type: "application/pdf" });
    const ins = new File(["z"], "ins.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Vehicle Photo/i), { target: { files: [photo] } });
    fireEvent.change(screen.getByLabelText(/RC Document/i), { target: { files: [rc] } });
    fireEvent.change(screen.getByLabelText(/Insurance Document/i), { target: { files: [ins] } });

    expect(screen.getByText(/Selected: p\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/Selected: rc\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Selected: ins\.pdf/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add vehicle/i }));

    await waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledWith("new-id", photo);
      expect(mockUploadRc).toHaveBeenCalledWith("new-id", rc);
      expect(mockUploadInsurance).toHaveBeenCalledWith("new-id", ins);
    });
  });

  it("toasts when each upload step fails but vehicle is saved", async () => {
    mockUploadPhoto.mockRejectedValueOnce(new Error("net1"));
    mockUploadRc.mockRejectedValueOnce(new Error("net2"));
    mockUploadInsurance.mockRejectedValueOnce(new Error("net3"));
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    fireEvent.change(screen.getByLabelText(/Vehicle Photo/i), {
      target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText(/RC Document/i), {
      target: { files: [new File(["y"], "rc.pdf", { type: "application/pdf" })] },
    });
    fireEvent.change(screen.getByLabelText(/Insurance Document/i), {
      target: { files: [new File(["z"], "ins.pdf", { type: "application/pdf" })] },
    });
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Photo upload failed — vehicle saved");
      expect(toast.error).toHaveBeenCalledWith("RC upload failed — vehicle saved");
      expect(toast.error).toHaveBeenCalledWith("Insurance upload failed — vehicle saved");
    });
  });

  it("invokes onOpenChange(false) when Cancel clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={onOpenChange}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("changes vehicle type via Select dropdown", async () => {
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText(/Vehicle Type/));
    await user.click(await screen.findByRole("option", { name: "Two-wheeler" }));
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(mockCreateVehicle).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleType: "TWO_WHEELER" }),
      );
    });
  });

  it("changes owner via dropdown", async () => {
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText(/^Owner/));
    await user.click(await screen.findByRole("option", { name: "Asha Bhagat" }));
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(mockCreateVehicle).toHaveBeenCalledWith(
        expect.objectContaining({ dependentOwnerId: DEP_1 }),
      );
    });
  });

  it("shows multi-unit dropdown when more than one unit", async () => {
    const multi = [
      { id: UNIT_1, displayLabel: "A-101" },
      { id: UNIT_2, displayLabel: "B-204" },
    ];
    const user = userEvent.setup();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={multi}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText(/^Unit/));
    await user.click(await screen.findByRole("option", { name: "B-204" }));
    await user.type(screen.getByLabelText(/Registration Number/i), "DL3CAB1234");
    await user.click(screen.getByRole("button", { name: /add vehicle/i }));
    await waitFor(() => {
      expect(mockCreateVehicle).toHaveBeenCalledWith(expect.objectContaining({ unitId: UNIT_2 }));
    });
  });

  it("renders dash placeholder when units array is empty", () => {
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={null}
        units={[]}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/^Unit/) as HTMLInputElement).toHaveValue("—");
  });
});

describe("VehicleDialog — edit flow", () => {
  it("renders Edit Vehicle title with prefilled fields", () => {
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={baseVehicle}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Edit Vehicle" })).toBeInTheDocument();
    expect((screen.getByLabelText(/Registration Number/i) as HTMLInputElement).value).toBe(
      "DL3CAB1234",
    );
    expect((screen.getByLabelText(/Make/) as HTMLInputElement).value).toBe("Maruti");
  });

  it("calls updateVehicle on save", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={baseVehicle}
        units={units}
        dependents={dependents}
        onSaved={onSaved}
      />,
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateVehicle).toHaveBeenCalledWith("v-1", expect.any(Object));
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("re-initialises when open transitions to true", () => {
    const { rerender } = render(
      <VehicleDialog
        open={false}
        onOpenChange={vi.fn()}
        vehicle={null}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    rerender(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={baseVehicle}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    expect((screen.getByLabelText(/Make/) as HTMLInputElement).value).toBe("Maruti");
  });

  it("prefills empty defaults for nullable fields", () => {
    render(
      <VehicleDialog
        open
        onOpenChange={vi.fn()}
        vehicle={{
          ...baseVehicle,
          make: null,
          model: null,
          colour: null,
          parkingSlot: null,
          fastagId: null,
          notes: null,
          insuranceExpiry: null,
          pucExpiry: null,
          rcExpiry: null,
        }}
        units={units}
        dependents={dependents}
        onSaved={vi.fn()}
      />,
    );
    expect((screen.getByLabelText(/Make/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Insurance Expiry/) as HTMLInputElement).value).toBe("");
  });
});
