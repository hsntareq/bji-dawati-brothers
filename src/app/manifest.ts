import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const isCI = process.env.GITHUB_ACTIONS === "true";
  const basePath = isCI ? "/bji-dawati-brothers" : "";

  return {
    name: "BJI Dawati Brothers - জামায়াতের সহযোগী",
    short_name: "Dawati Brothers",
    description: "Call Center & Dawati Activity Management System",
    start_url: `${basePath}/dashboard/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#6366f1",
    orientation: "portrait",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: `${basePath}/icons/icon-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-maskable-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
