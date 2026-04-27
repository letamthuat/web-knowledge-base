import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";

export const finalizeUpload = mutation({
  args: {
    title: v.string(),
    format: v.union(
      v.literal("pdf"), v.literal("epub"), v.literal("docx"),
      v.literal("pptx"), v.literal("image"), v.literal("audio"),
      v.literal("video"), v.literal("markdown"), v.literal("web_clip"),
    ),
    fileSizeBytes: v.optional(v.number()),
    storageBackend: v.union(v.literal("convex"), v.literal("r2"), v.literal("b2")),
    storageKey: v.string(),
    sourceUrl: v.optional(v.string()),
    uploadSessionId: v.optional(v.id("upload_sessions")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const docId = await ctx.db.insert("documents", {
      userId: userId as never,
      title: args.title,
      format: args.format,
      fileSizeBytes: args.fileSizeBytes,
      storageBackend: args.storageBackend,
      storageKey: args.storageKey,
      sourceUrl: args.sourceUrl,
      status: "ready",
      createdAt: now,
      updatedAt: now,
    });

    if (args.uploadSessionId) {
      await ctx.db.delete(args.uploadSessionId);
    }

    return docId;
  },
});

export const rename = mutation({
  args: {
    docId: v.id("documents"),
    newTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Document not found", "Không tìm thấy tài liệu");
    }
    const title = args.newTitle.trim();
    if (!title || title.length > 200) {
      throw convexError("VALIDATION", "Title must be 1-200 chars", "Tiêu đề phải từ 1-200 ký tự");
    }
    await ctx.db.patch(args.docId, { title, updatedAt: Date.now() });
  },
});

export const trash = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Document not found", "Không tìm thấy tài liệu");
    }
    await ctx.db.patch(args.docId, {
      status: "trashed",
      trashedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Document not found", "Không tìm thấy tài liệu");
    }
    await ctx.db.patch(args.docId, {
      status: "ready",
      trashedAt: undefined,
      restoredAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const deletePermanent = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Document not found", "Không tìm thấy tài liệu");
    }

    // Xoá document_tags liên quan
    const docTags = await ctx.db
      .query("document_tags")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();
    for (const dt of docTags) await ctx.db.delete(dt._id);

    // Xoá document_folders liên quan
    const docFolders = await ctx.db
      .query("document_folders")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();
    for (const df of docFolders) await ctx.db.delete(df._id);

    // Xoá file trong Convex storage nếu storageBackend là convex
    if (doc.storageBackend === "convex") {
      try {
        await ctx.storage.delete(doc.storageKey as never);
      } catch {
        // Ignore storage delete errors
      }
    }

    await ctx.db.delete(args.docId);
  },
});
