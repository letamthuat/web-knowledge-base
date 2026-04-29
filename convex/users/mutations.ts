import { internalMutation } from "../_generated/server";
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
