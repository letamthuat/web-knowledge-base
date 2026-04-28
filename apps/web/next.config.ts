import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  // Tắt x-powered-by header
  poweredByHeader: false,
  // CSP và security headers
  async headers() {
    return [
      {
        // ffmpeg wasm cần cross-origin isolation
        source: "/reader/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "connect-src 'self' *.convex.cloud *.convex.site wss://*.convex.cloud *.r2.cloudflarestorage.com *.resend.com unpkg.com *.unpkg.com",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.convex.cloud https://*.convex.site https://*.r2.cloudflarestorage.com",
              "media-src 'self' blob: https://*.convex.cloud https://*.convex.site https://*.r2.cloudflarestorage.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "frame-src 'self' blob:",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
