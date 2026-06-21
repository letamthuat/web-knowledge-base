// POST { fileName } → presigned PUT URL trên R2 (thay convex requestUploadUrl).
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileName } = (await request.json()) as { fileName: string };
  const safe = (fileName ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${user.id}/${Date.now()}-${safe}`;

  const r2 = getR2Client();
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 3600 },
  );

  return NextResponse.json({ storageBackend: "r2", uploadUrl, storageKey: key });
}
