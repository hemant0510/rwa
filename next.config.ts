import type { NextConfig } from "next";

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
  // - connect-src covers Supabase REST + Realtime (wss) endpoints
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co"} wss://*.supabase.co`,
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
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
