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

export const listAllByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
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
