import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";

export const create = mutation({
  args: {
    docId: v.id("documents"),
    color: v.union(v.literal("yellow"), v.literal("green"), v.literal("blue"), v.literal("pink"), v.literal("purple"), v.literal("custom")),
    customColor: v.optional(v.string()),
    positionType: v.string(),
    positionValue: v.string(),
    selectedText: v.optional(v.string()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("highlights", {
      userId: userId as never,
      docId: args.docId,
      color: args.color,
      customColor: args.customColor,
      type: "text",
      positionType: args.positionType as never,
      positionValue: args.positionValue,
      selectedText: args.selectedText,
      updatedAt: now,
      createdAt: now,
      clientMutationId: args.clientMutationId,
    });
    return id;
  },
});

export const updateNote = mutation({
  args: {
    highlightId: v.id("highlights"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight || highlight.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Highlight not found", "Không tìm thấy highlight");
    }
    await ctx.db.patch(args.highlightId, { note: args.note, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { highlightId: v.id("highlights") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const highlight = await ctx.db.get(args.highlightId);
    if (!highlight || highlight.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Highlight not found", "Không tìm thấy highlight");
    }
    await ctx.db.delete(args.highlightId);
  },
});
