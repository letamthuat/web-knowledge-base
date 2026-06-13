import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";
import { deleteDocumentCascade } from "../lib/cascade";

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    throw convexError("VALIDATION", "Name must be 1-100 chars", "Tên phải từ 1-100 ký tự");
  }
  return trimmed;
}

export const create = mutation({
  args: { name: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = validateName(args.name);
    const now = Date.now();

    const existing = await ctx.db
      .query("domains")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    const order = existing.reduce((m, d) => Math.max(m, d.order), -1) + 1;

    return await ctx.db.insert("domains", {
      userId: userId as never,
      name,
      color: args.color,
      order,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { domainId: v.id("domains"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const domain = await ctx.db.get(args.domainId);
    if (!domain || domain.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Domain not found", "Không tìm thấy domain");
    }
    await ctx.db.patch(args.domainId, { name: validateName(args.name), updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const domain = await ctx.db.get(args.domainId);
    if (!domain || domain.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Domain not found", "Không tìm thấy domain");
    }

    const handbooks = await ctx.db
      .query("handbooks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();

    for (const hb of handbooks) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_handbook", (q) => q.eq("handbookId", hb._id))
        .collect();
      for (const doc of docs) {
        await deleteDocumentCascade(ctx, doc, userId as never);
      }
      await ctx.db.delete(hb._id);
    }

    await ctx.db.delete(args.domainId);
  },
});
