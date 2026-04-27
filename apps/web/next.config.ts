import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@convex": path.resolve(__dirname, "../../convex"),
    };
    return config;
  },
  // Cloudflare Pages via OpenNext adapter — xem wrangler.toml
  // Strict mode cho React 19
  reactStrictMode: true,
  // Tắt x-powered-by header
  poweredByHeader: false,
  // CSP và security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "connect-src 'self' *.convex.cloud *.convex.site wss://*.convex.cloud *.r2.cloudflarestorage.com *.resend.com",
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
