import { betterAuth } from "./auth";

export const { createUser, createSession, updateUser, deleteUser, isAuthenticated } =
  betterAuth.createAuthFunctions({
    onCreateUser: async (ctx, user) => {
      const userId = await ctx.db.insert("users", {
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
        ...(user.image ? { image: user.image } : {}),
        emailVerified: user.emailVerified,
        twoFactorEnabled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return userId;
    },
  });
