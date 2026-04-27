import { query } from "../_generated/server";
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
