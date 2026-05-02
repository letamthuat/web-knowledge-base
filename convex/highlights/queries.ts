import { query, internalQuery } from "../_generated/server";
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

export const listByDocInternal = internalQuery({
  args: { userId: v.string(), docId: v.id("documents") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("highlights")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", args.userId as never).eq("docId", args.docId)
      )
      .collect();
  },
});
