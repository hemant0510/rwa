import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { CounsellorRow } from "@/components/features/sa-counsellors/CounsellorRow";
import type { CounsellorListItem } from "@/types/counsellor";

const activeNow = new Date().toISOString();

const base: CounsellorListItem = {
  id: "c-1",
  name: "Asha Patel",
  email: "asha@eden.com",
  mobile: "+91 9876543210",
  photoUrl: null,
  isActive: true,
  mfaEnrolledAt: null,
  passwordSetAt: activeNow,
  lastLoginAt: activeNow,
  createdAt: activeNow,
  _count: { assignments: 7 },
};

describe("CounsellorRow", () => {
  it("renders name, email, and society count", () => {
    render(<CounsellorRow counsellor={base} />);
    expect(screen.getByText("Asha Patel")).toBeInTheDocument();
    expect(screen.getByText("asha@eden.com")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("wraps row as a link to the detail page", () => {
    render(<CounsellorRow counsellor={base} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/sa/counsellors/c-1");
  });

  it("renders photoUrl when provided", () => {
    render(<CounsellorRow counsellor={{ ...base, photoUrl: "https://cdn.example.com/a.jpg" }} />);
    expect(screen.getByRole("img", { name: "Asha Patel" })).toBeInTheDocument();
  });

  it("renders initial letter avatar when no photo", () => {
    render(<CounsellorRow counsellor={{ ...base, photoUrl: null }} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows Suspended badge when inactive", () => {
    render(<CounsellorRow counsellor={{ ...base, isActive: false }} />);
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("shows Invite pending badge when password not yet set", () => {
    render(
      <CounsellorRow
        counsellor={{ ...base, passwordSetAt: null, lastLoginAt: null, isActive: true }}
      />,
    );
    expect(screen.getByText("Invite pending")).toBeInTheDocument();
  });

  it("shows Awaiting first login badge when password set but never logged in", () => {
    render(
      <CounsellorRow
        counsellor={{ ...base, passwordSetAt: activeNow, lastLoginAt: null, isActive: true }}
      />,
    );
    expect(screen.getByText("Awaiting first login")).toBeInTheDocument();
  });

  it("shows Active indicator when counsellor has logged in", () => {
    render(<CounsellorRow counsellor={base} />);
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });

  it("hides Active indicator when state is not ACTIVE", () => {
    render(
      <CounsellorRow
        counsellor={{ ...base, passwordSetAt: null, lastLoginAt: null, isActive: true }}
      />,
    );
    expect(screen.queryByLabelText("Active")).not.toBeInTheDocument();
  });
});
