import type { NextConfig } from "next";

// GitHub Actions automatically sets GITHUB_ACTIONS=true in CI.
// Apply static-export settings only there — local dev stays at localhost:3015/dashboard.
const isCI = process.env.GITHUB_ACTIONS === "true";

// Allow network IP access for dev — set ALLOWED_DEV_ORIGINS in .env.local
// e.g. ALLOWED_DEV_ORIGINS=192.168.1.100,192.168.1.101
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((o) => o.trim())
  : [];

const nextConfig: NextConfig = {
  ...(isCI && {
    output: "export",
    basePath: "/bji-dawati-brothers",
    assetPrefix: "/bji-dawati-brothers/",
    trailingSlash: true,
  }),
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
  devIndicators: false,
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;

