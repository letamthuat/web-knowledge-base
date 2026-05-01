import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";

export const create = mutation({
  args: {
    docId: v.optional(v.id("documents")),
    title: v.optional(v.string()),
    body: v.string(),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    return await ctx.db.insert("notes", {
      userId: userId as never,
      docId: args.docId,
      title: args.title,
      body: args.body,
      updatedAt: now,
      createdAt: now,
      clientMutationId: args.clientMutationId,
    });
  },
});

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Note not found", "Không tìm thấy ghi chú");
    }
    await ctx.db.patch(args.noteId, {
      title: args.title,
      body: args.body,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Note not found", "Không tìm thấy ghi chú");
    }
    await ctx.db.delete(args.noteId);
  },
});
