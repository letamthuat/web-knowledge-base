import { query } from "../_generated/server";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    const tabs = await ctx.db
      .query("tabs")
      .withIndex("by_user_order", (q) => q.eq("userId", userId as never))
      .collect();

    // Join docTitle + docFormat so TabBar doesn't need N separate subscriptions
    return Promise.all(
      tabs.map(async (tab) => {
        const doc = await ctx.db.get(tab.docId);
        return {
          ...tab,
          docTitle: doc?.title ?? "Untitled",
          docFormat: doc?.format ?? "unknown",
        };
      })
    );
  },
});
