import type { NextConfig } from "next";

// GitHub Actions automatically sets GITHUB_ACTIONS=true in CI.
// Apply static-export settings only there — local dev stays at localhost:3015/dashboard.
const isCI = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  ...(isCI && {
    output: "export",
    basePath: "/bji-dawati-brothers",
    assetPrefix: "/bji-dawati-brothers/",
    trailingSlash: true,
  }),
  images: {
    unoptimized: true, // required for static export
  },
};

export default nextConfig;

