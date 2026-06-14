import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";
import { deleteDocumentCascade } from "../lib/cascade";

export const create = mutation({
  args: { name: v.string(), parentFolderId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = args.name.trim();
    if (!name) throw convexError("VALIDATION", "Folder name required", "Tên folder không được trống");
    const now = Date.now();
    return await ctx.db.insert("folders", {
      userId: userId as never,
      name,
      parentFolderId: args.parentFolderId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const assignDoc = mutation({
  args: { docId: v.id("documents"), folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // 1 doc chỉ có 1 folder — xoá row cũ
    const existing = await ctx.db
      .query("document_folders")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert("document_folders", {
      userId: userId as never,
      docId: args.docId,
      folderId: args.folderId,
      createdAt: Date.now(),
    });
  },
});

export const removeDoc = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const existing = await ctx.db
      .query("document_folders")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

async function deleteFolderRecursively(ctx: any, folderId: any, userId: string) {
  // 1. Tìm tất cả tài liệu trong folder này
  const docFolders = await ctx.db
    .query("document_folders")
    .withIndex("by_folder", (q: any) => q.eq("folderId", folderId))
    .collect();

  for (const df of docFolders) {
    const doc = await ctx.db.get(df.docId);
    if (doc) {
      await deleteDocumentCascade(ctx, doc, userId);
    } else {
      const mapping = await ctx.db.get(df._id);
      if (mapping) await ctx.db.delete(df._id);
    }
  }

  // 2. Tìm tất cả subfolder con
  const subFolders = await ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q: any) =>
      q.eq("userId", userId as never).eq("parentFolderId", folderId)
    )
    .collect();

  for (const sf of subFolders) {
    await deleteFolderRecursively(ctx, sf._id, userId);
  }

  // 3. Xoá chính folder hiện tại
  await ctx.db.delete(folderId);
}

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Folder not found", "Không tìm thấy folder");
    }
    await deleteFolderRecursively(ctx, args.folderId, userId);
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Folder not found", "Không tìm thấy folder");
    }
    await ctx.db.patch(args.folderId, { name: args.name.trim(), updatedAt: Date.now() });
  },
});
