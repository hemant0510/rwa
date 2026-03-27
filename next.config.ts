import { withSentryConfig } from "@sentry/nextjs";

import type { NextConfig } from "next";

const SENTRY_INGEST = "https://*.sentry.io";

const securityHeaders = [
  // Prevent clickjacking — no iframing of any page
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy XSS filter (belt-and-suspenders for older browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Send origin only on same-origin requests, no referrer to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Content Security Policy
  // - 'unsafe-inline' required for Tailwind + Next.js inline styles
  // - 'unsafe-eval' required for Next.js dev mode; review removal in production
  // - connect-src covers Supabase REST + Realtime (wss) and Sentry ingest
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co"} wss://*.supabase.co ${SENTRY_INGEST}`,
      "frame-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Document proxy API — allow embedding in same-origin iframes
        source: "/api/v1/societies/:id/petitions/:petitionId/document",
        headers: securityHeaders
          .filter((h) => h.key !== "X-Frame-Options" && h.key !== "Content-Security-Policy")
          .concat([
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          ]),
      },
      {
        // All other routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry project settings (set in CI/CD environment):
  //   SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
  silent: true,
  // Upload source maps only in production CI
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
  // Disable the Sentry webpack plugin telemetry
  telemetry: false,
});
