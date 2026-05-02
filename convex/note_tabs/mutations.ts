import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const openTab = mutation({
  args: { noteId: v.id("notes"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("note_tabs")
      .withIndex("by_user_note", (q) =>
        q.eq("userId", userId as never).eq("noteId", args.noteId)
      )
      .first();

    if (existing) {
      const allTabs = await ctx.db
        .query("note_tabs")
        .withIndex("by_user", (q) => q.eq("userId", userId as never))
        .collect();
      await Promise.all(
        allTabs
          .filter((t) => t._id !== existing._id && t.isActive)
          .map((t) => ctx.db.patch(t._id, { isActive: false }))
      );
      await ctx.db.patch(existing._id, { isActive: true, title: args.title, updatedAt: now });
      return existing._id;
    }

    const allTabs = await ctx.db
      .query("note_tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();

    await Promise.all(
      allTabs.filter((t) => t.isActive).map((t) => ctx.db.patch(t._id, { isActive: false }))
    );

    const maxOrder = allTabs.reduce((max, t) => Math.max(max, t.order), -1);
    return ctx.db.insert("note_tabs", {
      userId: userId as never,
      noteId: args.noteId,
      title: args.title,
      order: maxOrder + 1,
      isActive: true,
      updatedAt: now,
    });
  },
});

export const closeTab = mutation({
  args: { noteTabId: v.id("note_tabs") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const tab = await ctx.db.get(args.noteTabId);
    if (!tab || tab.userId !== (userId as never)) return;
    await ctx.db.delete(args.noteTabId);

    if (tab.isActive) {
      const remaining = await ctx.db
        .query("note_tabs")
        .withIndex("by_user", (q) => q.eq("userId", userId as never))
        .collect();
      if (remaining.length > 0) {
        const next = remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        await ctx.db.patch(next._id, { isActive: true, updatedAt: Date.now() });
      }
    }
  },
});

export const setActive = mutation({
  args: { noteTabId: v.id("note_tabs") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const tab = await ctx.db.get(args.noteTabId);
    if (!tab || tab.userId !== (userId as never)) return;

    const allTabs = await ctx.db
      .query("note_tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();

    await Promise.all(
      allTabs
        .filter((t) => t._id !== args.noteTabId && t.isActive)
        .map((t) => ctx.db.patch(t._id, { isActive: false }))
    );
    await ctx.db.patch(args.noteTabId, { isActive: true, updatedAt: Date.now() });
  },
});

export const updateTitle = mutation({
  args: { noteTabId: v.id("note_tabs"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const tab = await ctx.db.get(args.noteTabId);
    if (!tab || tab.userId !== (userId as never)) return;
    await ctx.db.patch(args.noteTabId, { title: args.title, updatedAt: Date.now() });
  },
});
