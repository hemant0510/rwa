// src/lib/config/payment.ts
// UPI QR flow only. Razorpay flags are false until Razorpay env vars are configured
// (see online_payment_razorpay.md).

export interface PaymentFeatureConfig {
  upiQrEnabled: boolean;
  razorpayGatewayEnabled: boolean;
  razorpaySubscriptionBillingEnabled: boolean;
  razorpayMode: "test" | "live" | null;
}

export function getPaymentFeatureConfig(): PaymentFeatureConfig {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? "";
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const razorpayEnabled = razorpayKeyId.length > 0 && razorpayKeySecret.length > 0;

  return {
    upiQrEnabled: true, // always true; toggled per-society by whether society.upiId is set
    razorpayGatewayEnabled: razorpayEnabled,
    razorpaySubscriptionBillingEnabled:
      razorpayEnabled && (process.env.RAZORPAY_SUBSCRIPTION_ENABLED ?? "") === "true",
    razorpayMode: razorpayEnabled
      ? razorpayKeyId.startsWith("rzp_live_")
        ? "live"
        : "test"
      : null,
  };
}
