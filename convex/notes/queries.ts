import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const listByDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .filter((q) => q.eq(q.field("docId"), args.docId))
      .order("desc")
      .collect();
  },
});
