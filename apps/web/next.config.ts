import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin dev resources by default; the smoke browser
  // hits the app via 127.0.0.1 while chunks load from localhost — allow both,
  // plus the LAN IP (192.168.29.240), the Tailnet IP (100.84.197.35), the
  // tailnet hostname, and the Cloudflare tunnel hostname the operator uses
  // from other devices / the public web.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.29.240",
    "100.84.197.35",
    "zeus-server.parrot-anaconda.ts.net",
    "crm.srishanth.com",
  ],
  // Security headers (CSP, HSTS, frame/type protection). The app stores a
  // 1-year API token in localStorage (see auth-context), so a strict CSP is
  // the main blunt-force mitigation against XSS token exfiltration.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:3005 http://127.0.0.1:3005 http://192.168.29.240:3005 http://100.84.197.35:3005 http://*.ts.net:3005 https://api.srishanth.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
