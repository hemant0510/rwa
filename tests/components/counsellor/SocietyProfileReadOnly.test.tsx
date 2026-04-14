import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SocietyProfileReadOnly } from "@/components/features/counsellor/SocietyProfileReadOnly";
import type { CounsellorSocietyDetail } from "@/types/counsellor";

const society: CounsellorSocietyDetail = {
  id: "s-1",
  name: "Alpha Residency",
  societyCode: "ALPHA",
  city: "Pune",
  state: "MH",
  pincode: "411001",
  totalUnits: 120,
  registrationNo: "REG-42",
  registrationDate: "2020-01-15",
  counsellorEscalationThreshold: 10,
  onboardingDate: "2023-05-10",
  assignedAt: "2026-01-01",
  isPrimary: true,
  counts: { residents: 87, governingBodyMembers: 5, openEscalations: 2 },
};

describe("SocietyProfileReadOnly", () => {
  it("renders society profile card with code and counts", () => {
    render(<SocietyProfileReadOnly society={society} />);
    expect(screen.getByText("Alpha Residency")).toBeInTheDocument();
    expect(screen.getByText("ALPHA")).toBeInTheDocument();
    expect(screen.getByText("Pune, MH")).toBeInTheDocument();
    expect(screen.getByText("411001")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("10 votes")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("renders em-dashes for null registration fields", () => {
    render(
      <SocietyProfileReadOnly
        society={{ ...society, registrationNo: null, registrationDate: null, isPrimary: false }}
      />,
    );
    expect(screen.queryByText("Primary")).not.toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
