import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";
import { internal } from "../_generated/api";

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

async function deleteDocRelatedData(ctx: any, docId: any, userId: any) {
  const results = await Promise.all([
    ctx.db.query("document_tags").withIndex("by_doc", (q: any) => q.eq("docId", docId)).collect(),
    ctx.db.query("document_folders").withIndex("by_doc", (q: any) => q.eq("docId", docId)).collect(),
    ctx.db.query("transcripts").withIndex("by_doc", (q: any) => q.eq("docId", docId)).collect(),
    ctx.db.query("highlights").withIndex("by_doc", (q: any) => q.eq("docId", docId)).collect(),
    ctx.db.query("reading_progress").withIndex("by_user_doc", (q: any) => q.eq("userId", userId).eq("docId", docId)).collect(),
    ctx.db.query("reading_history").withIndex("by_user_doc_opened", (q: any) => q.eq("userId", userId).eq("docId", docId)).collect(),
    ctx.db.query("notes").withIndex("by_user_doc", (q: any) => q.eq("userId", userId).eq("docId", docId)).collect(),
  ]);
  for (const rows of results) {
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

export const deleteAllTrashed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const trashed = await ctx.db
      .query("documents")
      .withIndex("by_user_status", (q) => q.eq("userId", userId as never).eq("status", "trashed"))
      .collect();

    for (const doc of trashed) {
      await deleteDocRelatedData(ctx, doc._id, userId as never);

      if (doc.storageBackend === "convex") {
        try { await ctx.storage.delete(doc.storageKey as never); } catch {}
      } else if (doc.storageBackend === "r2") {
        await ctx.scheduler.runAfter(0, internal.documents.actions.deleteFromStorage, {
          storageBackend: "r2",
          storageKey: doc.storageKey,
        });
      }
      await ctx.db.delete(doc._id);
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

    await deleteDocRelatedData(ctx, args.docId, userId as never);

    if (doc.storageBackend === "convex") {
      try { await ctx.storage.delete(doc.storageKey as never); } catch {}
    } else if (doc.storageBackend === "r2") {
      await ctx.scheduler.runAfter(0, internal.documents.actions.deleteFromStorage, {
        storageBackend: "r2",
        storageKey: doc.storageKey,
      });
    }

    await ctx.db.delete(args.docId);
  },
});

