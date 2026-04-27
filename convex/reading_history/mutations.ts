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

export const recordOpen = mutation({
  args: {
    docId: v.id("documents"),
    positionType: v.optional(positionType),
    positionValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Rate-limit: chỉ insert nếu chưa có entry trong 1 giờ qua cho doc này
    const recent = await ctx.db
      .query("reading_history")
      .withIndex("by_user_doc_opened", (q) =>
        q.eq("userId", userId as never).eq("docId", args.docId)
      )
      .order("desc")
      .first();

    if (recent && now - recent.openedAt < oneHour) return;

    await ctx.db.insert("reading_history", {
      userId: userId as never,
      docId: args.docId,
      openedAt: now,
      positionType: args.positionType,
      positionValue: args.positionValue,
    });
  },
});
