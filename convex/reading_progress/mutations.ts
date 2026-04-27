import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

const positionType = v.union(
  v.literal("pdf_page"),
  v.literal("epub_cfi"),
  v.literal("time_seconds"),
  v.literal("scroll_pct"),
  v.literal("slide_index"),
);

export const upsert = mutation({
  args: {
    docId: v.id("documents"),
    positionType: positionType,
    positionValue: v.string(),
    progressPct: v.optional(v.number()),
    clientMutationId: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const existing = await ctx.db
      .query("reading_progress")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", userId as never).eq("docId", args.docId)
      )
      .first();

    if (existing) {
      // Idempotency: same clientMutationId → no-op
      if (existing.clientMutationId === args.clientMutationId) return;
      // LWW: skip if server record is newer
      if (existing.updatedAt >= args.updatedAt) return;
      await ctx.db.patch(existing._id, {
        positionType: args.positionType,
        positionValue: args.positionValue,
        progressPct: args.progressPct,
        updatedAt: args.updatedAt,
        clientMutationId: args.clientMutationId,
      });
    } else {
      await ctx.db.insert("reading_progress", {
        userId: userId as never,
        docId: args.docId,
        positionType: args.positionType,
        positionValue: args.positionValue,
        progressPct: args.progressPct,
        updatedAt: args.updatedAt,
        clientMutationId: args.clientMutationId,
      });
    }
  },
});
