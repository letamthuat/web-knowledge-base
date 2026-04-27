---
story_key: 1-1-foundation-auth
title: "Epic 1 Foundation: Schema + Auth + Layout + Login + Library"
status: done
created: 2026-04-25
completed: 2026-04-26
---

# Story 1.1 (subset): Foundation, Auth & Account Security — Core Setup

## Story

As a developer implementing Epic 1,
I want Convex schema đầy đủ + Better Auth setup + ConvexProvider trong layout + trang /login + trang /library,
So that nền tảng auth hoạt động và user có thể đăng nhập, truy cập /library.

## Acceptance Criteria

- [x] AC1: `convex/schema.ts` định nghĩa đủ 14 bảng theo architecture (users, sessions, documents, tags, document_tags, folders, document_folders, reading_progress, reading_history, tabs, highlights, notes, document_shares, telemetry_events, error_logs, sync_conflicts, mutation_log, upload_sessions)
- [x] AC2: `convex/auth.config.ts` cấu hình Better Auth với Email/Password + Google OAuth
- [x] AC3: `convex/http.ts` expose Better Auth HTTP routes
- [x] AC4: `ConvexClientProvider` bọc `ConvexReactClient` + `ConvexAuthProvider` (Better Auth)
- [x] AC5: `apps/web/src/app/layout.tsx` dùng `ConvexClientProvider` + `Toaster` tiếng Việt
- [x] AC6: `/login` có form email/password với validation VI + Google OAuth button
- [x] AC7: `/library` redirect `/login` nếu chưa auth; hiện empty state + nav bar

## Tasks/Subtasks

- [x] Task 1: Tạo project structure (monorepo package.json, apps/web package.json, tsconfig, next.config, tailwind, postcss)
- [x] Task 2: Tạo `convex/schema.ts` với 18 bảng đầy đủ
- [x] Task 3: Tạo `convex/auth.config.ts` + `convex/http.ts` (Better Auth backend)
- [x] Task 4: Tạo `apps/web/src/lib/auth-client.ts` (Better Auth client)
- [x] Task 5: Tạo `ConvexClientProvider.tsx` + `apps/web/src/app/layout.tsx`
- [x] Task 6: Tạo UI components (Button, Input, Label, Separator) + globals.css + i18n labels
- [x] Task 7: Tạo `/login` page với form + Google button + validation tiếng Việt
- [x] Task 8: Tạo `/library` page placeholder với auth guard + nav + empty state
- [x] Task 9: Tạo middleware.ts + .env.example + .gitignore

## Dev Agent Record

### Implementation Plan

Vì project chưa có Next.js app, cần tạo toàn bộ structure thủ công theo architecture monorepo:
- `apps/web/` — Next.js 15 App Router + TypeScript strict + Tailwind v3 + shadcn
- `convex/` — Convex schema + Better Auth config

Better Auth được dùng thay Convex Auth (per architecture D2). Auth client ở `src/lib/auth-client.ts` dùng `createAuthClient` từ `better-auth/react`.

### Completion Notes

**Đã implement:**
- 18 bảng Convex schema với đầy đủ index (by_user, by_user_doc, search index...)
- Better Auth backend config (email+password, Google OAuth, session 30 ngày, email verify)
- ConvexClientProvider dùng `@convex-dev/better-auth/react` `ConvexAuthProvider`
- Login page: react-hook-form + zod validation VI, Google OAuth button, ARIA labels (WCAG 2.1 AA)
- Library page: session guard với `useSession()`, nav bar, empty state UI
- i18n labels.ts cho tất cả string UI tiếng Việt (NFR37)
- CSP headers trong next.config.ts (NFR14)

**Chưa implement (cần story tiếp theo):**
- Resend email integration (password reset, email verify)
- Signup page (/signup)
- 2FA setup (/settings/account)
- `pnpm install` + `npx convex dev` để gen `_generated/`
- Vitest + Playwright tests

### Debug Log

Không có blocking issue. Các package `@convex-dev/better-auth` và `better-auth` cần install qua `npm install` trong `apps/web/`.

## File List

- `package.json` (root monorepo)
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `apps/web/tailwind.config.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/src/styles/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/library/page.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/providers/ConvexClientProvider.tsx`
- `apps/web/src/lib/auth-client.ts`
- `apps/web/src/lib/utils.ts`
- `apps/web/src/lib/i18n/labels.ts`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/label.tsx`
- `apps/web/src/components/ui/separator.tsx`
- `convex/schema.ts`
- `convex/auth.config.ts`
- `convex/http.ts`
- `convex/tsconfig.json`
- `convex/convex.json`
- `.env.example`
- `.gitignore`

## Change Log

- 2026-04-25: Khởi tạo toàn bộ project structure + implement Epic 1 foundation (schema, auth, layout, login, library)
- 2026-04-26: Fix @convex-dev/better-auth version (0.6.2), fix cross-domain cookie qua nextJsHandler proxy, fix trustedOrigins — đăng ký/đăng nhập/session hoạt động thật trên localhost

## Ghi chú còn lại (chưa làm trong Epic 1)

- Story 1.4: Đăng xuất per-device + trang "Phiên đang hoạt động"
- Story 1.5: MFA TOTP + backup codes
- Story 1.6: Reset password qua Resend email
- Story 1.7: GitHub Actions CI/CD
- Google OAuth: cần GOOGLE_CLIENT_ID/SECRET từ Google Cloud Console
