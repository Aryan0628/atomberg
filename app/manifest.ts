import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AtomQuest — Goal Setting & Tracking Portal",
    short_name: "AtomQuest",
    description: "In-house goal setting and performance tracking portal for Atomberg Technologies.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1D4ED8",
    orientation: "portrait-primary",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/docs/screenshots/employee-dashboard.png", sizes: "1280x800", type: "image/png", label: "Employee Dashboard" },
      { src: "/docs/screenshots/admin-analytics.png", sizes: "1280x800", type: "image/png", label: "Admin Analytics" },
    ],
  };
}
