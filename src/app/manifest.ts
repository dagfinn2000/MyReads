import type { MetadataRoute } from "next";

/**
 * PWA web app manifest — makes the app installable on a phone home screen
 * (handy since barcode-scanning books is naturally a phone flow). Served at
 * /manifest.webmanifest; the middleware exempts it from auth.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyReads",
    short_name: "MyReads",
    description: "Self-hosted personal book library",
    start_url: "/books",
    display: "standalone",
    background_color: "#1e293b",
    theme_color: "#1e293b",
    // Long-press the home-screen icon → jump straight into bookstore mode.
    shortcuts: [
      {
        name: "Do I own this?",
        short_name: "Check",
        url: "/books/check",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Add a book",
        short_name: "Add",
        url: "/books/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
