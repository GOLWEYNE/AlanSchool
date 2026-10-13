import type { MetadataRoute } from "next";

// Makes the dashboard installable as an app (Android: "Install app", iOS:
// Share -> Add to Home Screen) so duty push notifications work on phones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alan International School",
    short_name: "Alan School",
    description: "School dashboard with duty reminders",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
