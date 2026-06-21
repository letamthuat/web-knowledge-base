// GET → query nhẹ vào Postgres để giữ Supabase free-tier không bị pause (7 ngày idle).
// Gọi bởi Vercel Cron (xem vercel.json) — không cần auth.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServiceClient();
    // Đếm head-only, không kéo data — chỉ để tạo hoạt động DB.
    await supabase.from("profiles").select("id", { count: "exact", head: true });
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
