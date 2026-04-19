import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuthContext } from "@/hooks/useAuth";

vi.mock("next/navigation", () => ({
  usePathname: () => "/counsellor",
}));

vi.mock("@/components/layout/CounsellorSidebar", () => ({
  CounsellorSidebar: ({ counsellorName }: { counsellorName?: string }) => (
    <aside data-testid="counsellor-sidebar">{counsellorName}</aside>
  ),
  CounsellorMobileSidebar: ({
    open,
    counsellorName,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    counsellorName?: string;
  }) => (
    <div data-testid="mobile-sidebar" data-open={String(open)}>
      {counsellorName}
    </div>
  ),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({
    title,
    subtitle,
    userName,
    onMenuToggle,
    onSignOut,
  }: {
    title: string;
    subtitle?: string;
    userName: string;
    onMenuToggle?: () => void;
    onSignOut?: () => void;
  }) => (
    <header data-testid="header">
      <span data-testid="title">{title}</span>
      <span data-testid="subtitle">{subtitle}</span>
      <span data-testid="username">{userName}</span>
      {onMenuToggle && (
        <button data-testid="menu-btn" onClick={onMenuToggle}>
          Menu
        </button>
      )}
      {onSignOut && (
        <button data-testid="signout-btn" onClick={onSignOut}>
          Sign Out
        </button>
      )}
    </header>
  ),
}));

import { CounsellorShell } from "@/app/counsellor/(authed)/counsellor-shell";

const mockSignOut = vi.fn();

function renderShell() {
  return render(
    <AuthContext.Provider
      value={{
        user: {
          id: "u1",
          name: "Aman Goel",
          role: "RESIDENT",
          permission: null,
          societyId: null,
          societyName: null,
          societyCode: null,
          societyStatus: null,
          trialEndsAt: null,
          isTrialExpired: false,
          multiSociety: false,
          societies: null,
        },
        isLoading: false,
        isAuthenticated: true,
        signOut: mockSignOut,
        switchSociety: vi.fn(),
      }}
    >
      <CounsellorShell counsellorName="Aman Goel">
        <div>Page Content</div>
      </CounsellorShell>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  mockSignOut.mockReset();
});

describe("CounsellorShell", () => {
  it("renders sidebar and mobile sidebar with counsellor name", () => {
    renderShell();
    expect(screen.getByTestId("counsellor-sidebar").textContent).toBe("Aman Goel");
    expect(screen.getByTestId("mobile-sidebar").textContent).toBe("Aman Goel");
  });

  it("renders header with counsellor name as subtitle and userName", () => {
    renderShell();
    expect(screen.getByTestId("title").textContent).toBe("Counsellor");
    expect(screen.getByTestId("subtitle").textContent).toBe("Aman Goel");
    expect(screen.getByTestId("username").textContent).toBe("Aman Goel");
  });

  it("renders children inside main area", () => {
    renderShell();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("toggles mobile sidebar open when menu button is clicked", () => {
    renderShell();
    expect(screen.getByTestId("mobile-sidebar")).toHaveAttribute("data-open", "false");
    fireEvent.click(screen.getByTestId("menu-btn"));
    expect(screen.getByTestId("mobile-sidebar")).toHaveAttribute("data-open", "true");
  });

  it("calls signOut from useAuth when sign out button is clicked", () => {
    renderShell();
    fireEvent.click(screen.getByTestId("signout-btn"));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
