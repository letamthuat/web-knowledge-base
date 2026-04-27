import { BetterAuth } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import { internal } from "./_generated/api";

// Khai báo type tường minh để tránh circular inference
export const betterAuth: BetterAuth<string> = new BetterAuth(components.betterAuth, {
  verbose: false,
  authFunctions: internal.betterAuthFunctions,
});
