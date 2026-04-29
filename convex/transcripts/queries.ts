import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

export const getByIdInternal = internalQuery({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, { transcriptId }) => {
    return await ctx.db.get(transcriptId);
  },
});

export const getByDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, { docId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("transcripts")
      .withIndex("by_doc", (q) => q.eq("docId", docId))
      .first();
  },
});
