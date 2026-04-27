import { internalMutation } from "../_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const pruneTrashedDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const trashed = await ctx.db
      .query("documents")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "trashed"),
          q.lt(q.field("trashedAt"), cutoff),
        ),
      )
      .collect();

    for (const doc of trashed) {
      // Xoá tags liên quan
      const docTags = await ctx.db
        .query("document_tags")
        .withIndex("by_doc", (q) => q.eq("docId", doc._id))
        .collect();
      for (const dt of docTags) await ctx.db.delete(dt._id);

      // Xoá folder liên quan
      const docFolders = await ctx.db
        .query("document_folders")
        .withIndex("by_doc", (q) => q.eq("docId", doc._id))
        .collect();
      for (const df of docFolders) await ctx.db.delete(df._id);

      // Xoá file Convex storage
      if (doc.storageBackend === "convex" && doc.storageKey) {
        try {
          await ctx.storage.delete(doc.storageKey as never);
        } catch {
          // Ignore
        }
      }

      await ctx.db.delete(doc._id);
    }
  },
});

export const pruneExpiredUploadSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("upload_sessions")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();

    for (const session of expired) {
      await ctx.db.patch(session._id, { status: "aborted", updatedAt: now });
    }
  },
});
