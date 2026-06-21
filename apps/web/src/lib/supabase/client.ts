// Supabase client cho BROWSER (Client Components).
// Dùng publishable key — an toàn ở browser vì RLS đã bật mọi bảng.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

// Singleton tiện dùng trong hook/component
export const supabase = createClient();
