"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const CONVEX_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export const requestUploadUrl = action({
  args: {
    fileSizeBytes: v.number(),
    format: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args): Promise<{
    storageBackend: "convex" | "r2";
    uploadUrl: string;
    storageKey: string;
    contentType?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    if (args.fileSizeBytes <= CONVEX_MAX_BYTES) {
      // Convex storage path
      const uploadUrl = await ctx.storage.generateUploadUrl();
      return {
        storageBackend: "convex",
        uploadUrl,
        storageKey: "", // sẽ được điền sau khi upload xong từ Convex storage response
      };
    } else {
      // R2 path — presigned PUT URL (single-part cho simplicity, multipart cho >100MB sau)
      const r2 = getR2Client();
      const bucket = process.env.R2_BUCKET_NAME!;
      const key = `${identity.subject}/${Date.now()}-${args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      // Tạo presigned PUT URL cho upload
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentLength: args.fileSizeBytes,
      });
      const uploadUrl = await getSignedUrl(r2, putCommand, { expiresIn: 900 }); // 15 phút

      return {
        storageBackend: "r2",
        uploadUrl,
        storageKey: key,
      };
    }
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
