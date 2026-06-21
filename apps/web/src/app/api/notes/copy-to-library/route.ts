// POST { sourceStorageKey, fileName, format, mimeType?, title? }
// → copy file media của note (R2) sang key tài liệu mới + tạo document. Thay convex copyNoteFileToLibrary.
import { NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceStorageKey, fileName, format, mimeType, title } = (await request.json()) as {
    sourceStorageKey: string; fileName: string; format: string; mimeType?: string; title?: string;
  };
  if (!sourceStorageKey || !fileName || !format) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const r2 = getR2Client();
  // Đọc file nguồn (media của note)
  const getRes = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: sourceStorageKey }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of getRes.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  // Ghi sang key mới dưới prefix của user
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${user.id}/${Date.now()}-${safe}`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType ?? "application/octet-stream",
  }));

  // Tạo document (RLS check userId = auth.uid())
  const now = Date.now();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      userId: user.id,
      title: title ?? fileName.replace(/\.[^/.]+$/, ""),
      format,
      fileSizeBytes: buffer.byteLength,
      storageBackend: "r2",
      storageKey: key,
      status: "ready",
      createdAt: now,
      updatedAt: now,
    })
    .select("_id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  // Trích text cho FTS — fire-and-forget (không chặn response)
  void fetch(new URL("/api/documents/extract", request.url), {
    method: "POST",
    headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify({ docId: data._id }),
  }).catch(() => {});

  return NextResponse.json({ docId: data._id });
}
