import { query } from "../_generated/server";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    return ctx.db
      .query("tabs")
      .withIndex("by_user_order", (q) => q.eq("userId", userId as never))
      .collect();
  },
});
