"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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

/** Generate presigned PUT URL for note media (image/video/audio) uploaded to R2 */
export const requestNoteMediaUploadUrl = action({
  args: {
    fileName: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args): Promise<{ uploadUrl: string; storageKey: string }> => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      console.log("[requestNoteMediaUploadUrl] identity:", identity ? identity.subject : "NULL");
      if (!identity) throw new Error("Unauthorized — identity is null");

      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucket = process.env.R2_BUCKET_NAME;

      console.log("[requestNoteMediaUploadUrl] env:", {
        hasAccountId: !!accountId,
        hasAccessKey: !!accessKeyId,
        hasSecret: !!secretKey,
        hasBucket: !!bucket,
      });

      if (!accountId || !accessKeyId || !secretKey || !bucket) {
        throw new Error("Missing R2 environment variables");
      }

      const r2 = getR2Client();
      const sanitized = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `notes/${identity.subject}/${Date.now()}-${sanitized}`;

      const command = new PutObjectCommand({ Bucket: bucket, Key: key });
      const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

      console.log("[requestNoteMediaUploadUrl] success, key:", key);
      return { uploadUrl, storageKey: key };
    } catch (err) {
      console.error("[requestNoteMediaUploadUrl] CAUGHT ERROR:", String(err));
      throw err;
    }
  },
});

/** Generate presigned GET URL for note media stored in R2 (1 hour expiry) */
export const getNoteMediaUrl = action({
  args: { storageKey: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: args.storageKey,
    });
    return await getSignedUrl(r2, command, { expiresIn: 3600 });
  },
});
