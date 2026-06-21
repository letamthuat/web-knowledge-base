// POST { docId } hoặc { storageKey } → presigned GET URL trên R2 (thay convex getDownloadUrl).
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { docId?: string; storageKey?: string };

  let storageKey = body.storageKey;
  if (!storageKey && body.docId) {
    // RLS đảm bảo chỉ lấy được doc của chính user
    const { data: doc } = await supabase
      .from("documents")
      .select("storageKey")
      .eq("_id", body.docId)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    storageKey = doc.storageKey;
  }
  if (!storageKey) return NextResponse.json({ error: "Missing storageKey" }, { status: 400 });

  const r2 = getR2Client();
  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }),
    { expiresIn: 3600 },
  );

  return NextResponse.json({ url });
}
