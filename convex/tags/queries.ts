import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    return await ctx.db
      .query("tags")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
  },
});

export const listByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tags")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as never))
      .collect();
  },
});

export const listForDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const docTags = await ctx.db
      .query("document_tags")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();
    const tags = await Promise.all(docTags.map((dt) => ctx.db.get(dt.tagId)));
    return tags.filter(
      (t): t is NonNullable<typeof t> => t !== null && t.userId === (userId as never),
    );
  },
});
