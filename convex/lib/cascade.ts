import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * Xóa toàn bộ dữ liệu phụ thuộc của 1 document (tags, folders, transcripts,
 * highlights, reading_progress, reading_history, notes).
 * Tách từ documents/mutations.ts để dùng chung cho xóa document, handbook, domain.
 */
export async function deleteDocRelatedData(
  ctx: MutationCtx,
  docId: Doc<"documents">["_id"],
  userId: string,
) {
  const results = await Promise.all([
    ctx.db.query("document_tags").withIndex("by_doc", (q) => q.eq("docId", docId)).collect(),
    ctx.db.query("document_folders").withIndex("by_doc", (q) => q.eq("docId", docId)).collect(),
    ctx.db.query("transcripts").withIndex("by_doc", (q) => q.eq("docId", docId)).collect(),
    ctx.db.query("highlights").withIndex("by_doc", (q) => q.eq("docId", docId)).collect(),
    ctx.db.query("reading_progress").withIndex("by_user_doc", (q) => q.eq("userId", userId as never).eq("docId", docId)).collect(),
    ctx.db.query("reading_history").withIndex("by_user_doc_opened", (q) => q.eq("userId", userId as never).eq("docId", docId)).collect(),
    ctx.db.query("notes").withIndex("by_user_doc", (q) => q.eq("userId", userId as never).eq("docId", docId)).collect(),
  ]);
  for (const rows of results) {
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

/**
 * Xóa hoàn toàn 1 document: related data + file storage (R2 schedule / Convex) + bản ghi doc.
 */
export async function deleteDocumentCascade(
  ctx: MutationCtx,
  doc: Doc<"documents">,
  userId: string,
) {
  await deleteDocRelatedData(ctx, doc._id, userId);

  if (doc.storageBackend === "convex") {
    try { await ctx.storage.delete(doc.storageKey as never); } catch { /* ignore */ }
  } else if (doc.storageBackend === "r2") {
    await ctx.scheduler.runAfter(0, internal.documents.actions.deleteFromStorage, {
      storageBackend: "r2",
      storageKey: doc.storageKey,
    });
  }

  await ctx.db.delete(doc._id);
}
