import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const listHandbooks = query({
  args: { domainId: v.optional(v.id("domains")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const all = await ctx.db
      .query("handbooks")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    const filtered = args.domainId
      ? all.filter((h) => h.domainId === args.domainId)
      : all;
    return filtered.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  },
});

// Files (documents) trong 1 handbook — kèm progressPct để dựng icon trạng thái (13.2)
export const listHandbookFiles = query({
  args: { handbookId: v.id("handbooks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const handbook = await ctx.db.get(args.handbookId);
    if (!handbook || handbook.userId !== (userId as never)) return [];

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_handbook", (q) => q.eq("handbookId", args.handbookId))
      .collect();

    const ready = docs.filter((d) => d.status === "ready");

    return await Promise.all(
      ready.map(async (d) => {
        const progress = await ctx.db
          .query("reading_progress")
          .withIndex("by_user_doc", (q) =>
            q.eq("userId", userId as never).eq("docId", d._id)
          )
          .first();
        return {
          docId: d._id,
          relPath: d.relPath ?? d.title,
          format: d.format,
          title: d.title,
          progressPct: progress?.progressPct ?? null,
        };
      })
    );
  },
});

export const getByIdInternal = internalQuery({
  args: { handbookId: v.id("handbooks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.handbookId);
  },
});

// Internal: ảnh (format=image) trong handbook — để action presign URL (resolver 12.4)
export const listAssetsInternal = internalQuery({
  args: { handbookId: v.id("handbooks"), userId: v.string() },
  handler: async (ctx, args) => {
    const hb = await ctx.db.get(args.handbookId);
    if (!hb || hb.userId !== (args.userId as never)) return [];
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_handbook", (q) => q.eq("handbookId", args.handbookId))
      .collect();
    return docs
      .filter((d) => d.format === "image" && d.status === "ready" && d.relPath)
      .map((d) => ({ relPath: d.relPath as string, storageKey: d.storageKey, storageBackend: d.storageBackend }));
  },
});
