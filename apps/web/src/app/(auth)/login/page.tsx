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

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

const L = labels.auth.login;
const E = labels.auth.errors;

// Validation schema (NFR37 — error VI)
const loginSchema = z.object({
  email: z
    .string()
    .min(1, E.emailRequired)
    .email(E.emailInvalid),
  password: z
    .string()
    .min(1, E.passwordRequired)
    .min(8, E.passwordTooShort),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Email + Password đăng nhập (FR1, FR2)
  async function onSubmit(values: LoginFormValues) {
    const result = await signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: "/library",
    });

    if (result.error) {
      // Phân loại lỗi để hiển thị tiếng Việt (NFR37)
      const code = result.error.status;
      if (code === 429) {
        toast.error(E.rateLimited);
      } else if (code === 401 || code === 400) {
        toast.error(E.loginFailed);
      } else {
        toast.error(E.unknown);
      }
      return;
    }

    toast.success(labels.auth.success.loginSuccess);
    router.push("/library");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo + tiêu đề */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <AppLogo size={48} />
          <h1 className="text-2xl font-bold tracking-tight">{L.title}</h1>
          <p className="text-sm text-muted-foreground">{L.subtitle}</p>
        </div>

        {/* Form email + password */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
          aria-label="Form đăng nhập"
        >
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{L.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              placeholder={L.emailPlaceholder}
              autoComplete="email"
              autoFocus
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{L.passwordLabel}</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                {L.forgotPassword}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder={L.passwordPlaceholder}
              autoComplete="current-password"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {L.submittingButton}
              </>
            ) : (
              L.submitButton
            )}
          </Button>
        </form>

        {/* Link đến signup */}
        <p className="text-center text-sm text-muted-foreground">
          {L.noAccount}{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            {L.signupLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
