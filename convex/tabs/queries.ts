import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const tabs = await ctx.db
      .query("tabs")
      .withIndex("by_user_order", (q) => q.eq("userId", userId as never))
      .collect();
    return tabs;
  },
});
