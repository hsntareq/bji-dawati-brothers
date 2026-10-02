import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // Static HTML export for GitHub Pages
  basePath: "/bji-dawati-brothers", // Must match GitHub repo name
  assetPrefix: "/bji-dawati-brothers/",
  images: {
    unoptimized: true,       // Next.js image optimization needs a server
  },
  trailingSlash: true,       // Ensures /dashboard/ resolves correctly on static host
};

export default nextConfig;

