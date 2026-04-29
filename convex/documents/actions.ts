"use node";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export const requestUploadUrl = action({
  args: {
    fileSizeBytes: v.number(),
    format: v.string(),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    storageBackend: "convex" | "r2";
    uploadUrl: string;
    storageKey: string;
    contentType?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Tất cả file đều lên R2 — Convex Storage chỉ dùng cho database
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const key = `${identity.subject}/${Date.now()}-${args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const uploadUrl = await getSignedUrl(r2, putCommand, { expiresIn: 3600 });

    return {
      storageBackend: "r2",
      uploadUrl,
      storageKey: key,
    };
  },
});

export const generateDownloadUrl = action({
  args: {
    storageBackend: v.union(v.literal("convex"), v.literal("r2"), v.literal("b2")),
    storageKey: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.storageBackend === "convex") {
      const url = await ctx.storage.getUrl(args.storageKey as never);
      if (!url) throw new Error("File not found");
      return url;
    } else {
      // R2 presigned GET URL — expire 15 phút (NFR11)
      const r2 = getR2Client();
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: args.storageKey,
      });
      return await getSignedUrl(r2, command, { expiresIn: 900 });
    }
  },
});

export const getDownloadUrl = action({
  args: { docId: v.id("documents") },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const doc = await ctx.runQuery(internal.documents.queries.getByIdInternal, { docId: args.docId });
    if (!doc) throw new Error("Document not found");

    if (doc.storageBackend === "convex") {
      const url = await ctx.storage.getUrl(doc.storageKey as never);
      if (!url) throw new Error("File not found in storage");
      return url;
    } else {
      const r2 = getR2Client();
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: doc.storageKey,
      });
      return await getSignedUrl(r2, command, { expiresIn: 900 });
    }
  },
});

export const deleteFromStorage = action({
  args: {
    storageBackend: v.union(v.literal("convex"), v.literal("r2"), v.literal("b2")),
    storageKey: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.storageBackend === "r2") {
      const r2 = getR2Client();
      await r2.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: args.storageKey,
      }));
    }
    // Convex storage delete handled in mutation directly
  },
});
