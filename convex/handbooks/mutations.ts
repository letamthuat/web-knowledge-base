import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { convexError } from "../lib/errors";
import { deleteDocumentCascade } from "../lib/cascade";
import { internal } from "../_generated/api";

const documentFormat = v.union(
  v.literal("pdf"), v.literal("epub"), v.literal("docx"), v.literal("pptx"),
  v.literal("image"), v.literal("audio"), v.literal("video"),
  v.literal("markdown"), v.literal("web_clip"),
);

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    throw convexError("VALIDATION", "Name must be 1-100 chars", "Tên phải từ 1-100 ký tự");
  }
  return trimmed;
}

async function requireHandbook(ctx: any, handbookId: any, userId: string) {
  const hb = await ctx.db.get(handbookId);
  if (!hb || hb.userId !== (userId as never)) {
    throw convexError("NOT_FOUND", "Handbook not found", "Không tìm thấy handbook");
  }
  return hb;
}

// ─── CRUD (12.2) ─────────────────────────────────────────────────────────────

export const create = mutation({
  args: { domainId: v.id("domains"), name: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const domain = await ctx.db.get(args.domainId);
    if (!domain || domain.userId !== (userId as never)) {
      throw convexError("NOT_FOUND", "Domain not found", "Không tìm thấy domain");
    }
    const name = validateName(args.name);
    const now = Date.now();

    const existing = await ctx.db
      .query("handbooks")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .collect();
    const order = existing.reduce((m, h) => Math.max(m, h.order), -1) + 1;

    return await ctx.db.insert("handbooks", {
      userId: userId as never,
      domainId: args.domainId,
      name,
      color: args.color,
      order,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { handbookId: v.id("handbooks"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await requireHandbook(ctx, args.handbookId, userId);
    await ctx.db.patch(args.handbookId, { name: validateName(args.name), updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { handbookId: v.id("handbooks") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await requireHandbook(ctx, args.handbookId, userId);

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_handbook", (q) => q.eq("handbookId", args.handbookId))
      .collect();
    for (const doc of docs) {
      await deleteDocumentCascade(ctx, doc, userId as never);
    }
    await ctx.db.delete(args.handbookId);
  },
});

// ─── ZIP import (12.3) ────────────────────────────────────────────────────────

export const finalizeImport = mutation({
  args: {
    handbookId: v.id("handbooks"),
    files: v.array(v.object({
      relPath: v.string(),
      storageKey: v.string(),
      format: documentFormat,
      fileSizeBytes: v.optional(v.number()),
      mimeType: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await requireHandbook(ctx, args.handbookId, userId);
    const now = Date.now();

    // relPath đã tồn tại trong handbook → tránh trùng
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_handbook", (q) => q.eq("handbookId", args.handbookId))
      .collect();
    const usedPaths = new Set(existing.map((d) => d.relPath ?? ""));

    let created = 0;
    let skipped = 0;
    for (const f of args.files) {
      const relPath = uniquePath(f.relPath, usedPaths);
      if (!relPath) { skipped++; continue; }
      usedPaths.add(relPath);

      const title = fileTitle(relPath);
      const docId = await ctx.db.insert("documents", {
        userId: userId as never,
        title,
        format: f.format,
        fileSizeBytes: f.fileSizeBytes,
        mimeType: f.mimeType,
        storageBackend: "r2",
        storageKey: f.storageKey,
        status: "ready",
        handbookId: args.handbookId,
        relPath,
        createdAt: now,
        updatedAt: now,
      });
      created++;
      // Schedule text extraction (search) cho định dạng đọc được
      await ctx.scheduler.runAfter(0, internal.documents.actions.extractText, { docId });
    }

    return { created, skipped };
  },
});

// ─── Folder ops (12.6) ──────────────────────────────────────────────────────

export const addEmptyFolder = mutation({
  args: { handbookId: v.id("handbooks"), prefix: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const hb = await requireHandbook(ctx, args.handbookId, userId);
    const prefix = normalizeFolderPrefix(args.prefix);
    if (!prefix) throw convexError("VALIDATION", "Invalid folder", "Tên folder không hợp lệ");
    const folders = new Set<string>((hb.emptyFolders ?? []) as string[]);
    folders.add(prefix);
    await ctx.db.patch(args.handbookId, { emptyFolders: [...folders], updatedAt: Date.now() });
  },
});

export const removeFolder = mutation({
  args: { handbookId: v.id("handbooks"), prefix: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const hb = await requireHandbook(ctx, args.handbookId, userId);
    const prefix = normalizeFolderPrefix(args.prefix);
    if (!prefix) throw convexError("VALIDATION", "Invalid folder", "Tên folder không hợp lệ");

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_handbook", (q) => q.eq("handbookId", args.handbookId))
      .collect();
    for (const doc of docs) {
      if ((doc.relPath ?? "").startsWith(prefix + "/")) {
        await deleteDocumentCascade(ctx, doc, userId as never);
      }
    }

    const folders = ((hb.emptyFolders ?? []) as string[]).filter(
      (p) => p !== prefix && !p.startsWith(prefix + "/")
    );
    await ctx.db.patch(args.handbookId, { emptyFolders: folders, updatedAt: Date.now() });
  },
});

export const renameFolder = mutation({
  args: {
    handbookId: v.id("handbooks"),
    oldPrefix: v.string(),
    newPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const hb = await requireHandbook(ctx, args.handbookId, userId);
    const oldPrefix = normalizeFolderPrefix(args.oldPrefix);
    const newPrefix = normalizeFolderPrefix(args.newPrefix);
    if (!oldPrefix || !newPrefix) {
      throw convexError("VALIDATION", "Invalid folder paths", "Đường dẫn thư mục không hợp lệ");
    }
    if (oldPrefix === newPrefix) return;

    // 1. Rename all documents starting with oldPrefix + "/"
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_handbook", (q) => q.eq("handbookId", args.handbookId))
      .collect();
    for (const doc of docs) {
      const path = doc.relPath ?? "";
      if (path.startsWith(oldPrefix + "/")) {
        const remaining = path.slice((oldPrefix + "/").length);
        const newPath = `${newPrefix}/${remaining}`;
        await ctx.db.patch(doc._id, {
          relPath: newPath,
          updatedAt: Date.now(),
        });
      }
    }

    // 2. Rename empty folders
    const currentFolders = (hb.emptyFolders ?? []) as string[];
    const updatedFolders = currentFolders.map((p) => {
      if (p === oldPrefix) {
        return newPrefix;
      }
      if (p.startsWith(oldPrefix + "/")) {
        return newPrefix + p.slice(oldPrefix.length);
      }
      return p;
    });

    // Remove duplicates
    const uniqueFolders = [...new Set(updatedFolders)];
    await ctx.db.patch(args.handbookId, {
      emptyFolders: uniqueFolders,
      updatedAt: Date.now(),
    });
  },
});

export const renameHandbookFile = mutation({
  args: {
    docId: v.id("documents"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.userId !== (userId as never) || !doc.handbookId) {
      throw convexError("NOT_FOUND", "Document not found in handbook", "Không tìm thấy tài liệu trong handbook");
    }

    const newName = args.newName.trim();
    if (!newName || newName.includes("/")) {
      throw convexError("VALIDATION", "Invalid file name", "Tên file không hợp lệ");
    }

    const path = doc.relPath ?? "";
    const segs = path.split("/");
    segs.pop(); // remove old name
    segs.push(newName);
    const newPath = segs.join("/");

    // Check uniqueness within the same handbook
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_handbook_path", (q) => q.eq("handbookId", doc.handbookId).eq("relPath", newPath))
      .first();
    if (existing && existing._id !== doc._id) {
      throw convexError("CONFLICT", "File already exists", "File đã tồn tại ở đường dẫn này");
    }

    const title = fileTitle(newName);
    await ctx.db.patch(args.docId, {
      relPath: newPath,
      title,
      updatedAt: Date.now(),
    });
  },
});

// ─── helpers ────────────────────────────────────────────────────────────────

function fileTitle(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.[^/.]+$/, "") || base;
}

function uniquePath(relPath: string, used: Set<string>): string | null {
  const clean = relPath.replace(/^\/+/, "").trim();
  if (!clean) return null;
  if (!used.has(clean)) return clean;
  // thêm hậu tố trước đuôi
  const m = clean.match(/^(.*?)(\.[^/.]+)?$/);
  const stem = m?.[1] ?? clean;
  const ext = m?.[2] ?? "";
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

function normalizeFolderPrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "").trim();
}
