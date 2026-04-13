import { useState } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VehicleSearchBar, type SearchMode } from "@/components/features/admin/VehicleSearchBar";

function Harness({
  initialMode = "people" as SearchMode,
  onQueryChange,
}: {
  initialMode?: SearchMode;
  onQueryChange?: (q: string) => void;
}) {
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [query, setQuery] = useState("");
  return (
    <VehicleSearchBar
      mode={mode}
      query={query}
      onModeChange={setMode}
      onQueryChange={(v) => {
        setQuery(v);
        onQueryChange?.(v);
      }}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("VehicleSearchBar", () => {
  it("renders both mode buttons with People active by default", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /by name/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /by vehicle/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByLabelText(/search residents/i)).toBeInTheDocument();
  });

  it("does not call onQueryChange when debounce fires without a change", () => {
    const onQueryChange = vi.fn();
    render(<Harness onQueryChange={onQueryChange} />);
    // Debounce fires once with localQuery === query (both empty)
    vi.advanceTimersByTime(500);
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it("switches to vehicle mode when By Vehicle clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /by vehicle/i }));
    expect(screen.getByRole("button", { name: /by vehicle/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/search vehicles/i)).toBeInTheDocument();
  });

  it("switches back to people mode when By Name clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initialMode="vehicle" />);
    await user.click(screen.getByRole("button", { name: /by name/i }));
    expect(screen.getByRole("button", { name: /by name/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("debounces onQueryChange calls", async () => {
    const onQueryChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness onQueryChange={onQueryChange} />);
    await user.type(screen.getByLabelText(/search residents/i), "abc");
    // Before debounce: not yet fired
    expect(onQueryChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith("abc");
    });
  });

  it("shows min-length hint in vehicle mode below threshold", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initialMode="vehicle" />);
    await user.type(screen.getByLabelText(/search vehicles/i), "DL");
    expect(screen.getByText(/type at least 3 characters/i)).toBeInTheDocument();
  });

  it("hides min-length hint once query length >= 3", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness initialMode="vehicle" />);
    await user.type(screen.getByLabelText(/search vehicles/i), "DL3");
    expect(screen.queryByText(/type at least 3 characters/i)).not.toBeInTheDocument();
  });

  it("resets local query when parent query changes", async () => {
    function Parent() {
      const [q, setQ] = useState("initial");
      return (
        <>
          <VehicleSearchBar
            mode="people"
            query={q}
            onModeChange={vi.fn()}
            onQueryChange={vi.fn()}
          />
          <button type="button" onClick={() => setQ("new")}>
            change
          </button>
        </>
      );
    }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Parent />);
    expect((screen.getByLabelText(/search residents/i) as HTMLInputElement).value).toBe("initial");
    await user.click(screen.getByRole("button", { name: "change" }));
    await waitFor(() => {
      expect((screen.getByLabelText(/search residents/i) as HTMLInputElement).value).toBe("new");
    });
  });
});
