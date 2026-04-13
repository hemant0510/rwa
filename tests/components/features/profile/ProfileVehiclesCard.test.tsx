import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfileVehiclesCard } from "@/components/features/profile/ProfileVehiclesCard";

describe("ProfileVehiclesCard", () => {
  it("renders count + first reg + View link when vehicleCount > 0", () => {
    render(
      <ProfileVehiclesCard
        vehicleCount={2}
        firstReg="DL3CAB1234"
        vehicleStatus="HAS_ENTRIES"
        expiryAlerts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 registered · DL3CAB1234/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view vehicles/i })).toHaveAttribute(
      "href",
      "/r/profile/vehicles",
    );
  });

  it("renders without firstReg when null", () => {
    render(
      <ProfileVehiclesCard
        vehicleCount={1}
        firstReg={null}
        vehicleStatus="HAS_ENTRIES"
        expiryAlerts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 registered/)).toBeInTheDocument();
  });

  it("renders expiry-alert rows with RC/Insurance/PUC status tags", () => {
    render(
      <ProfileVehiclesCard
        vehicleCount={1}
        firstReg="DL3CAB1234"
        vehicleStatus="HAS_ENTRIES"
        expiryAlerts={[
          {
            id: "v1",
            registrationNumber: "DL3CAB1234",
            rcStatus: "EXPIRED",
            insuranceStatus: "EXPIRING_SOON",
            pucStatus: "VALID",
          },
          {
            id: "v2",
            registrationNumber: "MH12XY0001",
            rcStatus: "VALID",
            insuranceStatus: "VALID",
            pucStatus: "EXPIRING_SOON",
          },
        ]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/RC expired, Insurance expiring/)).toBeInTheDocument();
    expect(screen.getByText(/PUC expiring/)).toBeInTheDocument();
  });

  it("covers RC-expiring, Insurance-expired, PUC-expired tags", () => {
    render(
      <ProfileVehiclesCard
        vehicleCount={1}
        firstReg="DL3CAB1234"
        vehicleStatus="HAS_ENTRIES"
        expiryAlerts={[
          {
            id: "v1",
            registrationNumber: "A",
            rcStatus: "EXPIRING_SOON",
            insuranceStatus: "EXPIRED",
            pucStatus: "EXPIRED",
          },
        ]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/RC expiring, Insurance expired, PUC expired/)).toBeInTheDocument();
  });

  it("skips alert rows where no urgent tags exist", () => {
    render(
      <ProfileVehiclesCard
        vehicleCount={1}
        firstReg="DL3CAB1234"
        vehicleStatus="HAS_ENTRIES"
        expiryAlerts={[
          {
            id: "v1",
            registrationNumber: "DL3CAB1234",
            rcStatus: "VALID",
            insuranceStatus: "VALID",
            pucStatus: "VALID",
          },
        ]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.queryByText("DL3CAB1234")).not.toBeInTheDocument();
  });

  it("shows declaration toggle when vehicleCount is 0 and status is NOT_SET", () => {
    const onDeclareNone = vi.fn();
    render(
      <ProfileVehiclesCard
        vehicleCount={0}
        firstReg={null}
        vehicleStatus="NOT_SET"
        expiryAlerts={[]}
        onDeclareNone={onDeclareNone}
        onUndoDeclaration={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /don't have any vehicles/i }));
    expect(onDeclareNone).toHaveBeenCalled();
  });

  it("shows declared-none with undo when DECLARED_NONE", () => {
    const onUndo = vi.fn();
    render(
      <ProfileVehiclesCard
        vehicleCount={0}
        firstReg={null}
        vehicleStatus="DECLARED_NONE"
        expiryAlerts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={onUndo}
      />,
    );
    expect(screen.getByText(/declared no vehicles/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /undo declaration/i }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("hides View vehicles link when count is 0", () => {
    render(
      <ProfileVehiclesCard
        vehicleCount={0}
        firstReg={null}
        vehicleStatus="NOT_SET"
        expiryAlerts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link", { name: /view vehicles/i })).not.toBeInTheDocument();
  });
});
