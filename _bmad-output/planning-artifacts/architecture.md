---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/research/market-personal-knowledge-base-reading-app-research-2026-04-25.md
workflowType: 'architecture'
project_name: 'Web Knowledge Base'
user_name: 'Thuat'
date: '2026-04-25'
lastStep: 8
status: 'complete'
completedAt: '2026-04-25'
---

# Architecture Decision Document — Web Knowledge Base

_Tài liệu này được xây dựng từng bước thông qua đối thoại với Thuat. Mỗi section được append sau khi thống nhất._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (68 FR / 13 nhóm):**
- Auth & Session (FR1–5), Content Library (FR6–11), Multi-Format Viewers cho 8 định dạng (FR12–20), Reading Progress + Resume cross-device (FR21–24), Multi-Tab Workspace (FR25–28), Highlight & Annotation (FR29–33), Note Workspace với KaTeX/mermaid + bidirectional link (FR34–39), Full-text Search across docs+notes (FR40–43), Offline & PWA với conflict resolution (FR44–47), Data Portability + Backup (FR48–51), Telemetry & Self-observability (FR52–54), Sharing Phase 2+ schema-ready (FR55–59), Reading Mode (FR60–68).

**Non-Functional Requirements (37 NFR) định hình kiến trúc:**
- **Performance**: resume ≤2s, tab sync ≤3s, highlight→caret ≤1.5s, note save ≤1s, search ≤1s/500ms, bundle <200KB gz, FCP ≤1.5s → bắt buộc reactive subscription + code-splitting aggressive + lazy viewer.
- **Reliability**: sync ≥99%, LWW + conflict log, weekly backup, 100% docs 7 ngày offline (500MB cache cap) → outbox pattern client + IndexedDB queue + cache eviction LRU.
- **Security**: HTTPS-only, AES-256 at rest, presigned URL ≤15 phút, managed auth (không tự code), CSP strict, no third-party telemetry.
- **Cost ($0/tháng cứng)**: mọi dịch vụ free-tier vĩnh viễn, không paid trial; mỗi layer phải có backup plan free-tier khác (data layer abstraction để swap stack ≤1 tuần).
- **Compatibility**: Chrome/Edge ≥110, Safari ≥16.4 (PWA + SW), responsive 375px–1920px+, tap target ≥44×44.
- **Maintainability**: TS strict, coverage ≥60%, deploy ≤5 phút, rollback ≤10 phút, UI tiếng Việt.

**Scale & Complexity:**
- Primary domain: Full-stack web SPA (Next.js + BaaS + Object Storage)
- Complexity level: **Medium-High**
- Estimated architectural components: **~12** (Auth, Library/Upload, Viewer Dispatcher + 8 Viewers, Reading-Progress Sync, Tabs Sync, Highlight/Note, Search, Offline Cache+Queue, Export/Backup, Telemetry, Reading Mode, Sharing-ready data layer)

### Technical Constraints & Dependencies

- **$0/tháng tuyệt đối** — chỉ free-tier vĩnh viễn, không paid tier, không trial-rồi-tính-phí. Mỗi service trong stack phải có backup plan free-tier khác (R2→B2; Convex→Supabase/Pocketbase; CF Pages→Netlify Starter).
- **Single coder = Claude Code** — Thuat không tự code; stack phải mainstream Claude Code thạo, ít boilerplate, monorepo gọn.
- **Stack chốt sơ bộ trong PRD**: Cloudflare Pages + Convex + Cloudflare R2 (+ Backblaze B2 backup). Sẵn sàng challenge/đổi ở các bước decision nếu phát hiện rủi ro free-tier hoặc DX tốt hơn.
- **Browser quirks**: iOS Safari 16.4+ — Background Sync API không có → polling khi mở; SW storage có thể bị xoá khi user clear Safari history → backup IndexedDB ra Convex thường xuyên.
- **OSS viewer libraries** đã lock: PDF.js, epubjs/react-reader, mammoth, react-pptx, react-image-gallery, Plyr, Wavesurfer.js, react-markdown + KaTeX + mermaid, Mozilla Readability.
- **Schema-ready multi-user** ngay từ MVP — mọi bảng có `userId`, `document_shares` table có sẵn dù chưa dùng.

### Cross-Cutting Concerns Identified

| Concern | Lan toả tới |
|---|---|
| Auth + userId scoping | Mọi mutation/query phải gate qua `ctx.auth` |
| Position abstraction (5 position_type) | 8 viewer + sync layer + resume UI |
| Offline mutation queue (outbox) | Highlight, note, tag, reading_progress, tabs |
| Realtime subscription | Tabs, notes, comments (P2+), conflict log |
| Storage routing (Convex/R2/B2) | Upload, download, presigned URL, export |
| Telemetry instrumentation | Mọi action user-facing có latency budget |
| Conflict resolution (LWW + manual UI) | Note, highlight, tag, reading_progress |
| i18n tiếng Việt (NFR37) | UI labels, error messages, server message |
| Multi-user readiness | Schema, query filter, role gating, share table |
| Data portability format | Export, backup, Obsidian compatibility |
| Bundle/lazy-load discipline | Viewer chunks, mermaid, KaTeX, mammoth |
| PWA cache eviction (LRU 500MB) | Service Worker, IndexedDB |

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web SPA — Next.js 15 (App Router, RSC + Client) + Convex BaaS + Cloudflare R2 object storage. Stack đã chốt ở PRD.

### Starter Options Considered

| Option | Lệnh | Pros | Cons |
|---|---|---|---|
| **A. Convex official template** `nextjs-convexauth-shadcn` | `npm create convex@latest web-knowledge-base -- -t get-convex/template-nextjs-convexauth-shadcn` | Match PRD 1-1; Next.js 15 + TS + Tailwind + shadcn + Convex Auth out-of-box; Convex maintain chính thức; tiết kiệm setup | Phải verify deploy CF Pages qua `@cloudflare/next-on-pages` |
| B. `create-next-app` + nối Convex/shadcn manual | `npx create-next-app@latest --ts --tailwind --eslint --app --src-dir` rồi `npx convex@latest dev` + `npx shadcn@latest init` | Kiểm soát chi tiết, không lock template | Mất nửa ngày boilerplate, phải tự wire Convex Auth |
| C. Convex Ents SaaS Starter | `npx create-convex@latest -t get-convex/ents-saas-starter` | Full SaaS scaffolding | Overkill cho personal MVP single-user |

### Selected Starter: Convex official `template-nextjs-convexauth-shadcn`

**Rationale**: match PRD chuẩn xác (Convex + Convex Auth + shadcn + Next.js 15 + TS + Tailwind), Convex team maintain → ổn định cùng nhịp Convex release; giảm boilerplate cho Claude Code.

**Initialization Command:**

```bash
npm create convex@latest web-knowledge-base -- -t get-convex/template-nextjs-convexauth-shadcn
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime**: TypeScript strict + Node 20 LTS + Next.js 15 App Router (RSC + Client Components, Turbopack dev).
- **Styling**: Tailwind CSS v3 (stable default) + shadcn/ui (Radix primitives + cva variants); kế hoạch upgrade Tailwind v4 ở Phase 3 sau khi shadcn ecosystem hoàn toàn tương thích.
- **Backend client**: Convex React hooks (reactive queries) + Convex Auth (email/password + OAuth providers, không tự code auth flow — thoả NFR12).
- **Build tooling**: Turbopack dev server; `next build` cho production; bundle analyzer optional via `@next/bundle-analyzer` (kiểm NFR7 <200KB gz).
- **Code organization**: monorepo `apps/web` (Next.js) + `convex/` (schema.ts + functions/*.ts) — Claude Code dễ navigate.
- **Dev experience**: `convex dev` (live schema sync) + `next dev` (Turbopack); ESLint + Prettier preset; AGENTS.md guideline cho Claude Code follow Next.js best practice 2026.

### Decisions DEFERRED to Step 4 (cần architect quyết riêng)

- Test framework setup (Vitest unit + Playwright E2E) — không có sẵn trong template, sẽ chốt ở step Quality.
- Cloudflare Pages adapter (`@cloudflare/next-on-pages`) — verify compatibility với Convex Auth callback route ở Phase 1 story đầu.
- Storage abstraction layer (Convex file storage vs R2 routing) — custom code, không phải template.
- PWA setup (Workbox + manifest) — thêm sau khi Phase 3 bắt đầu.
- Telemetry & error_logs custom dashboard — code riêng trong Convex.

**Note**: Story đầu tiên của Phase 1 = init project bằng lệnh trên + verify build chạy + deploy preview lên Cloudflare Pages + **swap Convex Auth → Better Auth** (xem D2).

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- **D1**: OpenNext Cloudflare adapter (thay `next-on-pages` deprecated)
- **D2**: Convex + Better Auth integration với MFA TOTP từ MVP
- **D3**: Convex search index built-in cho MVP (Meilisearch fallback Phase 2+)
- **D5**: LWW field-level + diff threshold 20 chars cho conflict resolution
- **D10**: Storage abstraction layer (Convex/R2/B2 swap ≤1 tuần)

**Important Decisions (Shape Architecture):**
- **D4**: Custom Workbox + Dexie.js cho PWA + offline cache
- **D6**: Hybrid offline queue (Workbox BG Sync + polling fallback iOS)
- **D7**: GitHub Actions free tier cho CI/CD
- **D9**: Convex reactive query duy nhất cho realtime (không thêm WebSocket service)

**Deferred Decisions (Post-MVP):**
- **D8**: Rate limiting via Convex Rate Limiter component (Phase 2+)
- Search migration to Meilisearch (chỉ khi vượt 1024 result limit)

### Data Architecture

- **DB**: Convex managed (NoSQL transactional, ACID, reactive subscription).
- **Schema**: 9 bảng theo PRD + bổ sung `sync_conflicts` (D5). Mọi bảng index `by_user` để gate auth.
- **Migration**: Convex schema-first; thay đổi schema deploy live, có warning nếu mất compat. Pre-deploy script export snapshot.
- **Caching**: Convex reactive query auto-cache; client TanStack Query cho non-Convex HTTP. Service Worker cache static assets + recent docs.
- **Storage routing (D10)**:
  - File ≤5MB → Convex file storage (`storageBackend: "convex"`)
  - File >5MB → Cloudflare R2 (`storageBackend: "r2"`) qua presigned URL
  - Backup `storageBackend: "b2"` nếu R2 từ chối thẻ
  - Interface `StorageProvider` trong `apps/web/src/lib/storage/index.ts`

### Authentication & Security (D2 — Revised)

- **Auth**: **Convex + Better Auth** via `@convex-dev/better-auth`.
  - Email/password + Google OAuth + GitHub OAuth + Magic Link
  - **TOTP MFA + 2FA OTP** từ MVP (settings page setup QR code)
  - Optional Passkey (WebAuthn) — Phase 2+
- **Email** (cho password reset, magic link, 2FA backup): Resend free 3k/tháng — kéo từ Phase 2+ lên MVP vì auth flow yêu cầu.
- **Schema bổ sung (extends starter `users`)**:
  - `twoFactorEnabled: boolean`
  - `twoFactorSecret: string` (encrypted at rest)
  - `backupCodes: string[]` (hashed)
- **Session**: 30 ngày trên thiết bị tin cậy, force re-auth sau 90 ngày inactive (NFR21).
- **Authorization**: mọi mutation/query check `ctx.auth.getUserIdentity()`; query luôn filter `userId`. Phase 2+ thêm role check qua `document_shares.role` enum (owner/editor/commenter/viewer).
- **File access**: presigned URL R2 expire ≤15 phút (NFR11); Convex file URL signed by Convex Auth token.
- **CSP**: `default-src 'self'; connect-src 'self' *.convex.cloud *.r2.cloudflarestorage.com *.resend.com; img-src 'self' data: blob: https://*.googleusercontent.com; script-src 'self' 'unsafe-inline'`.
- **Secrets**: env vars qua Cloudflare Pages secrets + Convex deployment config (KHÔNG commit `.env`).

### API & Communication Patterns

- **Pattern**: Convex queries/mutations/actions (RPC over WebSocket). Không REST/GraphQL bonus layer.
- **Realtime (D9)**: Convex reactive `useQuery` re-render tự động — tabs sync, notes, comments (P2+), conflict log đều dùng reactive, **không thêm WebSocket/Pusher/Ably**.
- **Error handling**: Convex throw `ConvexError` typed; client wrap hiển thị toast tiếng Việt; log vào `error_logs` table (FR54).
- **Naming convention**: `convex/{domain}/{queries|mutations|actions}.ts` (vd `convex/documents/queries.ts`, `convex/notes/mutations.ts`, `convex/sync/actions.ts`).
- **Idempotency**: mutation offline queue tag `clientMutationId` (UUID v7) để dedupe khi retry network.
- **Rate limiting (D8, Phase 2+)**: Convex Rate Limiter component, 100 req/phút/user cho mutations (NFR15).

### Frontend Architecture

- **Framework**: Next.js 15 App Router; RSC cho landing/static (`/`, `/pricing` nếu có), Client Components cho viewer + reactive queries (`/library`, `/reader/[id]`, `/notes`).
- **Routing**:
  - `/` — landing
  - `/login`, `/signup`, `/2fa-setup`, `/verify-email`, `/forgot-password`
  - `/library` — danh sách doc + filter
  - `/reader/[docId]` — viewer + tab bar
  - `/notes` — note workspace
  - `/notes/[noteId]` — note detail
  - `/settings` — profile, 2FA, theme, export
  - `/admin/telemetry` — self dashboard
  - `/admin/errors` — self error log
  - `/shared` — Phase 2+ (Shared with me)
  - `/sync-conflicts` — D5 conflict review panel
- **State management**:
  - **Zustand** cho UI state (tab bar UI, reading mode toggle, theme, sidebar open)
  - **Convex hooks** (`useQuery`, `useMutation`) cho data state (reactive)
  - **Dexie.js** cho IndexedDB offline cache + outbox queue
- **Code splitting (NFR7 <200KB gz)**:
  - Mỗi viewer là 1 dynamic import: `dynamic(() => import("@/viewers/PDFViewer"), { ssr: false })`
  - mermaid + KaTeX lazy load chỉ khi note có mermaid/math
  - mammoth (DOCX) chỉ load khi mở .docx
  - Bundle analyzer trong CI (fail nếu initial > 200KB gz)
- **Viewer dispatcher**: `<ViewerDispatcher format={doc.format} doc={doc} />` route tới đúng viewer component qua Map<format, LazyComponent>.
- **Performance**:
  - `next/image` qua Cloudflare CDN
  - Prefetch tab list của other devices khi mở app
  - Service Worker cache app shell

### Infrastructure & Deployment

- **Host frontend (D1)**: Cloudflare Pages + **OpenNext Cloudflare adapter** với compatibility flag `nodejs_compat_v2`.
- **Backend**: Convex managed deployment (1 dev + 1 prod, free tier).
- **Storage**: Cloudflare R2 (primary, 10GB + 0$ egress) + B2 (backup, 10GB).
- **Email**: Resend free 3k/tháng (cho auth flows).
- **CI/CD (D7)**: GitHub Actions free tier
  - **On PR**: lint + typecheck + vitest unit + playwright E2E headless + bundle size check
  - **On merge `main`**: deploy CF Pages production + `npx convex deploy --prod`
  - **On push branch**: CF Pages preview + Convex preview deployment per branch
- **Env config**: 3 environments — dev (local Convex CLI), preview (per-branch), prod.
- **Monitoring (NFR13)**: in-app `/admin/telemetry` + `/admin/errors` (Convex reactive queries trên `telemetry_events` + `error_logs`); KHÔNG gửi ra third-party.
- **Backup (NFR18)**: Convex scheduled job (cron) chạy weekly Sunday 03:00 ICT, dùng Google Drive API OAuth token user → upload ZIP snapshot, giữ 4 bản gần nhất (auto-prune).
- **Scaling**: free tier đủ ≤5 user Phase 2 (NFR27). Phase 3+ nếu bùng nổ → cân nhắc Convex Pro hoặc self-host Pocketbase.

### PWA & Offline (D4 + D6)

- **Service Worker**: custom `sw.ts` build qua Workbox CLI inject vào `public/`.
  - `CacheFirst` cho static assets (1 năm)
  - `NetworkFirst` cho Convex API (3s timeout fallback cache)
  - `StaleWhileRevalidate` cho file đã download (max 500MB LRU eviction theo `last_opened_at`)
- **IndexedDB qua Dexie.js**:
  - DB `webkb` với store: `documents_cache`, `notes_cache`, `mutation_outbox`, `media_blob`, `tabs_cache`
- **Offline mutation queue (Hybrid D6)**:
  - Mọi mutation client-side → write Dexie `mutation_outbox` trước (optimistic UI)
  - Online (Chrome/Edge/Android): **Workbox Background Sync** flush queue
  - Online (iOS Safari, no BG Sync API): **polling on `visibilitychange`** event flush queue khi tab trở lại active
  - Idempotency: mỗi mutation có `clientMutationId` UUID v7
- **Conflict resolution (D5)**:
  - Server-side LWW field-level (compare `updatedAt` timestamp)
  - Nếu diff text > 20 char trên 1 field → ghi vào bảng mới `sync_conflicts(userId, entityType, entityId, fieldName, versionA, versionB, createdAt)`
  - UI `/sync-conflicts` hiển thị side-by-side diff cho user duyệt

### Decision Impact Analysis

**Implementation Sequence (story-level):**
1. **Story 1 — Init**: `npm create convex@latest` + swap to Better Auth + deploy preview CF Pages (D1, D2, D-Starter)
2. **Story 2 — Storage abstraction layer (D10)**: ConvexStorageProvider + R2StorageProvider + StorageRouter (block all upload features)
3. **Story 3 — Auth complete**: signup/login/2FA setup/password reset + Resend integration (D2)
4. **Story 4 — Position abstraction + reading_progress sync** (multi position_type)
5. **Story 5 — Viewer dispatcher + PDFViewer first**
6. **Story 6 — GitHub Actions CI** (parallel) (D7)
7. **Story 7+ — Phase 1**: thêm 7 viewer còn lại
8. **Phase 2 (tuần 4–5)**: Tab sync (D9 reactive), Highlight + Note + KaTeX/mermaid, Search (D3)
9. **Phase 3 (tuần 6–8)**: PWA Workbox + Dexie (D4), offline queue (D6), conflict resolution UI + `sync_conflicts` table (D5), backup cron, export

**Cross-Component Dependencies:**
- **D10** (Storage abstraction) blocks: upload, viewer download, export, backup, R2 presigned URL
- **D5** (Conflict resolution) needs: D6 (offline queue) + new `sync_conflicts` table + UI
- **D4** (Workbox PWA) blocks: D6 (BG Sync), 7-day cache (NFR20)
- **D9** (Convex reactive) implicit dependency cho: tab sync, notes, comments, telemetry dashboard
- **D1** (OpenNext) affects: deploy script, env var binding, Better Auth callback URL, CF compatibility flags
- **D2** (Better Auth) affects: starter swap (Story 1), schema users extension, all UI gating, Resend dependency

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Convex tables & fields):**
- **Table names**: `snake_case` plural (matching PRD): `documents`, `reading_progress`, `sync_conflicts`, `error_logs`
- **Field names**: `camelCase` (Convex idiomatic, KHÔNG snake_case): `userId`, `docId`, `storageBackend`, `positionType`, `updatedAt`
- **Index names**: `by_<fields>` — `by_user`, `by_user_doc`, `by_event_ts`
- **Search index**: `search_<field>` — `search_title`, `search_body`
- **ID type**: `Id<"tableName">` (Convex), không UUID v4 cho primary key
- **Client mutation IDs**: `clientMutationId: string` UUID v7 (idempotency outbox queue)

**Code naming:**
- Components: `PascalCase.tsx` — `PDFViewer.tsx`, `TabBar.tsx`, `ReadingModeToggle.tsx`
- Hooks: `useXxx.ts` — `useTabSync.ts`, `useReadingProgress.ts`
- Utilities: `camelCase.ts` — `formatBytes.ts`, `parsePosition.ts`
- Types: `PascalCase` — `ReadingPosition`, `StorageProvider`, `ConflictRecord`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_FILE_SIZE_MB`, `OUTBOX_FLUSH_INTERVAL_MS`
- Convex functions: `camelCase` — `getDocumentsByUser`, `upsertReadingProgress`, `flushMutationOutbox`

**Routes (Next.js App Router):**
- Folder: `kebab-case` — `app/sync-conflicts/`, `app/admin/telemetry/`
- Dynamic param: `[paramName]` camelCase — `[docId]`, `[noteId]`
- Page file: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`

### Structure Patterns

Monorepo layout chuẩn (chi tiết tham chiếu Step 6):

```
web-knowledge-base/
├── apps/web/                    # Next.js app
│   └── src/{app,components,hooks,lib,stores,types,styles}
├── convex/                      # Convex backend (schema + functions per domain)
├── .github/workflows/           # CI/CD
├── AGENTS.md                    # Claude Code guideline
└── README.md
```

- Test location: co-located cho unit (`Component.tsx` + `Component.test.tsx`), tách folder cho E2E (`tests/e2e/`).

### Format Patterns

**Convex error format (typed):**
```ts
throw new ConvexError({
  code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL",
  message: string,    // English (log)
  messageVi?: string, // Tiếng Việt (UI toast)
  meta?: Record<string, unknown>
})
```

- **Date/time**: `number` (ms epoch) trong DB; ISO string khi export ZIP/JSON; UI format `vi-VN` qua `date-fns/locale/vi`
- **Boolean**: `true`/`false` JSON; KHÔNG dùng `0`/`1`
- **Null vs undefined**: schema dùng `v.optional(...)`; TS dùng `T | undefined`

**Position serialization** (5 type):
```ts
type ReadingPosition =
  | { type: "pdf_page"; page: number; offset: number }
  | { type: "epub_cfi"; cfi: string }
  | { type: "time_seconds"; seconds: number }
  | { type: "scroll_pct"; pct: number; charOffset?: number }
  | { type: "slide_index"; slide: number };
// DB lưu JSON.stringify(position) trong field positionValue: string
```

### Communication Patterns

**Event names (telemetry)**: `snake_case.dot.notation` — `resume_position.loaded`, `tabs.synced`, `note.saved`, `search.executed`, `outbox.flushed`. Mỗi event có `latencyMs`, `deviceId`, `meta`.

**State management split:**
- **Zustand** = UI ephemeral state (tab UI, sidebar, theme, modal). 1 store / domain UI: `useTabUiStore`, `useReaderUiStore`, `useSettingsUiStore`. Action naming: `setXxx`, `toggleXxx`.
- **Convex hooks** = data state reactive. KHÔNG copy data sang Zustand.
- **Dexie** = offline cache + outbox. Truy cập qua hook `useOfflineDoc(docId)`.
- **Form** = `react-hook-form` + `zod`; schema chia sẻ TS + Convex validator.

**Mutation pattern (outbox):**
```ts
await mutateWithOutbox({
  fn: api.notes.mutations.upsert,
  args: { ... },
  clientMutationId: uuidv7(),
});
// → optimistic write Dexie → Convex → confirm hoặc retry
```

### Process Patterns

**Error handling 3 layer:**
1. Convex function: throw `ConvexError` typed
2. Client wrapper: try/catch map `ConvexError.code` → toast VI; log unknown vào `error_logs`
3. React Error Boundary: `app/error.tsx` global + per-route boundary cho viewer

**Loading states:**
- Convex `useQuery === undefined` → `<Skeleton />`
- Route-level: `app/<route>/loading.tsx` Suspense
- Mutation pending: Zustand flag hoặc local `useState`

**Auth gating:**
- Layout `(authenticated)/layout.tsx` group → check `useConvexAuth()`, redirect `/login` nếu chưa auth
- Convex: mọi function bắt đầu với `const userId = await requireAuth(ctx)` từ `convex/lib/auth.ts`
- 2FA gate: nếu `user.twoFactorEnabled && !session.twoFactorVerified` → redirect `/2fa-verify`

**Validation:**
- Client: `zod` resolver vào `react-hook-form`
- Server: Convex validators auto
- Shared zod schemas trong `apps/web/src/lib/validators/`

**Retry & idempotency:**
- Outbox exponential backoff: 1s, 2s, 4s, 8s, ..., max 60s, max 10 attempts
- Mọi mutation tag `clientMutationId` UUID v7 (dedupe qua `mutation_log` Convex, TTL 7 ngày)

**Optimistic UI:**
- Highlight/note/tag/tab order: Dexie ngay → UI render → Convex sync background
- Reading progress: throttle 5s flush Convex
- Upload: realtime progress từ multipart chunk

### Enforcement Guidelines

**Mọi AI agent (Claude Code) implement story phải:**

1. Đọc `AGENTS.md` trước khi viết code
2. Tuân thủ table/field naming — không tự đổi `userId` thành `user_id`
3. Mutation luôn idempotent với `clientMutationId`
4. Mọi function Convex bắt đầu `requireAuth(ctx)` trừ public endpoints
5. Errors throw `ConvexError` typed, không `throw new Error("...")`
6. UI labels VI — lookup từ `lib/i18n/labels.ts`
7. Lazy load viewer — `dynamic()` với `ssr: false`
8. Telemetry mọi action có latency budget — `withTelemetry()` helper
9. Test cho critical path — sync, position, export, auth (NFR34 ≥60%)
10. No `any` — TS strict; dynamic dùng `unknown` + narrow

**Pattern enforcement:**
- Pre-commit hook: ESLint rule `@typescript-eslint/no-explicit-any: error`
- CI gate: typecheck + bundle size + coverage threshold
- AGENTS.md update mỗi khi pattern thay đổi
- Architecture doc là single source of truth

### Pattern Examples

**Good — Convex mutation:**
```ts
// convex/notes/mutations.ts
export const upsert = mutation({
  args: {
    noteId: v.optional(v.id("notes")),
    bodyMd: v.string(),
    parentDocId: v.optional(v.id("documents")),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (await isDuplicateMutation(ctx, args.clientMutationId)) return;
    // ... upsert logic
    await logTelemetry(ctx, "note.saved", { latencyMs: ... });
  },
});
```

**Anti-patterns (DO NOT):**
```ts
{ user_id: ..., body_md: ... }                                  // ❌ snake_case field
throw new Error("Not found")                                    // ❌ raw Error
export const list = query({                                     // ❌ skip auth
  handler: async (ctx) => ctx.db.query("notes").collect()
})
useStore((s) => s.documents)                                    // ❌ copy Convex data
<button>Save</button>                                           // ❌ hard-coded English
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
web-knowledge-base/
├── README.md
├── AGENTS.md                          # Hướng dẫn cho Claude Code
├── package.json                       # Workspaces: apps/web, convex
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example                       # Mẫu env vars (NO secret)
├── .prettierrc
├── eslint.config.js                   # Flat config 2026
│
├── .github/workflows/
│   ├── ci.yml                         # PR: lint, typecheck, test, bundle-size
│   ├── deploy-preview.yml             # Branch: CF Pages + Convex preview
│   └── deploy-prod.yml                # Merge main: CF Pages + Convex prod
│
├── apps/web/                          # Next.js 15 App Router
│   ├── package.json
│   ├── next.config.ts
│   ├── open-next.config.ts            # Cloudflare adapter
│   ├── wrangler.toml                  # CF Pages binding
│   ├── tailwind.config.ts
│   ├── components.json                # shadcn config
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   │
│   ├── public/
│   │   ├── manifest.webmanifest       # PWA
│   │   ├── sw.ts                      # Workbox source
│   │   ├── icons/                     # 192/512 PWA icons
│   │   └── locales/vi.json
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx             # ConvexProvider, BetterAuthProvider
│   │   │   ├── page.tsx               # Landing
│   │   │   ├── error.tsx              # Global boundary
│   │   │   ├── loading.tsx
│   │   │   │
│   │   │   ├── (auth)/                # Public auth
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── signup/page.tsx
│   │   │   │   ├── forgot-password/page.tsx
│   │   │   │   ├── verify-email/page.tsx
│   │   │   │   └── 2fa-verify/page.tsx
│   │   │   │
│   │   │   ├── (authenticated)/       # Auth-gated group
│   │   │   │   ├── layout.tsx         # Auth + 2FA gate
│   │   │   │   ├── library/
│   │   │   │   │   ├── page.tsx                  # FR8, FR11
│   │   │   │   │   └── upload/page.tsx           # FR6, FR7
│   │   │   │   ├── reader/[docId]/
│   │   │   │   │   ├── page.tsx                  # FR12-20
│   │   │   │   │   ├── error.tsx                 # Per-route boundary
│   │   │   │   │   └── loading.tsx
│   │   │   │   ├── notes/
│   │   │   │   │   ├── page.tsx                  # FR34, FR38
│   │   │   │   │   └── [noteId]/page.tsx
│   │   │   │   ├── settings/
│   │   │   │   │   ├── account/page.tsx          # 2FA (FR4)
│   │   │   │   │   ├── theme/page.tsx
│   │   │   │   │   └── export/page.tsx           # FR48
│   │   │   │   ├── search/page.tsx               # FR40-43
│   │   │   │   ├── sync-conflicts/page.tsx       # D5
│   │   │   │   └── shared/page.tsx               # P2+ FR57
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx                    # Self only
│   │   │   │   ├── telemetry/page.tsx            # FR53
│   │   │   │   └── errors/page.tsx               # FR54
│   │   │   │
│   │   │   └── api/
│   │   │       ├── auth/[...all]/route.ts        # Better Auth
│   │   │       └── export/[exportId]/route.ts    # ZIP stream
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn primitives (auto)
│   │   │   ├── auth/                  # LoginForm, SignupForm, TwoFactorSetup, TwoFactorVerify
│   │   │   ├── library/               # DocumentGrid, UploadDropzone, DocumentCard, FilterBar
│   │   │   ├── viewers/               # FR12-20 (lazy)
│   │   │   │   ├── ViewerDispatcher.tsx
│   │   │   │   ├── PDFViewer.tsx
│   │   │   │   ├── EPUBViewer.tsx
│   │   │   │   ├── DOCXViewer.tsx
│   │   │   │   ├── PPTXViewer.tsx
│   │   │   │   ├── ImageViewer.tsx
│   │   │   │   ├── AudioViewer.tsx
│   │   │   │   ├── VideoViewer.tsx
│   │   │   │   ├── MarkdownViewer.tsx
│   │   │   │   └── WebClipViewer.tsx
│   │   │   ├── tabs/                  # TabBar, TabDropdown (mobile)
│   │   │   ├── highlight/             # HighlightLayer, FloatingMenu, HighlightList
│   │   │   ├── note/                  # NotePane, StickyNote, NoteWorkspace, MarkdownEditor, BiDirectionalLink, VoiceNoteRecorder
│   │   │   ├── reading-mode/          # FR60-67
│   │   │   ├── search/                # SearchBar, SearchResults, SearchFilters
│   │   │   ├── offline/               # SyncBadge, ConflictPanel
│   │   │   ├── admin/                 # TelemetryDashboard, ErrorLogTable
│   │   │   └── shared/                # P2+
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTabSync.ts                     # FR27
│   │   │   ├── useReadingProgress.ts             # FR21-23
│   │   │   ├── useOfflineDoc.ts                  # Dexie + Convex
│   │   │   ├── useMutateWithOutbox.ts            # D6
│   │   │   ├── useRequireAuth.ts
│   │   │   ├── useTelemetry.ts
│   │   │   ├── useSearch.ts
│   │   │   ├── useUpload.ts                      # Multipart resumable
│   │   │   └── useReadingMode.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── storage/               # D10 abstraction
│   │   │   │   ├── index.ts                      # StorageProvider router
│   │   │   │   ├── ConvexStorage.ts
│   │   │   │   ├── R2Storage.ts
│   │   │   │   ├── B2Storage.ts
│   │   │   │   └── types.ts
│   │   │   ├── position/              # 5 position_type
│   │   │   │   ├── index.ts
│   │   │   │   ├── pdf.ts
│   │   │   │   ├── epub-cfi.ts
│   │   │   │   ├── time.ts
│   │   │   │   ├── scroll.ts
│   │   │   │   └── slide.ts
│   │   │   ├── outbox/                # D6 offline queue
│   │   │   │   ├── dexie.ts
│   │   │   │   ├── queue.ts
│   │   │   │   └── sync.ts
│   │   │   ├── conflict/              # D5
│   │   │   │   ├── lww.ts
│   │   │   │   └── diff.ts
│   │   │   ├── viewers/               # Lazy loaders
│   │   │   ├── readability/           # Web clip
│   │   │   ├── search/                # Highlight snippet
│   │   │   ├── export/                # FR48-49
│   │   │   │   ├── zip-builder.ts
│   │   │   │   └── markdown-format.ts            # Obsidian-compat
│   │   │   ├── telemetry/             # events.ts, logger.ts
│   │   │   ├── i18n/                  # labels.ts (VI string table), format.ts
│   │   │   ├── validators/            # Shared zod schemas
│   │   │   ├── auth-client.ts         # Better Auth client
│   │   │   ├── convex.ts              # Convex client
│   │   │   └── utils.ts               # cn(), formatBytes()
│   │   │
│   │   ├── stores/                    # Zustand UI only
│   │   │   ├── useTabUiStore.ts
│   │   │   ├── useReaderUiStore.ts
│   │   │   ├── useSettingsUiStore.ts
│   │   │   └── useUploadUiStore.ts
│   │   │
│   │   ├── types/                     # Shared TS types
│   │   └── styles/                    # reading-mode.css
│   │
│   └── tests/
│       ├── unit/                      # Co-located trong src/
│       ├── e2e/
│       │   ├── auth.spec.ts                      # Login → Upload → Đọc
│       │   ├── highlight-note.spec.ts            # Highlight → Note → Save
│       │   └── offline-sync.spec.ts              # Offline → Online → Sync
│       └── fixtures/                  # sample.pdf, sample.epub, ...
│
└── convex/                            # Convex backend
    ├── _generated/                    # Auto-gen, gitignored
    ├── schema.ts                      # 10 tables
    ├── auth.config.ts                 # Better Auth integration
    ├── http.ts                        # HTTP routes (auth callback)
    ├── crons.ts                       # Weekly backup, mutation_log prune
    │
    ├── lib/                           # Shared helpers
    │   ├── auth.ts                    # requireAuth(ctx)
    │   ├── telemetry.ts               # logTelemetry()
    │   ├── idempotency.ts             # mutation_log dedupe
    │   ├── conflict.ts                # LWW + diff threshold
    │   └── errors.ts                  # ConvexError factory
    │
    ├── documents/                     # FR6-11
    │   ├── queries.ts
    │   ├── mutations.ts
    │   └── actions.ts                 # R2 presigned URL, upload session
    ├── reading_progress/              # FR21-24
    ├── tabs/                          # FR25-28
    ├── highlights/                    # FR29-33
    ├── notes/                         # FR34-39 (+actions cho voice transcribe P2+)
    ├── search/                        # FR40-43
    ├── tags/                          # FR10
    ├── sync/                          # D5, D6 (LWW resolver, outbox flush)
    ├── telemetry/                     # FR52-54
    ├── backup/                        # FR50 — Google Drive cron
    ├── export/                        # FR48-49 — ZIP builder
    └── shared/                        # P2+ FR55-59
```

### Architectural Boundaries

**API Boundaries (3 layer):**

1. **Public HTTP** (`apps/web/src/app/api/`):
   - `/api/auth/[...all]` — Better Auth callback
   - `/api/export/[exportId]` — ZIP download stream

2. **Convex RPC** (WebSocket reactive) — internal:
   - Queries (read, reactive cache), Mutations (write transactional), Actions (external HTTP)

3. **External APIs**: Cloudflare R2, Backblaze B2, Resend, Google Drive, OAuth providers

**Component Boundaries:**

- Viewer **không** truy cập Convex trực tiếp; nhận props từ parent → test isolation
- Tab data từ `useTabSync()` (Convex); Tab UI active từ `useTabUiStore` (Zustand) — tách biệt
- Storage abstraction (D10): viewer chỉ gọi `storage.getUrl(doc)`, không biết backend

**State Boundaries (3 lớp):**

```
┌─────────────────────────────────────────────────────────┐
│ UI ephemeral state (Zustand)                            │
│   Tab UI, sidebar, theme, modal, upload pending         │
├─────────────────────────────────────────────────────────┤
│ Data state (Convex reactive useQuery)                   │
│   documents, tabs, highlights, notes, reading_progress  │
├─────────────────────────────────────────────────────────┤
│ Offline cache & outbox (Dexie.js)                       │
│   documents_cache, mutation_outbox, media_blob          │
└─────────────────────────────────────────────────────────┘
```

**Data Boundaries:**

- Convex schema = source of truth; mọi mutation qua schema validator
- Dexie mirror partial Convex (chỉ data offline cần)
- R2/B2 chứa file binary; metadata trong Convex `documents`
- `mutation_log` = source of truth idempotency (TTL 7 ngày)

### Requirements to Structure Mapping

| FR Group | Routes | Components | Convex Module |
|---|---|---|---|
| Auth (FR1-5) | `app/(auth)/*`, `app/api/auth/[...all]` | `components/auth/*` | `convex/auth.config.ts` |
| Library (FR6-11) | `app/(authenticated)/library/*` | `components/library/*` | `documents/`, `tags/` |
| Viewers (FR12-20) | `app/(authenticated)/reader/[docId]` | `components/viewers/*` | (qua storage abstraction) |
| Reading Progress (FR21-24) | (embed reader) | `hooks/useReadingProgress.ts` | `reading_progress/` |
| Multi-Tab (FR25-28) | (embed reader) | `components/tabs/*`, `hooks/useTabSync.ts` | `tabs/` |
| Highlight (FR29-33) | (embed reader) | `components/highlight/*` | `highlights/` |
| Note (FR34-39) | `app/(authenticated)/notes/*` | `components/note/*` | `notes/` |
| Search (FR40-43) | `app/(authenticated)/search` | `components/search/*` | `search/` |
| Offline & PWA (FR44-47) | (global) | `components/offline/*` | `sync/` + Dexie |
| Data Portability (FR48-51) | `settings/export`, `app/api/export/*` | (settings) | `export/`, `backup/` |
| Telemetry (FR52-54) | `app/admin/telemetry`, `app/admin/errors` | `components/admin/*` | `telemetry/` |
| Sharing (FR55-59, P2+) | `app/(authenticated)/shared` | `components/shared/*` | `shared/` |
| Reading Mode (FR60-67) | (embed reader) | `components/reading-mode/*` | (UI prefs trong `users.preferences`) |

**Cross-cutting concerns:**

| Concern | Location |
|---|---|
| Auth gate | `app/(authenticated)/layout.tsx` + `convex/lib/auth.ts` |
| 2FA gate | `app/(authenticated)/layout.tsx` redirect logic |
| Telemetry | `lib/telemetry/logger.ts` + `convex/lib/telemetry.ts` |
| i18n VI | `lib/i18n/labels.ts` |
| Error mapping | `lib/errors.ts` (client) + `convex/lib/errors.ts` (server) |
| Storage routing (D10) | `lib/storage/index.ts` |
| Offline queue (D6) | `lib/outbox/*` + `convex/sync/*` |
| CSP & headers | `next.config.ts` + `wrangler.toml` |

### Integration Points

**Internal communication:**
- Frontend → Convex: ConvexReactClient WebSocket (auto reconnect, reactive)
- Frontend → R2/B2: presigned URL từ Convex action → direct browser upload/download
- Service Worker ↔ App: `postMessage` cho sync events; Workbox cache APIs
- Dexie ↔ Convex: outbox flush qua `useMutateWithOutbox` wrapper

**External integrations:**

```
Browser ─── WS ──→ Convex (queries/mutations/actions)
   │                  │
   │                  ├── HTTP ──→ Cloudflare R2 (presigned URL)
   │                  ├── HTTP ──→ Backblaze B2 (backup)
   │                  ├── HTTP ──→ Resend (email VI)
   │                  ├── HTTP ──→ Google Drive (backup cron)
   │                  └── HTTP ──→ OAuth providers (Better Auth)
   │
   └── HTTPS ──→ R2 direct (download tài liệu sau presigned URL)
```

**Data flow — Upload PDF:**
1. User drag-drop → `UploadDropzone`
2. `useUpload` → `api.documents.actions.requestUpload(size, format)`
3. Convex action route storage (≤5MB Convex / >5MB R2) → return `{uploadUrl, storageBackend, uploadSessionId}`
4. Frontend chunk-upload (multipart resumable)
5. On complete → `api.documents.mutations.finalize(uploadSessionId)`
6. Convex insert → reactive query updates Library
7. Telemetry: `upload.completed` with latency

**Data flow — Resume reading:**
1. User mở app iPhone → app shell load (SW cache)
2. ConvexProvider WS connect → `useTabSync()` reactive
3. User click tab → `router.push(/reader/[docId])`
4. Reader: `useQuery(api.reading_progress.queries.getByDoc(docId))`
5. ViewerDispatcher lazy load đúng viewer
6. Viewer mount → restore từ `progress.positionValue`
7. Viewer onScroll → throttle 5s → `useReadingProgress.upsert()` → mutateWithOutbox → Dexie + Convex
8. Telemetry: `resume_position.loaded`

### File Organization Patterns

- **Config files**: gốc repo (`tsconfig.base.json`, `eslint.config.js`); per-app override
- **Test co-located**: unit `Component.tsx` + `Component.test.tsx` cùng folder; E2E tách `tests/e2e/`
- **Static assets**: `apps/web/public/`
- **i18n**: 1 file `lib/i18n/labels.ts` cho VI; nếu Phase 2+ thêm EN, tách per-locale
- **Env**: `.env.example` ở root; secrets qua CF Pages dashboard + Convex deployment config
- **Generated**: `convex/_generated/` gitignored

### Development Workflow Integration

**Dev server** (2 process song song):
```bash
pnpm convex dev    # Convex live schema sync + functions
pnpm web dev       # Next.js Turbopack on :3000
```

**Build**:
```bash
pnpm build         # next build → OpenNext adapter → CF Pages output
pnpm convex deploy # Convex prod
```

**Deploy** (CI auto):
- Branch push → CF Pages preview + Convex preview deployment
- Merge `main` → CF Pages prod + Convex prod

**Local test**:
```bash
pnpm test          # Vitest
pnpm test:e2e      # Playwright (auto start dev server)
```

## Schema Supplements (Validation Gap Fixes)

3 bảng bổ sung **không có trong PRD** nhưng kiến trúc cần — append vào `convex/schema.ts`:

```ts
// Bổ sung vào defineSchema({...}) hiện tại:

mutation_log: defineTable({
  userId: v.id("users"),
  clientMutationId: v.string(),
  completedAt: v.number(),
}).index("by_client_id", ["clientMutationId"])
  .index("by_completed", ["completedAt"]),  // cron prune TTL 7 ngày

sync_conflicts: defineTable({
  userId: v.id("users"),
  entityType: v.union(
    v.literal("note"), v.literal("highlight"),
    v.literal("tag"), v.literal("reading_progress")
  ),
  entityId: v.string(),
  fieldName: v.string(),
  versionA: v.string(),
  versionB: v.string(),
  versionATs: v.number(),
  versionBTs: v.number(),
  resolved: v.boolean(),
  createdAt: v.number(),
}).index("by_user_resolved", ["userId", "resolved"]),

upload_sessions: defineTable({
  userId: v.id("users"),
  uploadId: v.string(),                   // R2 multipart upload ID
  storageBackend: v.union(
    v.literal("convex"), v.literal("r2"), v.literal("b2")
  ),
  storageKey: v.string(),
  totalSize: v.number(),
  chunkSizeBytes: v.number(),             // mặc định 100MB
  partsCompleted: v.array(v.object({
    partNumber: v.number(),
    etag: v.string(),
  })),
  format: v.string(),
  expiresAt: v.number(),                  // 24h TTL
}).index("by_user", ["userId"])
  .index("by_expires", ["expiresAt"]),    // cron prune expired
```

**Extension cho `highlights` table (PRD đã có) — thêm field voice note:**

```ts
highlights: defineTable({
  // ... fields PRD đã có ...
  voiceNoteStorageId: v.optional(v.id("_storage")),  // FR39 voice note
})
```

**Extension cho `users` table (Better Auth managed) — thêm 2FA fields:**

```ts
users: defineTable({
  // ... fields PRD đã có ...
  twoFactorEnabled: v.boolean(),
  twoFactorSecret: v.optional(v.string()),  // encrypted at rest
  backupCodes: v.optional(v.array(v.string())),  // hashed
  preferences: v.optional(v.object({
    readingMode: v.optional(v.object({
      theme: v.union(v.literal("light"), v.literal("sepia"), v.literal("dark")),
      font: v.union(v.literal("serif"), v.literal("sans"), v.literal("mono")),
      fontSize: v.number(),
      lineHeight: v.number(),
      columnWidth: v.union(v.literal("narrow"), v.literal("medium"), v.literal("wide")),
    })),
  })),
})
```

**Tổng schema cuối: 12 bảng** (9 PRD + 3 mới) + 2 extension fields.

## Architecture Validation Results

### Coherence Validation ✅

- **Decision compatibility**: Convex + Better Auth + Next.js 15 + OpenNext CF adapter tương thích (verified Apr 2026 web search)
- **Reactive query (D9) + offline outbox (D6)**: đồng bộ qua `clientMutationId` idempotency, không xung đột
- **Storage abstraction (D10) + presigned URL**: tách rời backend, viewer agnostic
- **LWW (D5) + outbox queue (D6)**: server-side reconcile khi flush
- **Pattern consistency**: `camelCase` field xuyên suốt schema → TS → API → UI
- **Structure alignment**: folder `convex/<domain>/` ánh xạ 1-1 với FR group; route `(authenticated)` group ánh xạ với auth gate; 3 lớp state tách biệt rõ

### Requirements Coverage ✅

- **68 FR**: 100% mapped (FR39 voice transcribe deferred P2+ theo PRD)
- **37 NFR**: 100% mapped (NFR22-25 accessibility được fix qua G2 enforcement rule bổ sung)

### Implementation Readiness ✅

- D1-D10 documented với rationale + version verified
- Patterns: naming/structure/format/communication/process complete
- Structure: full tree + FR mapping + data flow
- Examples: good/anti-pattern provided

### Gap Analysis & Resolutions

| ID | Gap | Resolution | Priority |
|---|---|---|---|
| G1 | 3 bảng schema thiếu (`mutation_log`, `sync_conflicts`, `upload_sessions`) | ✅ Append schema ở section trên | Important — RESOLVED |
| G2 | Accessibility patterns chưa explicit | ✅ Thêm Rule #11 vào Enforcement Guidelines | Important — RESOLVED |
| G3 | Voice note storage chưa rõ | ✅ Field `voiceNoteStorageId` + Convex `_storage` | Important — RESOLVED |
| G4 | Multipart resumable upload chưa định nghĩa | ✅ R2 multipart API + `upload_sessions` table | Important — RESOLVED |
| G5 | Bundle size budget per route | ⏭ Defer — set khi có data thật từ build đầu | Minor |
| G6 | Backup redundancy nếu Drive token revoke | ⏭ Defer — UI nhắc export local weekly | Minor |
| G7 | Web clipper extension repo | ⏭ Phase 2+ (`apps/clipper-extension/` Manifest V3) | Minor |
| G8 | Storybook component dev | ⏭ Phase 2+ khi share team | Minor |
| G9 | Convex `_storage` IDs vs custom `storageKey` | ✅ Document trong D10: Convex backend dùng `Id<"_storage">`, R2/B2 dùng `string` key | Minor — RESOLVED |

### Enforcement Guidelines Update — Rule #11 (Accessibility)

```
11. ARIA & a11y (NFR22-25):
    - Mọi viewer control phải có aria-label tiếng Việt
    - Modal/dialog dùng shadcn Dialog (Radix focus trap auto)
    - Keyboard shortcuts khai báo trong lib/keyboard/shortcuts.ts
      (F: reading mode, Ctrl+N: note, Esc: thoát, ←/→: page,
       Cmd+Shift+R: reading mode toggle alt)
    - Test gate: @axe-core/playwright violations = 0 cho mỗi page test
    - Contrast ≥ 4.5:1 cho cả 3 theme (Light/Sepia/Dark) — verify
      qua axe trong CI
    - Tap target mobile ≥ 44×44 px (NFR31)
```

### Architecture Completeness Checklist

- [x] **Requirements Analysis** — context, scale, constraints, cross-cutting
- [x] **Architectural Decisions** — D1-D10 documented
- [x] **Implementation Patterns** — 5 nhóm + 11 enforcement rule
- [x] **Project Structure** — full tree + FR mapping + data flow
- [x] **Schema** — 12 bảng + extensions
- [x] **Validation** — coherence + coverage + readiness pass

### Architecture Readiness Assessment

**Overall Status: ✅ READY FOR IMPLEMENTATION**

**Confidence Level: HIGH**
- 100% FR + 100% NFR architectural support
- Stack verified Apr 2026 (no deprecation hidden)
- $0/tháng giữ vững với backup plan từng layer
- Pattern đủ chi tiết cho Claude Code implement consistent

**Key Strengths:**
- Stack tối giản 3 dịch vụ chính + 3 backup plan
- Schema chuẩn bị multi-user từ MVP (P2+ không migration đau)
- Reactive subscription thay WebSocket riêng → giảm dependency
- Storage abstraction (D10) cho phép swap backend ≤1 tuần (NFR29)
- Position abstraction unified (5 type) — innovation 1
- Outbox + LWW + cron prune giải quyết offline reliability bền vững

**Areas for Future Enhancement:**
- CRDT (Yjs) cho collaborative note khi share team >5 người (P3+)
- Vector search (Convex sẵn có) cho semantic search (P2+)
- Web Push notification (iOS 16.4+ supported, P2+)
- Storybook (P2+ khi share)
- Web clipper Chrome extension (P2+ repo riêng)

### Implementation Handoff

**AI Agent Guidelines:**
- Đọc `AGENTS.md` đầu mỗi story
- Follow D1-D10 exactly
- Tuân thủ naming + state boundary patterns
- Reference architecture.md cho mọi câu hỏi

**First Implementation Priority (Story 1 — Init):**

```bash
# 1. Init từ Convex template (Step 3 starter)
npm create convex@latest web-knowledge-base -- \
  -t get-convex/template-nextjs-convexauth-shadcn

cd web-knowledge-base

# 2. Swap Convex Auth → Better Auth (D2)
#    Theo guide: https://labs.convex.dev/better-auth/getting-started
npm install @convex-dev/better-auth better-auth

# 3. Add OpenNext Cloudflare adapter (D1)
npm install -D @opennextjs/cloudflare

# 4. Init wrangler.toml với nodejs_compat_v2 + R2 binding
#    (xem cấu hình mẫu trong open-next.config.ts)

# 5. Verify build + deploy preview CF Pages
npm run build
npx wrangler pages deploy

# 6. First commit → CI pipeline (.github/workflows/ci.yml)
git add . && git commit -m "feat: init project per architecture doc"
```
