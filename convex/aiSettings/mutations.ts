import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Upsert AI settings cho current user
export const saveAiSettings = mutation({
  args: {
    geminiApiKey: v.optional(v.string()),
    geminiModels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { geminiApiKey, geminiModels }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email as string))
      .first();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("userAiSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(geminiApiKey !== undefined ? { geminiApiKey } : {}),
        ...(geminiModels !== undefined ? { geminiModels } : {}),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userAiSettings", {
        userId: user._id,
        geminiApiKey,
        geminiModels,
        updatedAt: Date.now(),
      });
    }
  },
});
