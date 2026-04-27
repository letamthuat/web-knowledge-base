import { httpRouter } from "convex/server";
import { betterAuth } from "./auth";
import { betterAuth as createBetterAuth } from "better-auth";
import { convexAdapter } from "@convex-dev/better-auth";
import { convex as convexPlugin } from "@convex-dev/better-auth/plugins";

const http = httpRouter();

betterAuth.registerRoutes(http, (ctx) =>
  createBetterAuth({
    baseURL: process.env["CONVEX_SITE_URL"],
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env["NEXT_PUBLIC_APP_URL"] ?? "",
    ].filter(Boolean),
    database: convexAdapter(ctx, betterAuth),
    plugins: [convexPlugin()],
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env["AUTH_GOOGLE_ID"] ?? "",
        clientSecret: process.env["AUTH_GOOGLE_SECRET"] ?? "",
      },
    },
  })
);

export default http;
