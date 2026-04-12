import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuthContext } from "@/hooks/useAuth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/r/home",
}));

vi.mock("@/components/features/SocietySwitcher", () => ({
  SocietySwitcher: () => <div data-testid="society-switcher">Switcher</div>,
}));

vi.mock("@/components/layout/ResidentSidebar", () => ({
  ResidentSidebar: ({ societyName }: { societyName: string }) => (
    <aside data-testid="resident-sidebar">{societyName}</aside>
  ),
  ResidentMobileSidebar: ({ open }: { open: boolean }) => (
    <div data-testid="mobile-sidebar" data-open={String(open)} />
  ),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({
    title,
    subtitle,
    userName,
    societySwitcher,
    onMenuToggle,
  }: {
    title: string;
    subtitle: string;
    userName: string;
    societySwitcher?: React.ReactNode;
    onMenuToggle?: () => void;
  }) => (
    <header data-testid="header">
      <span>{title}</span>
      <span data-testid="subtitle">{subtitle}</span>
      <span data-testid="username">{userName}</span>
      {onMenuToggle && (
        <button data-testid="menu-btn" onClick={onMenuToggle}>
          Menu
        </button>
      )}
      {societySwitcher && <div data-testid="switcher-wrapper">{societySwitcher}</div>}
    </header>
  ),
}));

import ResidentLayout from "@/app/r/layout";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: null }) }),
  );
});

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Hemant",
    role: "RESIDENT" as const,
    permission: null,
    societyId: "soc-1",
    societyName: "Eden Estate",
    societyCode: "EDEN",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
    ...overrides,
  };
}

function renderLayout(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: makeUser(userOverrides),
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <ResidentLayout>
          <div>Page Content</div>
        </ResidentLayout>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ResidentLayout", () => {
  it("renders with user's society name", () => {
    renderLayout();
    expect(screen.getByTestId("subtitle").textContent).toBe("Eden Estate");
    expect(screen.getByTestId("resident-sidebar").textContent).toContain("Eden Estate");
  });

  it("falls back to RWA Connect when societyName is null", () => {
    renderLayout({ societyName: null });
    expect(screen.getByTestId("subtitle").textContent).toBe("RWA Connect");
  });

  it("shows user name in header", () => {
    renderLayout({ name: "Hemant Bhagat" });
    expect(screen.getByTestId("username").textContent).toBe("Hemant Bhagat");
  });

  it("falls back to Resident when user name is null", () => {
    renderLayout({ name: null });
    expect(screen.getByTestId("username").textContent).toBe("Resident");
  });

  it("does not show SocietySwitcher when multiSociety is false", () => {
    renderLayout({ multiSociety: false });
    expect(screen.queryByTestId("switcher-wrapper")).not.toBeInTheDocument();
  });

  it("shows SocietySwitcher when multiSociety is true", () => {
    renderLayout({ multiSociety: true });
    expect(screen.getByTestId("switcher-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("society-switcher")).toBeInTheDocument();
  });

  it("renders children inside main", () => {
    renderLayout();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("treats null multiSociety as false (no switcher shown)", () => {
    renderLayout({ multiSociety: null as unknown as boolean });
    expect(screen.queryByTestId("switcher-wrapper")).not.toBeInTheDocument();
  });

  it("calls setSidebarOpen when onMenuToggle fires", () => {
    renderLayout();
    fireEvent.click(screen.getByTestId("menu-btn"));
    expect(screen.getByTestId("mobile-sidebar")).toHaveAttribute("data-open", "true");
  });

  it("handles fetchPhotoUrl API error gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    renderLayout();
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });
});
