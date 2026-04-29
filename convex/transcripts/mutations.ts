import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Tạo URL để upload audio chunk tạm lên Convex Storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

// Tạo hoặc reset transcript record (trạng thái pending)
export const initTranscript = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, { docId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email as string))
      .first();
    if (!user) throw new Error("User not found");

    // Xóa transcript cũ nếu có
    const existing = await ctx.db
      .query("transcripts")
      .withIndex("by_doc", (q) => q.eq("docId", docId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    return await ctx.db.insert("transcripts", {
      docId,
      userId: user._id,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Lưu segments sau khi transcribe xong
export const saveSegments = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    segments: v.array(v.object({
      start: v.number(),
      end: v.number(),
      text: v.string(),
    })),
    language: v.optional(v.string()),
    translatedSegments: v.optional(v.array(v.object({
      start: v.number(),
      end: v.number(),
      text: v.string(),
    }))),
    translatedLanguage: v.optional(v.string()),
  },
  handler: async (ctx, { transcriptId, segments, language, translatedSegments, translatedLanguage }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.patch(transcriptId, {
      status: "completed",
      segments,
      language,
      ...(translatedSegments ? { translatedSegments, translatedLanguage } : {}),
      updatedAt: Date.now(),
    });
  },
});

// Cập nhật trạng thái processing / error
export const updateStatus = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    status: v.union(v.literal("processing"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { transcriptId, status, errorMessage }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    await ctx.db.patch(transcriptId, {
      status,
      ...(errorMessage ? { errorMessage } : {}),
      updatedAt: Date.now(),
    });
  },
});
