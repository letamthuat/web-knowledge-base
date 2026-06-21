"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

const E = labels.auth.errors;

const schema = z.object({
  password: z.string().min(8, E.passwordTooShort),
});
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    // User đã có session recovery (từ link email qua /auth/callback)
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      toast.error(error.message || E.unknown);
      return;
    }
    toast.success("Đổi mật khẩu thành công!");
    router.push("/library");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <AppLogo size={48} />
          <h1 className="text-2xl font-bold tracking-tight">Đặt mật khẩu mới</h1>
          <p className="text-sm text-muted-foreground">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu mới</Label>
            <Input id="password" type="password" autoComplete="new-password" autoFocus {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu…</> : "Lưu mật khẩu"}
          </Button>
        </form>
      </div>
    </div>
  );
}
