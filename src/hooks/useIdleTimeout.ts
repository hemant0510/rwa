"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseIdleTimeoutOptions {
  /** Total ms of inactivity before onTimeout fires */
  timeoutMs: number;
  /** Ms before timeout to fire onWarning (default: 15 min) */
  warningMs?: number;
  onWarning?: () => void;
  onTimeout: () => void;
}

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;
const DEFAULT_WARNING_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Tracks user inactivity and fires callbacks at warning and timeout thresholds.
 * Listens to mousedown, keydown, touchstart, and scroll to detect activity.
 * Designed for admin sessions (8h timeout) — not used for resident sessions.
 */
export function useIdleTimeout({
  timeoutMs,
  warningMs = DEFAULT_WARNING_MS,
  onWarning,
  onTimeout,
}: UseIdleTimeoutOptions): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs so resetTimers closure always sees the latest callbacks
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onWarningRef.current = onWarning;
  });

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (warningRef.current !== null) clearTimeout(warningRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    const warningDelay = timeoutMs - warningMs;
    if (warningDelay > 0 && onWarning) {
      warningRef.current = setTimeout(() => {
        onWarningRef.current?.();
      }, warningDelay);
    }

    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, timeoutMs);
  }, [timeoutMs, warningMs, onWarning, clearTimers]);

  useEffect(() => {
    resetTimers();

    const handleActivity = () => resetTimers();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [resetTimers, clearTimers]);
}
