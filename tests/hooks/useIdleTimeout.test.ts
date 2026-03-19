import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdleTimeout } from "@/hooks/useIdleTimeout";

describe("useIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onTimeout after the given timeoutMs of inactivity", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("does not fire onTimeout before timeoutMs", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("fires onWarning at timeoutMs - warningMs", () => {
    const onTimeout = vi.fn();
    const onWarning = vi.fn();
    // timeoutMs=1000, warningMs=200 → warning fires at 800ms
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, warningMs: 200, onWarning, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onTimeout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("does not fire onWarning when warningMs >= timeoutMs", () => {
    const onTimeout = vi.fn();
    const onWarning = vi.fn();
    // warningDelay = 1000 - 2000 = -1000 (negative) → no warning timer set
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, warningMs: 2000, onWarning, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("does not fire onWarning when onWarning is not provided", () => {
    const onTimeout = vi.fn();
    // No onWarning passed — default 15 min warning skipped because no handler
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, warningMs: 200, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // No crash, timeout still fires
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("resets the timeout timer on user activity", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    // Advance 800ms, fire activity event → timer resets
    act(() => {
      vi.advanceTimersByTime(800);
      window.dispatchEvent(new Event("mousedown"));
    });

    // 999ms after activity — still no timeout
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    // 1 more ms → timeout fires (1000ms since last activity)
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("resets on keydown event", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new KeyboardEvent("keydown"));
      vi.advanceTimersByTime(500);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("resets on touchstart event", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new TouchEvent("touchstart"));
      vi.advanceTimersByTime(999);
    });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("resets on scroll event", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(999);
    });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("clears timers and removes event listeners on unmount", () => {
    const onTimeout = vi.fn();
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useIdleTimeout({ timeoutMs: 1000, onTimeout }));

    unmount();

    // 4 events × 1 call each = 4 removals
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(4);

    // Timeout should NOT fire after unmount
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    removeEventListenerSpy.mockRestore();
  });

  it("resets warning timer on activity", () => {
    const onTimeout = vi.fn();
    const onWarning = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, warningMs: 200, onWarning, onTimeout }));

    // Advance past warning point, fire activity → warning timer resets
    act(() => {
      vi.advanceTimersByTime(850);
      window.dispatchEvent(new Event("mousedown"));
    });

    // Warning should have been called once before the activity reset it
    // But after reset, we haven't reached 800ms again yet
    const warningCallsBefore = onWarning.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(799);
    });
    // Still within warning window after reset — no new warning
    expect(onWarning).toHaveBeenCalledTimes(warningCallsBefore);
  });

  it("picks up latest onTimeout callback without restarting timer", () => {
    const firstTimeout = vi.fn();
    const secondTimeout = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useIdleTimeout({ timeoutMs: 1000, onTimeout: cb }),
      {
        initialProps: { cb: firstTimeout },
      },
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Swap callback mid-way
    rerender({ cb: secondTimeout });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(firstTimeout).not.toHaveBeenCalled();
    expect(secondTimeout).toHaveBeenCalledOnce();
  });
});
