import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

const USER_TABLES = [
  "documents", "transcripts", "folders", "document_folders",
  "document_tags", "document_shares", "highlights", "notes",
  "reading_history", "reading_progress", "tags", "tabs",
  "sessions", "upload_sessions", "mutation_log", "sync_conflicts",
  "telemetry_events", "error_logs",
] as const;

export const deleteAllUserData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    if (!user) return;

    const userId = user._id;

    for (const table of USER_TABLES) {
      const rows = await (ctx.db.query(table as never) as any)
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    // Xóa user cuối cùng
    await ctx.db.delete(userId);
  },
});

export const updateReadingModePreferences = mutation({
  args: {
    fontFamily: v.optional(v.union(v.literal("serif"), v.literal("sans"), v.literal("mono"))),
    fontSize: v.optional(v.number()),
    lineHeight: v.optional(v.number()),
    columnWidth: v.optional(v.union(v.literal("narrow"), v.literal("medium"), v.literal("wide"))),
    themeByFormat: v.optional(v.record(v.string(), v.union(v.literal("light"), v.literal("sepia"), v.literal("dark")))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Try by subject (_id) first, fallback to email
    let user = await ctx.db.get(identity.subject as Id<"users">).catch(() => null);
    if (!user && identity.email) {
      user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", identity.email as string)).first();
    }
    if (!user) throw new Error("User not found");

    const existing = user.preferences?.readingMode ?? {};
    const newThemeByFormat = args.themeByFormat
      ? { ...(existing.themeByFormat ?? {}), ...args.themeByFormat }
      : existing.themeByFormat;

    await ctx.db.patch(user._id, {
      preferences: {
        ...user.preferences,
        readingMode: {
          ...existing,
          ...(args.fontFamily !== undefined ? { fontFamily: args.fontFamily } : {}),
          ...(args.fontSize !== undefined ? { fontSize: Math.min(28, Math.max(12, args.fontSize)) } : {}),
          ...(args.lineHeight !== undefined ? { lineHeight: Math.min(2.0, Math.max(1.4, args.lineHeight)) } : {}),
          ...(args.columnWidth !== undefined ? { columnWidth: args.columnWidth } : {}),
          ...(newThemeByFormat !== undefined ? { themeByFormat: newThemeByFormat } : {}),
        },
      },
    });
  },
});
