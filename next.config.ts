import type { NextConfig } from "next";

// GitHub Actions automatically sets GITHUB_ACTIONS=true in CI.
// Apply static-export settings only there — local dev stays at localhost:3015/dashboard.
const isCI = process.env.GITHUB_ACTIONS === "true";

// Allow network IP access for dev — set ALLOWED_DEV_ORIGINS in .env.local
const envOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((o) => o.trim())
  : [];

const allowedDevOrigins = Array.from(
  new Set([
    ...envOrigins,
    "192.168.31.97",
    "172.20.10.2",
    "192.168.31.165",
    "localhost",
    "127.0.0.1",
  ])
);

const nextConfig: NextConfig = {
  ...(isCI && {
    output: "export",
    basePath: "/bji-dawati-brothers",
    assetPrefix: "/bji-dawati-brothers/",
    trailingSlash: true,
  }),
  allowedDevOrigins,
  transpilePackages: ["lucide-react", "react-icons"],
  devIndicators: false,
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;

