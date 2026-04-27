import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const getByDoc = query({
  args: { docId: v.id("documents"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("reading_history")
      .withIndex("by_user_doc_opened", (q) =>
        q.eq("userId", userId as never).eq("docId", args.docId)
      )
      .order("desc")
      .take(limit);
  },
});
