import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const recentHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const limit = args.limit ?? 10;
    const rows = await ctx.db
      .query("reading_progress")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId as never))
      .order("desc")
      .take(limit);
    // Join with documents
    const results = await Promise.all(
      rows.map(async (row) => {
        const doc = await ctx.db.get(row.docId);
        if (!doc || doc.status === "trashed") return null;
        return { progress: row, doc };
      })
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const listByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("reading_progress")
      .withIndex("by_user_updated", (q) => q.eq("userId", args.userId as never))
      .collect();
  },
});

export const getByDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    return await ctx.db
      .query("reading_progress")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", userId as never).eq("docId", args.docId)
      )
      .first();
  },
});
