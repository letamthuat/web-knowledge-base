import { query } from "../_generated/server";
import { v } from "convex/values";

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
