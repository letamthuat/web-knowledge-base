"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

import { resetPassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

const E = labels.auth.errors;

const schema = z.object({
  email: z.string().min(1, E.emailRequired).email(E.emailInvalid),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    const { error } = await resetPassword(values.email);
    if (error) {
      toast.error(E.unknown);
      return;
    }
    // Luôn báo thành công (không lộ email nào tồn tại)
    setSent(true);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <AppLogo size={48} />
          <h1 className="text-2xl font-bold tracking-tight">Quên mật khẩu</h1>
          <p className="text-sm text-muted-foreground">
            Nhập email, chúng tôi sẽ gửi link đặt lại mật khẩu.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border bg-muted/40 p-4 text-center text-sm">
            Nếu email tồn tại, link đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư của bạn.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" autoFocus {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang gửi…</> : "Gửi link đặt lại"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">← Quay lại đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
