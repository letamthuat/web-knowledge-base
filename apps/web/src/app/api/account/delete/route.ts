// POST → xoá tài khoản hiện tại + toàn bộ dữ liệu (cascade qua FK userId ON DELETE CASCADE).
// Thay convex users.actions.deleteAccount. Cần service_role để xoá auth user.
// (File R2 mồ côi dọn ở cron Phase 4.)
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
