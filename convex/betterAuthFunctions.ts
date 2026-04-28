import { betterAuth } from "./auth";

export const { createUser, createSession, updateUser, deleteUser, isAuthenticated } =
  betterAuth.createAuthFunctions({
    onCreateUser: async (ctx, user) => {
      console.log("[onCreateUser] called with:", JSON.stringify(user));
      try {
        const userId = await ctx.db.insert("users", {
          email: user.email,
          ...(user.name ? { name: user.name } : {}),
          ...(user.image ? { image: user.image } : {}),
          emailVerified: user.emailVerified,
          twoFactorEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        console.log("[onCreateUser] inserted userId:", userId);
        return userId;
      } catch (e) {
        console.error("[onCreateUser] ERROR:", e);
        throw e;
      }
    },
  });
