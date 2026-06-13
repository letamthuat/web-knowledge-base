import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";
import { internal } from "../_generated/api";
import { deleteDocumentCascade } from "../lib/cascade";

export const patchExtractedText = internalMutation({
  args: {
    docId: v.id("documents"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.docId, {
      extractedText: args.text.slice(0, 500_000),
      updatedAt: Date.now(),
    });
  },
});

export const finalizeUpload = mutation({
  args: {
    title: v.string(),
    format: v.union(
      v.literal("pdf"), v.literal("epub"), v.literal("docx"),
      v.literal("pptx"), v.literal("image"), v.literal("audio"),
      v.literal("video"), v.literal("markdown"), v.literal("web_clip"),
    ),
    fileSizeBytes: v.optional(v.number()),
    durationMs: v.optional(v.number()),
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
      durationMs: args.durationMs,
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

    // Schedule text extraction for search indexing
    await ctx.scheduler.runAfter(0, internal.documents.actions.extractText, { docId });

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

export const deleteAllTrashed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const trashed = await ctx.db
      .query("documents")
      .withIndex("by_user_status", (q) => q.eq("userId", userId as never).eq("status", "trashed"))
      .collect();

    for (const doc of trashed) {
      await deleteDocumentCascade(ctx, doc, userId as never);
    }
    return trashed.length;
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

    await deleteDocumentCascade(ctx, doc, userId as never);
  },
});

