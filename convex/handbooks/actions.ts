"use node";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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

// Trả map relPath → presigned URL cho mọi ảnh trong handbook (resolver markdown 12.4)
export const getAssetUrls = action({
  args: { handbookId: v.id("handbooks") },
  handler: async (ctx, args): Promise<Record<string, string>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const assets = await ctx.runQuery(internal.handbooks.queries.listAssetsInternal, {
      handbookId: args.handbookId,
      userId: identity.subject,
    });

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;
    const out: Record<string, string> = {};
    await Promise.all(
      assets.map(async (a) => {
        try {
          if (a.storageBackend === "convex") {
            const url = await ctx.storage.getUrl(a.storageKey as never);
            if (url) out[a.relPath] = url;
          } else {
            const cmd = new GetObjectCommand({ Bucket: bucket, Key: a.storageKey });
            out[a.relPath] = await getSignedUrl(r2, cmd, { expiresIn: 3600 });
          }
        } catch { /* skip lỗi từng ảnh */ }
      })
    );
    return out;
  },
});
