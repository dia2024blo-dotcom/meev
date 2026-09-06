import type { NextConfig } from "next";

// ============================================================
// v13 security pass — baseline security headers for every response
// (the "big-site" minimum: anti-clickjacking, MIME-sniffing guard,
// referrer trimming, plugin lockdown + a same-origin CSP).
//
// CSP notes (deliberately dev-safe):
//  - script-src needs 'unsafe-inline' + 'unsafe-eval' for the Next.js dev
//    overlay / fast refresh; this still blocks every THIRD-PARTY script.
//  - connect-src allows ws:/wss: for the realtime socket (:3003) and blob:
//    for the TTS audio player.
//  - img-src/media-src include data:/blob: for canvas snapshots + TTS blobs.
//  - When a real CSP nonce pipeline lands, tighten script-src accordingly.
// ============================================================
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

// (Task 7 note) @prisma/client was regenerated on disk after the dev server
// had already cached the old module — this comment change nudges `next dev`
// into its own config-reload self-restart so the fresh client is loaded.
const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // v16 code protection for hosted production builds: no browser source
  // maps (visitors can't un-minify the bundles) and no framework banner.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
// v3 prisma client reload trigger — coinLog/DMConversation v3 columns
// v3 prisma reload trigger 2 — coinLog/dm v3/user v3
// v3 hardening reload trigger 3 — user.lastHeartbeatAt (task 12-c)
// v3 cosmetics reload trigger 4 — globals.css meev-legend-text (task 12-b)
// v5 owner/admin/verified/customStatus/ban-columns reload trigger (task 15)
// v6 DMConversation.aReadAt/bReadAt read-receipts reload trigger (task 16)
// v13 security-pass reload trigger (headers() + env reload nudge)
