import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 200 with status ok and a timestamp", async () => {
    const res = GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      status: "ok",
      ts: new Date("2026-04-21T00:00:00Z").getTime(),
    });
  });
});
