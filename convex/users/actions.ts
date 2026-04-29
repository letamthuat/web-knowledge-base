"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

export const deleteAccount = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Lấy tất cả documents của user để xóa file R2
    const docs = await ctx.runQuery(internal.users.queries.getAllDocsByUser, {});

    // Xóa từng file trên R2
    const r2 = getR2Client();
    for (const doc of docs) {
      if (doc.storageBackend === "r2" && doc.storageKey) {
        try {
          await r2.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: doc.storageKey,
          }));
        } catch {
          // Bỏ qua lỗi xóa file riêng lẻ
        }
      }
    }

    // Xóa toàn bộ data trong DB
    await ctx.runMutation(internal.users.mutations.deleteAllUserData, {});
  },
});
