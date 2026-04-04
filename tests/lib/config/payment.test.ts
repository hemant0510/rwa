import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { getPaymentFeatureConfig } from "@/lib/config/payment";

describe("getPaymentFeatureConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("upiQrEnabled", () => {
    it("is always true regardless of env vars", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      const config = getPaymentFeatureConfig();
      expect(config.upiQrEnabled).toBe(true);
    });

    it("is true even when Razorpay is configured", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.upiQrEnabled).toBe(true);
    });
  });

  describe("razorpayGatewayEnabled", () => {
    it("is false when no env vars set", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      const config = getPaymentFeatureConfig();
      expect(config.razorpayGatewayEnabled).toBe(false);
    });

    it("is false when only KEY_ID is set", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      delete process.env.RAZORPAY_KEY_SECRET;
      const config = getPaymentFeatureConfig();
      expect(config.razorpayGatewayEnabled).toBe(false);
    });

    it("is false when only KEY_SECRET is set", () => {
      delete process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayGatewayEnabled).toBe(false);
    });

    it("is true when both KEY_ID and KEY_SECRET are set", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayGatewayEnabled).toBe(true);
    });

    it("is false when KEY_ID is empty string", () => {
      process.env.RAZORPAY_KEY_ID = "";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayGatewayEnabled).toBe(false);
    });

    it("is false when KEY_SECRET is empty string", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayGatewayEnabled).toBe(false);
    });
  });

  describe("razorpayMode", () => {
    it("is null when Razorpay is not configured", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      const config = getPaymentFeatureConfig();
      expect(config.razorpayMode).toBeNull();
    });

    it("is 'live' when KEY_ID starts with rzp_live_", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_live_abcdef";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayMode).toBe("live");
    });

    it("is 'test' when KEY_ID starts with rzp_test_", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abcdef";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayMode).toBe("test");
    });

    it("is 'test' when KEY_ID does not start with rzp_live_", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_unknown_xyz";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      const config = getPaymentFeatureConfig();
      expect(config.razorpayMode).toBe("test");
    });
  });

  describe("razorpaySubscriptionBillingEnabled", () => {
    it("is false when Razorpay is not configured", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_SUBSCRIPTION_ENABLED;
      const config = getPaymentFeatureConfig();
      expect(config.razorpaySubscriptionBillingEnabled).toBe(false);
    });

    it("is false when Razorpay is configured but SUBSCRIPTION_ENABLED is not set", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      delete process.env.RAZORPAY_SUBSCRIPTION_ENABLED;
      const config = getPaymentFeatureConfig();
      expect(config.razorpaySubscriptionBillingEnabled).toBe(false);
    });

    it("is false when Razorpay is configured but SUBSCRIPTION_ENABLED is 'false'", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      process.env.RAZORPAY_SUBSCRIPTION_ENABLED = "false";
      const config = getPaymentFeatureConfig();
      expect(config.razorpaySubscriptionBillingEnabled).toBe(false);
    });

    it("is true when Razorpay is configured and SUBSCRIPTION_ENABLED is 'true'", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      process.env.RAZORPAY_SUBSCRIPTION_ENABLED = "true";
      const config = getPaymentFeatureConfig();
      expect(config.razorpaySubscriptionBillingEnabled).toBe(true);
    });

    it("is false when SUBSCRIPTION_ENABLED is 'true' but Razorpay keys are missing", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.RAZORPAY_SUBSCRIPTION_ENABLED = "true";
      const config = getPaymentFeatureConfig();
      expect(config.razorpaySubscriptionBillingEnabled).toBe(false);
    });
  });

  describe("complete config shape", () => {
    it("returns all four keys in the response", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_SUBSCRIPTION_ENABLED;
      const config = getPaymentFeatureConfig();
      expect(config).toHaveProperty("upiQrEnabled");
      expect(config).toHaveProperty("razorpayGatewayEnabled");
      expect(config).toHaveProperty("razorpaySubscriptionBillingEnabled");
      expect(config).toHaveProperty("razorpayMode");
    });

    it("returns correct shape for live mode with subscription enabled", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_live_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      process.env.RAZORPAY_SUBSCRIPTION_ENABLED = "true";
      const config = getPaymentFeatureConfig();
      expect(config).toEqual({
        upiQrEnabled: true,
        razorpayGatewayEnabled: true,
        razorpaySubscriptionBillingEnabled: true,
        razorpayMode: "live",
      });
    });

    it("returns correct shape for test mode without subscription", () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
      process.env.RAZORPAY_KEY_SECRET = "secret";
      delete process.env.RAZORPAY_SUBSCRIPTION_ENABLED;
      const config = getPaymentFeatureConfig();
      expect(config).toEqual({
        upiQrEnabled: true,
        razorpayGatewayEnabled: true,
        razorpaySubscriptionBillingEnabled: false,
        razorpayMode: "test",
      });
    });

    it("returns correct shape when no Razorpay keys", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_SUBSCRIPTION_ENABLED;
      const config = getPaymentFeatureConfig();
      expect(config).toEqual({
        upiQrEnabled: true,
        razorpayGatewayEnabled: false,
        razorpaySubscriptionBillingEnabled: false,
        razorpayMode: null,
      });
    });
  });
});
