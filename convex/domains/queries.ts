import { query } from "../_generated/server";

export const listDomains = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const rows = await ctx.db
      .query("domains")
      .withIndex("by_user_order", (q) => q.eq("userId", userId as never))
      .collect();
    return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  },
});
