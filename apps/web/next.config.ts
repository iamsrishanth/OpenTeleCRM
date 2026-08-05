import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin dev resources by default; the smoke browser
  // hits the app via 127.0.0.1 while chunks load from localhost — allow both.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
