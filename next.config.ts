import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// CSP: unsafe-eval is required by Next.js/Turbopack in development.
// In production builds it is removed — tightening the attack surface.
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: "X-Frame-Options",          value: "DENY" },
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.upstash.io https://*.neon.tech wss:",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // Don't advertise Next.js version
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
