// POST { handbookId } → map relPath → presigned GET URL cho mọi ảnh trong handbook.
// Thay convex handbooks.actions.getAssetUrls (resolver markdown 12.4).
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { handbookId } = (await request.json()) as { handbookId?: string };
  if (!handbookId) return NextResponse.json({ error: "Missing handbookId" }, { status: 400 });

  // RLS giới hạn theo user.
  const { data: assets } = await supabase
    .from("documents")
    .select("relPath, storageKey")
    .eq("handbookId", handbookId)
    .eq("format", "image")
    .eq("status", "ready")
    .not("relPath", "is", null);

  const r2 = getR2Client();
  const out: Record<string, string> = {};
  await Promise.all(
    ((assets ?? []) as { relPath: string; storageKey: string }[]).map(async (a) => {
      try {
        out[a.relPath] = await getSignedUrl(
          r2,
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: a.storageKey }),
          { expiresIn: 3600 },
        );
      } catch { /* skip ảnh lỗi */ }
    }),
  );

  return NextResponse.json({ urls: out });
}
