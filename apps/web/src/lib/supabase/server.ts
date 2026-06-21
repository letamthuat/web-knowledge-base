// Supabase client cho SERVER (Server Components, Route Handlers, Server Actions).
// Đọc/ghi session qua cookie Next.js.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Gọi từ Server Component (không set được cookie) — bỏ qua,
            // middleware sẽ refresh session.
          }
        },
      },
    },
  );
}

// Client quyền cao (service role) — CHỈ dùng trong route handler/server action tin cậy.
// KHÔNG bao giờ import vào code chạy ở browser.
export function createServiceClient() {
  const { createClient: createSb } = require("@supabase/supabase-js");
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
