import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const listByDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    return await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .filter((q) => q.eq(q.field("docId"), args.docId))
      .order("desc")
      .collect();
  },
});

export const listAllByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    return await Promise.all(
      notes.map(async (n) => ({
        ...n,
        docTitle: n.docId ? (await ctx.db.get(n.docId))?.title ?? null : null,
      }))
    );
  },
});

export const search = query({
  args: {
    q: v.string(),
    docId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    if (args.q.length < 2) return [];

    const results = await ctx.db
      .query("notes")
      .withSearchIndex("search_body", (q) => {
        const s = q.search("body", args.q).eq("userId", userId as never);
        return s;
      })
      .take(10);

    if (args.docId) {
      return results.filter((n) => n.docId === args.docId);
    }
    return results;
  },
});

export const listAllByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as never))
      .collect();
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    return Promise.all(
      notes.map(async (n) => ({
        ...n,
        docTitle: n.docId ? (await ctx.db.get(n.docId))?.title ?? null : null,
      }))
    );
  },
});
