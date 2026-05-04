import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getAllDocsByUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    if (!user) return [];
    return ctx.db.query("documents").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
  },
});

export const getPreferencesBySubject = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userId as never))
      .first();
    // Try by subject if email lookup fails (Better Auth stores subject as userId)
    if (!user) {
      const bySubject = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("name"), args.userId))
        .first();
      return bySubject?.preferences ?? null;
    }
    return user.preferences ?? null;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email as string))
      .first();
    return user ?? null;
  },
});
