import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseTheme, mockSetTheme } = vi.hoisted(() => ({
  mockUseTheme: vi.fn(),
  mockSetTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: mockUseTheme,
}));

import { ThemeToggle } from "@/components/features/marketing/ThemeToggle";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mockSetTheme });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ThemeToggle", () => {
  it("renders the dark-mode aria-label and toggles to dark when current theme is light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("renders the light-mode aria-label and toggles to light when current theme is dark", async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mockSetTheme });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to light mode" });
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("treats undefined resolvedTheme as light (toggles to dark)", async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: undefined, setTheme: mockSetTheme });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("renders both icon SVGs so CSS dark: variants can swap them without hydration mismatch", () => {
    const { container } = render(<ThemeToggle />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    const classes = Array.from(svgs).map((s) => s.getAttribute("class") ?? "");
    expect(classes.some((c) => c.includes("dark:block"))).toBe(true);
    expect(classes.some((c) => c.includes("dark:hidden"))).toBe(true);
  });
});
