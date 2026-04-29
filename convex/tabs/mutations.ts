import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";

const MAX_TABS = 10;

export const openTab = mutation({
  args: {
    docId: v.id("documents"),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    // Idempotent: if docId already open, just activate it
    const existing = await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .filter((q) => q.eq(q.field("docId"), args.docId))
      .first();

    if (existing) {
      // Deactivate all, activate this one
      const allTabs = await ctx.db
        .query("tabs")
        .withIndex("by_user", (q) => q.eq("userId", userId as never))
        .collect();
      await Promise.all(
        allTabs
          .filter((t) => t._id !== existing._id && t.isActive)
          .map((t) => ctx.db.patch(t._id, { isActive: false }))
      );
      await ctx.db.patch(existing._id, { isActive: true, updatedAt: now });
      return existing._id;
    }

    // Check limit
    const allTabs = await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    if (allTabs.length >= MAX_TABS) {
      throw convexError("VALIDATION", "Max 10 tabs allowed", "Tối đa 10 tab cùng lúc");
    }

    // Deactivate all current tabs
    await Promise.all(
      allTabs.filter((t) => t.isActive).map((t) => ctx.db.patch(t._id, { isActive: false }))
    );

    const maxOrder = allTabs.reduce((max, t) => Math.max(max, t.order), -1);
    const tabId = await ctx.db.insert("tabs", {
      userId: userId as never,
      docId: args.docId,
      order: maxOrder + 1,
      isActive: true,
      updatedAt: now,
      clientMutationId: args.clientMutationId,
    });
    return tabId;
  },
});

export const closeTab = mutation({
  args: { tabId: v.id("tabs") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Tab not found", "Không tìm thấy tab");
    }

    await ctx.db.delete(args.tabId);

    // If closed tab was active, activate the most recently updated remaining tab
    if (tab.isActive) {
      const remaining = await ctx.db
        .query("tabs")
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
  args: { tabId: v.id("tabs") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Tab not found", "Không tìm thấy tab");
    }

    const allTabs = await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();

    await Promise.all(
      allTabs
        .filter((t) => t._id !== args.tabId && t.isActive)
        .map((t) => ctx.db.patch(t._id, { isActive: false }))
    );
    await ctx.db.patch(args.tabId, { isActive: true, updatedAt: Date.now() });
  },
});

export const reorderTabs = mutation({
  args: {
    orders: v.array(v.object({ tabId: v.id("tabs"), order: v.number() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    await Promise.all(
      args.orders.map(async ({ tabId, order }) => {
        const tab = await ctx.db.get(tabId);
        // Skip tabs that don't belong to this user
        if (!tab || tab.userId !== (userId as never)) return;
        await ctx.db.patch(tabId, { order, updatedAt: now });
      })
    );
  },
});

export const closeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const allTabs = await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    await Promise.all(allTabs.map((t) => ctx.db.delete(t._id)));
    return allTabs.map((t) => ({ docId: t.docId, order: t.order }));
  },
});

export const updateScrollState = mutation({
  args: {
    tabId: v.id("tabs"),
    scrollState: v.string(),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Tab not found", "Không tìm thấy tab");
    }

    // Idempotency: same clientMutationId → no-op
    if (args.clientMutationId && tab.clientMutationId === args.clientMutationId) return;

    await ctx.db.patch(args.tabId, {
      scrollState: args.scrollState,
      updatedAt: Date.now(),
      clientMutationId: args.clientMutationId,
    });
  },
});
