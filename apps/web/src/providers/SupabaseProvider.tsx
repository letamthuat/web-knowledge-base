"use client";
// Thay ConvexClientProvider. Không cần React context — supabase client là singleton,
// route protection do middleware lo. Provider này chỉ giữ chỗ + có thể mở rộng sau.
import { ReactNode } from "react";

export function SupabaseProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
