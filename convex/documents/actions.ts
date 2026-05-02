"use node";
import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
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

export const getBackupData = action({
  args: {},
  handler: async (ctx): Promise<{
    docs: { id: string; title: string; format: string; createdAt: number; downloadUrl: string }[];
    notes: { id: string; title: string; body: string; docTitle: string | null; updatedAt: number }[];
    highlights: { docId: string; docTitle: string; text: string; note: string | null; createdAt: number }[];
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;

    // Fetch all docs
    const allDocs = await ctx.runQuery(internal.documents.queries.listByUserInternal, { userId });
    const r2 = getR2Client();

    // Generate presigned download URLs for each doc
    const docs = await Promise.all(allDocs.map(async (doc) => {
      let downloadUrl = "";
      try {
        const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: doc.storageKey });
        downloadUrl = await getSignedUrl(r2, cmd, { expiresIn: 3600 });
      } catch {}
      return { id: doc._id, title: doc.title, format: doc.format, createdAt: doc.createdAt, downloadUrl };
    }));

    // Fetch all notes
    const allNotes = await ctx.runQuery(internal.notes.queries.listAllByUserInternal, { userId });
    const notes = allNotes.map((n) => ({
      id: n._id,
      title: n.title,
      body: n.body,
      docTitle: n.docTitle ?? null,
      updatedAt: n.updatedAt,
    }));

    // Fetch highlights for all docs
    const highlightRows: { docId: string; docTitle: string; text: string; note: string | null; createdAt: number }[] = [];
    for (const doc of allDocs) {
      const hl = await ctx.runQuery(internal.highlights.queries.listByDocInternal, { userId, docId: doc._id });
      for (const h of hl) {
        highlightRows.push({ docId: doc._id, docTitle: doc.title, text: h.selectedText ?? "", note: h.note ?? null, createdAt: h.createdAt });
      }
    }

    return { docs, notes, highlights: highlightRows };
  },
});

export const copyNoteFileToLibrary = action({
  args: {
    sourceStorageKey: v.string(),
    fileName: v.string(),
    format: v.string(),
    mimeType: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME!;

    // Read from note media storage key using SDK (no CORS issue)
    const getRes = await r2.send(new GetObjectCommand({
      Bucket: bucket,
      Key: args.sourceStorageKey,
    }));

    const chunks: Uint8Array[] = [];
    for await (const chunk of getRes.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Write to new key in same bucket (under user's doc prefix)
    const key = `${identity.subject}/${Date.now()}-${args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: args.mimeType ?? "application/octet-stream",
    }));

    const docId = await ctx.runMutation(api.documents.mutations.finalizeUpload, {
      title: args.title ?? args.fileName.replace(/\.[^/.]+$/, ""),
      format: args.format as never,
      fileSizeBytes: buffer.byteLength,
      storageBackend: "r2",
      storageKey: key,
    });

    return docId;
  },
});

export const deleteFromStorage = internalAction({
  args: {
    storageBackend: v.union(v.literal("convex"), v.literal("r2"), v.literal("b2")),
    storageKey: v.string(),
  },
  handler: async (_ctx, args): Promise<void> => {
    if (args.storageBackend === "r2") {
      const r2 = getR2Client();
      await r2.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: args.storageKey,
      }));
    }
  },
});
