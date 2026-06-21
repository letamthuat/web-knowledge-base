"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

const L = labels.auth.signup;
const E = labels.auth.errors;

const signupSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên hiển thị"),
  email: z.string().min(1, E.emailRequired).email(E.emailInvalid),
  password: z.string().min(8, E.passwordTooShort),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(values: SignupFormValues) {
    const result = await signUp.email({
      email: values.email,
      password: values.password,
      name: values.name,
    });

    if (result.error) {
      const msg = result.error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered")) {
        toast.error("Email này đã được đăng ký. Vui lòng đăng nhập.");
      } else {
        toast.error(E.unknown);
      }
      return;
    }

    // Bật "Confirm email" → chưa có session ngay; yêu cầu xác nhận qua email.
    if (!result.data?.session) {
      toast.success("Đăng ký thành công! Kiểm tra email để xác nhận tài khoản.");
      router.push("/login");
      return;
    }

    toast.success(labels.auth.success.signupSuccess);
    router.push("/library");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <AppLogo size={48} />
          <h1 className="text-2xl font-bold tracking-tight">{L.title}</h1>
          <p className="text-sm text-muted-foreground">{L.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{L.nameLabel}</Label>
            <Input id="name" placeholder={L.namePlaceholder} autoFocus {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{L.emailLabel}</Label>
            <Input id="email" type="email" placeholder={L.emailPlaceholder} autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{L.passwordLabel}</Label>
            <Input id="password" type="password" placeholder={L.passwordPlaceholder} autoComplete="new-password" {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L.submittingButton}</> : L.submitButton}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {L.hasAccount}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">{L.loginLink}</Link>
        </p>
      </div>
    </div>
  );
}
