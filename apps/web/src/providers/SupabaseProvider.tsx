"use client";
// Thay ConvexClientProvider. Route protection do middleware lo.
// NHIỆM VỤ QUAN TRỌNG: đẩy JWT của user vào socket Realtime (realtime.setAuth).
// RLS bật → postgres_changes chỉ gửi cho socket có token; không set thì UI không
// nhận realtime (phải reload mới thấy thay đổi).
import { ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { setRealtimeToken } from "@/lib/supabase/realtime";

export function SupabaseProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Set token hiện tại (nếu đã đăng nhập) ngay khi mount → channel realtime join có auth.
    supabase.auth.getSession().then(({ data }) => {
      setRealtimeToken(data.session?.access_token ?? null);
    });
    // Cập nhật token mỗi khi đăng nhập / refresh / đăng xuất.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setRealtimeToken(session?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
