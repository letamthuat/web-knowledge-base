import { query } from "../_generated/server";
import { v } from "convex/values";

export const listByDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    return ctx.db
      .query("highlights")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", userId as never).eq("docId", args.docId)
      )
      .collect();
  },
});
