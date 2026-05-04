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
    // Join document title+format so clients need only one query instead of N per-tab queries
    return Promise.all(
      tabs.map(async (tab) => {
        const doc = await ctx.db.get(tab.docId);
        return { ...tab, docTitle: doc?.title ?? null, docFormat: doc?.format ?? null };
      })
    );
  },
});
