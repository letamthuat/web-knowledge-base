import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";

// Màu auto-assign cho tag mới
const TAG_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export const create = mutation({
  args: { name: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = args.name.trim();
    if (!name) throw convexError("VALIDATION", "Tag name required", "Tên tag không được trống");

    // Check duplicate
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) => q.eq("userId", userId as never).eq("name", name))
      .first();
    if (existing) return existing._id;

    const color = args.color ?? TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    return await ctx.db.insert("tags", {
      userId: userId as never,
      name,
      color,
      createdAt: Date.now(),
    });
  },
});

export const addToDoc = mutation({
  args: { docId: v.id("documents"), tagId: v.id("tags") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // Idempotent — check duplicate
    const existing = await ctx.db
      .query("document_tags")
      .withIndex("by_doc_tag", (q) => q.eq("docId", args.docId).eq("tagId", args.tagId))
      .first();
    if (existing) return;
    await ctx.db.insert("document_tags", {
      userId: userId as never,
      docId: args.docId,
      tagId: args.tagId,
      createdAt: Date.now(),
    });
  },
});

export const removeFromDoc = mutation({
  args: { docId: v.id("documents"), tagId: v.id("tags") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const existing = await ctx.db
      .query("document_tags")
      .withIndex("by_doc_tag", (q) => q.eq("docId", args.docId).eq("tagId", args.tagId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const createAndAddToDoc = mutation({
  args: { docId: v.id("documents"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = args.name.trim();
    if (!name) throw convexError("VALIDATION", "Tag name required", "Tên tag không được trống");

    // Tạo hoặc lấy tag hiện có
    let tagId: string;
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) => q.eq("userId", userId as never).eq("name", name))
      .first();

    if (existing) {
      tagId = existing._id;
    } else {
      const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      tagId = await ctx.db.insert("tags", {
        userId: userId as never,
        name,
        color,
        createdAt: Date.now(),
      });
    }

    // Add to doc (idempotent)
    const dtExisting = await ctx.db
      .query("document_tags")
      .withIndex("by_doc_tag", (q) => q.eq("docId", args.docId).eq("tagId", tagId as never))
      .first();
    if (!dtExisting) {
      await ctx.db.insert("document_tags", {
        userId: userId as never,
        docId: args.docId,
        tagId: tagId as never,
        createdAt: Date.now(),
      });
    }

    return tagId;
  },
});
