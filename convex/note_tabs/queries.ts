import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return ctx.db
      .query("note_tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
  },
});
