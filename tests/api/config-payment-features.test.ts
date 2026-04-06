import { describe, it, expect, vi, beforeEach } from "vitest";

import { GET } from "@/app/api/v1/config/payment-features/route";

describe("GET /api/v1/config/payment-features", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns upiQrEnabled: true always", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.upiQrEnabled).toBe(true);
  });

  it("returns razorpayGatewayEnabled: false when no env vars set", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpayGatewayEnabled).toBe(false);
    expect(body.razorpaySubscriptionBillingEnabled).toBe(false);
    expect(body.razorpayMode).toBeNull();
  });

  it("returns razorpayGatewayEnabled: true when both Razorpay keys set", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret123");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpayGatewayEnabled).toBe(true);
  });

  it("returns razorpayMode: test when using test key", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret123");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpayMode).toBe("test");
  });

  it("returns razorpayMode: live when using live key", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret123");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpayMode).toBe("live");
  });

  it("returns razorpaySubscriptionBillingEnabled: true when subscription env set", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret123");
    vi.stubEnv("RAZORPAY_SUBSCRIPTION_ENABLED", "true");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpaySubscriptionBillingEnabled).toBe(true);
  });

  it("returns razorpaySubscriptionBillingEnabled: false when subscription env not set", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret123");
    vi.stubEnv("RAZORPAY_SUBSCRIPTION_ENABLED", "false");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpaySubscriptionBillingEnabled).toBe(false);
  });

  it("returns 200 status", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns razorpayGatewayEnabled: false when only key id is set", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    const res = await GET();
    const body = await res.json();
    expect(body.razorpayGatewayEnabled).toBe(false);
    expect(body.razorpayMode).toBeNull();
  });
});
