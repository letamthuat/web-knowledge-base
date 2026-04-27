import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  // Dùng cùng domain với Next.js app — tránh cross-domain cookie issue
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3001",
  basePath: "/api/auth",
  plugins: [
    convexClient(),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
