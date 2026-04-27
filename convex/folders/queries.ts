import { query } from "../_generated/server";
import { v } from "convex/values";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    return await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
  },
});

export const listDocsInFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const rows = await ctx.db
      .query("document_folders")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();
    const docs = await Promise.all(rows.map((r) => ctx.db.get(r.docId)));
    return docs.filter((d): d is NonNullable<typeof d> => d !== null && d.status === "ready");
  },
});

export const getFolderForDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const df = await ctx.db
      .query("document_folders")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .first();
    if (!df) return null;
    return await ctx.db.get(df.folderId);
  },
});
