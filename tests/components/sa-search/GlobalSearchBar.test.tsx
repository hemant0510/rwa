import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GlobalSearchBar } from "@/components/features/sa-search/GlobalSearchBar";

// Mock next/link used by SearchResults
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const EMPTY_RESPONSE = {
  societies: [],
  residents: [],
  payments: [],
  events: [],
  petitions: [],
};

const SAMPLE_RESPONSE = {
  societies: [
    { id: "soc-1", name: "Eden Estate", societyCode: "EDEN01", status: "ACTIVE", city: "Gurgaon" },
  ],
  residents: [],
  payments: [],
  events: [],
  petitions: [],
};

const mockFetch = vi.fn();

describe("GlobalSearchBar", () => {
  describe("with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      global.fetch = mockFetch;
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(EMPTY_RESPONSE),
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("renders the search input with placeholder", () => {
      render(<GlobalSearchBar />);
      expect(
        screen.getByPlaceholderText("Search residents, societies, transactions..."),
      ).toBeInTheDocument();
    });

    it("shows Ctrl+K keyboard shortcut hint", () => {
      render(<GlobalSearchBar />);
      expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
    });

    it("focuses input on Ctrl+K", async () => {
      render(<GlobalSearchBar />);
      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
      });

      expect(document.activeElement).toBe(input);
    });

    it("focuses input on Meta+K", async () => {
      render(<GlobalSearchBar />);
      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      });

      expect(document.activeElement).toBe(input);
    });

    it("closes dropdown on Escape key", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_RESPONSE),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "Eden");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("Eden Estate")).toBeInTheDocument();
      });

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(screen.queryByText("Eden Estate")).not.toBeInTheDocument();
    });

    it("shows search results in dropdown when results come back", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_RESPONSE),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "Eden");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("Eden Estate")).toBeInTheDocument();
      });
    });

    it("sends encoded query to API", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "test query");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/super-admin/search?q=test%20query"),
        );
      });
    });

    it("closes dropdown when clicking outside", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_RESPONSE),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <div>
          <GlobalSearchBar />
          <div data-testid="outside">Outside</div>
        </div>,
      );

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "Eden");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("Eden Estate")).toBeInTheDocument();
      });

      await act(async () => {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(screen.queryByText("Eden Estate")).not.toBeInTheDocument();
    });

    it("handles fetch errors gracefully without crashing", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "test");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("handles non-ok response gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "test");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      expect(screen.queryByText("No results found")).not.toBeInTheDocument();
    });

    it("closes dropdown on Escape and clears query", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(SAMPLE_RESPONSE),
      });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "Eden");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("Eden Estate")).toBeInTheDocument();
      });

      // Close via Escape — clears query + results
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(screen.queryByText("Eden Estate")).not.toBeInTheDocument();
      expect(input).toHaveValue("");
    });

    it("shows loading spinner during fetch", async () => {
      // Make fetch hang to keep isLoading=true
      mockFetch.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { container } = render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "test");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // The loading spinner (Loader2) should be visible, Ctrl+K hint hidden
      await waitFor(() => {
        const spinner = container.querySelector("[class*='animate-spin']");
        expect(spinner).toBeInTheDocument();
      });
    });
  });

  describe("debounce behavior (real timers)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      global.fetch = mockFetch;
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(EMPTY_RESPONSE),
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("debounces the search request by 300ms", async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");
      await user.type(input, "tes");

      // Immediately after typing — debounce hasn't fired yet
      expect(mockFetch).not.toHaveBeenCalled();

      // Wait for debounce to fire
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    it("does not fetch when input is cleared", async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByPlaceholderText("Search residents, societies, transactions...");

      // Type a value and wait for debounce
      await user.type(input, "t");
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Clear the input
      await user.clear(input);

      // Wait to ensure no additional fetch is made
      await new Promise((r) => setTimeout(r, 400));

      // Should not have been called again — empty query skips fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
