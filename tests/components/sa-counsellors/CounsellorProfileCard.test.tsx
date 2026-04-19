import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { CounsellorProfileCard } from "@/components/features/sa-counsellors/CounsellorProfileCard";
import type { CounsellorDetail } from "@/types/counsellor";

const base: CounsellorDetail = {
  id: "c-1",
  authUserId: "auth-1",
  name: "Asha Patel",
  email: "asha@eden.com",
  mobile: "+91 9876543210",
  nationalId: "AAAAA1111A",
  photoUrl: null,
  bio: "10 years ombudsperson experience",
  publicBlurb: "Neutral advisor",
  isActive: true,
  mfaRequired: false,
  mfaEnrolledAt: null,
  passwordSetAt: new Date("2026-03-01").toISOString(),
  lastLoginAt: new Date("2026-04-01").toISOString(),
  createdAt: new Date("2026-01-01").toISOString(),
  updatedAt: new Date("2026-04-01").toISOString(),
};

describe("CounsellorProfileCard", () => {
  it("renders name, blurb, email, mobile, and bio", () => {
    render(<CounsellorProfileCard counsellor={base} />);
    expect(screen.getByText("Asha Patel")).toBeInTheDocument();
    expect(screen.getByText("Neutral advisor")).toBeInTheDocument();
    expect(screen.getByText("asha@eden.com")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText("10 years ombudsperson experience")).toBeInTheDocument();
    expect(screen.getByText("AAAAA1111A")).toBeInTheDocument();
  });

  it("renders Active badge when counsellor has logged in", () => {
    render(<CounsellorProfileCard counsellor={base} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders Suspended badge when counsellor is inactive", () => {
    render(<CounsellorProfileCard counsellor={{ ...base, isActive: false }} />);
    expect(screen.getByText("Suspended")).toBeInTheDocument();
  });

  it("renders Invite pending badge when password not yet set", () => {
    render(
      <CounsellorProfileCard counsellor={{ ...base, passwordSetAt: null, lastLoginAt: null }} />,
    );
    expect(screen.getByText("Invite pending")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("renders Awaiting first login badge when password set but never logged in", () => {
    render(
      <CounsellorProfileCard
        counsellor={{
          ...base,
          passwordSetAt: new Date("2026-03-01").toISOString(),
          lastLoginAt: null,
        }}
      />,
    );
    expect(screen.getByText("Awaiting first login")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("renders photo when provided", () => {
    render(
      <CounsellorProfileCard counsellor={{ ...base, photoUrl: "https://cdn.example.com/a.jpg" }} />,
    );
    expect(screen.getByRole("img", { name: "Asha Patel" })).toBeInTheDocument();
  });

  it("renders initial letter avatar when no photo", () => {
    render(<CounsellorProfileCard counsellor={base} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders 'Not provided' when mobile is null", () => {
    render(<CounsellorProfileCard counsellor={{ ...base, mobile: null, nationalId: null }} />);
    const notProvided = screen.getAllByText("Not provided");
    expect(notProvided.length).toBeGreaterThanOrEqual(2);
  });

  it("renders 'Never' when lastLoginAt is null", () => {
    render(<CounsellorProfileCard counsellor={{ ...base, lastLoginAt: null }} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("does NOT render Bio block when bio is null", () => {
    render(<CounsellorProfileCard counsellor={{ ...base, bio: null }} />);
    expect(screen.queryByText("Bio")).not.toBeInTheDocument();
  });

  it("does NOT render blurb when publicBlurb is null", () => {
    render(<CounsellorProfileCard counsellor={{ ...base, publicBlurb: null }} />);
    expect(screen.queryByText("Neutral advisor")).not.toBeInTheDocument();
  });

  it("renders MFA 'Enrolled' line when mfaEnrolledAt is set", () => {
    render(
      <CounsellorProfileCard
        counsellor={{ ...base, mfaEnrolledAt: new Date("2026-02-01").toISOString() }}
      />,
    );
    expect(screen.getByText(/Enrolled/)).toBeInTheDocument();
  });
});
