import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorOnboardingPage from "@/app/counsellor/(authed)/onboarding/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorOnboardingPage", () => {
  it("renders welcome heading and code of conduct bullets", () => {
    render(<CounsellorOnboardingPage />);
    expect(screen.getByText("Welcome to RWA Connect")).toBeInTheDocument();
    expect(screen.getByText("Counsellor Code of Conduct")).toBeInTheDocument();
    expect(screen.getByText(/Maintain neutrality/)).toBeInTheDocument();
    expect(screen.getByText(/72 hours/)).toBeInTheDocument();
  });

  it("disables Continue button until checkbox is checked", () => {
    render(<CounsellorOnboardingPage />);
    expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });

  it("enables Continue button after checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<CounsellorOnboardingPage />);
    await user.click(screen.getByLabelText("Accept code of conduct"));
    expect(screen.getByRole("button", { name: /Continue/ })).toBeEnabled();
  });

  it("navigates to /counsellor on continue", async () => {
    const user = userEvent.setup();
    render(<CounsellorOnboardingPage />);
    await user.click(screen.getByLabelText("Accept code of conduct"));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(mockPush).toHaveBeenCalledWith("/counsellor");
    expect(mockRefresh).toHaveBeenCalled();
  });
});
