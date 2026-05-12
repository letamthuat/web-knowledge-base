import { query } from "../_generated/server";

// Lấy AI settings của current user
export const getAiSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email as string))
      .first();
    if (!user) return null;

    const settings = await ctx.db
      .query("userAiSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return settings ?? null;
  },
});
