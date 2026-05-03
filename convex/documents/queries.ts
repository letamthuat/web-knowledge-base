import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    return await ctx.db
      .query("documents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as never).eq("status", "ready"),
      )
      .order("desc")
      .collect();
  },
});

export const listTrashed = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    return await ctx.db
      .query("documents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as never).eq("status", "trashed"),
      )
      .order("desc")
      .collect();
  },
});

export const getStorageStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const [ready, trashed, notes] = await Promise.all([
      ctx.db.query("documents").withIndex("by_user_status", (q) => q.eq("userId", userId as never).eq("status", "ready")).collect(),
      ctx.db.query("documents").withIndex("by_user_status", (q) => q.eq("userId", userId as never).eq("status", "trashed")).collect(),
      ctx.db.query("notes").withIndex("by_user", (q) => q.eq("userId", userId as never)).collect(),
    ]);

    const allDocs = [...ready, ...trashed];
    const r2Bytes = allDocs.filter((d) => d.storageBackend === "r2").reduce((s, d) => s + (d.fileSizeBytes ?? 0), 0);
    const convexFileBytes = allDocs.filter((d) => d.storageBackend === "convex").reduce((s, d) => s + (d.fileSizeBytes ?? 0), 0);
    const noteBodyBytes = notes.reduce((s, n) => s + (n.body?.length ?? 0) * 2, 0); // UTF-16 approx

    return {
      docCount: ready.length,
      trashedCount: trashed.length,
      noteCount: notes.length,
      r2Bytes,
      convexFileBytes,
      convexDbBytes: noteBodyBytes, // approximate DB usage from notes
    };
  },
});

export const getById = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== (userId as never)) return null;
    return doc;
  },
});

export const getByIdInternal = internalQuery({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.docId);
  },
});

export const search = query({
  args: {
    q: v.string(),
    format: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    if (args.q.length < 2) return [];

    const [byContent, byTitle] = await Promise.all([
      ctx.db
        .query("documents")
        .withSearchIndex("search_content", (q) =>
          q.search("extractedText", args.q).eq("userId", userId as never).eq("status", "ready")
        )
        .take(10),
      ctx.db
        .query("documents")
        .withSearchIndex("search_title", (q) =>
          q.search("title", args.q).eq("userId", userId as never).eq("status", "ready")
        )
        .take(10),
    ]);

    // Dedup by _id, content results first
    const seen = new Set<string>();
    const results = [];
    for (const doc of [...byContent, ...byTitle]) {
      if (!seen.has(doc._id)) {
        seen.add(doc._id);
        results.push(doc);
      }
    }
    return results.slice(0, 10);
  },
});

export const listByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("documents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId as never).eq("status", "ready"),
      )
      .collect();
  },
});
