"use client";
// Auth client — bọc Supabase Auth, giữ API quen thuộc (signIn/signUp/signOut/useSession)
// để các trang & component cũ ít phải sửa.
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";

type AuthError = { status: number; message: string } | null;

function mapError(error: { status?: number; message: string } | null): AuthError {
  if (!error) return null;
  return { status: error.status ?? 400, message: error.message };
}

export const signIn = {
  // Đăng nhập email + password (FR1, FR2)
  async email({ email, password }: { email: string; password: string; callbackURL?: string }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: mapError(error) };
  },
  // Google OAuth — tạm tắt (chưa cấu hình). Bật lại: signInWithOAuth({ provider: "google" }).
  async social(_opts: { provider: string; callbackURL?: string }) {
    return { error: { status: 400, message: "OAuth provider chưa được bật" } as AuthError };
  },
};

export const signUp = {
  // Đăng ký email + password. Trả về data.session = null nếu cần xác nhận email.
  async email({ email, password, name }: { email: string; password: string; name?: string; callbackURL?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: name ? { name } : undefined,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error: mapError(error) };
  },
};

export async function signOut() {
  await supabase.auth.signOut();
}

// Gửi email reset password
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  });
  return { error: mapError(error) };
}

// Hook session — trả { data, isPending } giống Better Auth's useSession.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsPending(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setIsPending(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { data: session, isPending };
}
