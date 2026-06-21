# Migration: Convex → Supabase (nhánh `supabase`)

> Mục tiêu: chuyển backend từ Convex sang Supabase (Postgres + Realtime + Auth + FTS),
> giữ nguyên file trên Cloudflare R2. Nhánh `main` (bản Convex) **không đụng tới**.
> Lý do: Convex free tier khóa do Database I/O 1GB; Supabase free 5GB egress + tính nhẹ hơn.

## Nguyên tắc
- Làm trên nhánh `supabase`. UI React giữ nguyên ~85%; chỉ đổi tầng dữ liệu.
- Mỗi phase commit riêng, build pass mới sang phase sau.
- File vẫn ở R2 (storageKey không đổi) → KHÔNG cần migrate file.

## Cái gì giữ — cái gì thay
| Thành phần | Convex (cũ) | Supabase (mới) |
|---|---|---|
| Database | Convex tables | Postgres (SQL migrations) |
| Realtime | `useQuery` reactive | Supabase Realtime + hook tự viết |
| Auth | Better Auth trên Convex HTTP | Supabase Auth (GoTrue) native |
| Full-text search | Convex search index | Postgres `tsvector` + GIN |
| Server actions (extract text) | Convex Node action | Vercel serverless route (Node) |
| Presigned R2 URL | Convex action | Vercel route (S3 SDK — bê nguyên) |
| Cron (prune) | Convex cron | `pg_cron` hoặc Vercel Cron |
| File storage | R2 | **R2 (giữ nguyên)** |

## Lộ trình (phases)
- [x] **Phase 0** — Tạo Supabase project + cài SDK/CLI + env
- [x] **Phase 1** — Schema Postgres: bảng + FK + index + RLS + tsvector  (đã chạy 0001_init.sql)
- [x] **Phase 2** — Auth: Supabase Auth email/password + forgot/reset. (Google tạm tắt; MFA để sau)
- [x] **Phase 3** — Data layer XONG: toàn bộ domain `lib/api/*` + mọi trang/consumer đã rời Convex (chỉ `useSearch` còn lại cho Phase 5). tsc=0. Smoke-test 12/12 PASS.

### Tiến độ Phase 3 (commit theo domain trên nhánh `supabase`)
- ✅ Foundation: `hooks/useRealtimeQuery.ts` (có option `select`), `providers/SupabaseProvider.tsx`
- ✅ Domain API (`lib/api/*`): reading-progress, tags, folders, documents, **notes, note-tabs, highlights, tabs, users (profiles), reading-history**
- ✅ R2: `lib/r2.ts`, `app/api/storage/{upload-url,download-url}/route.ts`
- ✅ Hook lá đã đổi sang Supabase: useReadingProgress, **useNotes, useNoteTabs, useHighlights, useTabSync, useReadingModePrefs**
- ✅ Domain API (`lib/api/*`) bổ sung: **ai-settings, transcripts (read)**
- ✅ Consumer/trang đã đổi hẳn sang lib/api (bỏ convex): RecentHistory, TagPopover, FilterBar, ReadingHistoryPopover,
  **DocumentCard, useDocExport, useBackupDownload, LibraryPageInner, DataPrefetcher, TabBar, TabDropdown,
  UploadDropzone, AudioFinishDialog, ScreenFinishDialog, AudioViewer, VideoViewer, CrossLinkHoverCard, ReaderPageInner**
- ✅ Consumer đổi MỘT PHẦN (đã bỏ phần read/write có thể, còn giữ convex cho action Phase 4):
  - SettingsPageInner: aiSettings → lib/api; còn deleteAccount/backfillExtractText/getStorageStats (action/query)
  - TranscriptButton: aiSettings + getDownloadUrl → lib/api; còn transcripts mutations + getWebmChunks (action)
- ✅ Non-hook getters (export/backup): getAllDocumentsFull, getNotesByDoc/getAllNotesWithDocTitle,
  getHighlightsByDoc/getAllHighlights, getAllTags, getAllReadingProgress, getMyPreferences
- 🎉 **`npx tsc --noEmit` = 0 lỗi.** Toàn bộ tầng đọc + ghi đơn giản đã rời convex.

- ✅ Domain API bổ sung: **domains, handbooks** (reads + CRUD + folder ops + finalizeImport), **transcripts mutations**
- ✅ Đã migrate hẳn: HandbookSidebar, ImportZipDialog, HandbookResolverContext (read), TranscriptButton (mutations), NoteEditor (add-to-library), SettingsPageInner (stats)

### 🎉 PHASE 3+4+5 HOÀN TẤT — APP ĐÃ RỜI CONVEX HOÀN TOÀN (runtime)
- Toàn bộ read/write/action/search đã chạy trên Supabase. Smoke-test 12/12 (data) + 4/4 (search) PASS. Realtime cần `0002_realtime.sql` (đã chạy).
- **0 file `src/` import `convex/react` hoặc `@/_generated/api`.** (Chỉ còn type `Id<>` từ `@/_generated/dataModel` — pure type, vô hại, dọn sau nếu muốn.)
- CÒN: Phase 6 (migrate data Convex cũ → Postgres), Phase 7 (deploy + test thật upload/transcribe/ZIP). Tùy chọn: Vercel Cron prune; gỡ ConvexProvider/dep convex; voice note media trong export.

## [x] Phase 4 — Server routes (Next API, Node runtime) ĐÃ VIẾT
| Route | Phục vụ |
|---|---|
| `POST /api/documents/extract` | trích text pdf/docx/epub/md/web_clip → `extractedText` (gọi fire-and-forget từ finalizeUpload/finalizeImport/copy-to-library) |
| `backfillExtractText()` (lib/api, fan-out route) | trích text cho doc cũ thiếu |
| `POST /api/account/delete` | service_role xoá auth user (cascade) |
| `POST /api/storage/upload-url` (+param `prefix`) | presigned PUT, prefix `notes/` cho media note |
| `POST /api/notes/copy-to-library` | copy media note → document |
| `POST /api/handbooks/asset-urls` | map relPath→presigned URL ảnh handbook |
| `POST /api/transcripts/webm-chunks` | tính ranh giới chunk audio/video (EBML) |
- getNoteMediaUrl tái dùng `/api/storage/download-url` theo storageKey.
- ⏳ CÒN: voice note media trong export (voiceUrls để trống); (tùy chọn) Vercel Cron prune trash + dọn R2 mồ côi.
- ⚠️ CHƯA test thực tế route với upload/transcribe thật (cần đăng nhập + file thật) — verify ở Phase 7 hoặc khi chạy app.

### PATTERN chuyển đổi 1 call site (cơ học)
| Convex | Supabase |
|---|---|
| `useQuery(api.X.queries.listByUser)` | `useXxxList()` từ `lib/api/X` (dùng `useRealtimeQuery`) |
| `useQuery(api.X.queries.getByDoc, {docId})` | `useRealtimeOne("table", {filter:{docId}})` hoặc hook domain |
| `useMutation(api.X.mutations.foo)` → `await foo(args)` | `import { foo } from "lib/api/X"; await foo(...)` |
| `useAction(api.documents.actions.getDownloadUrl)` | `import { getDownloadUrl } from "lib/api/documents"` |
| `Id<"documents">` | `string` |
| import `{ api }`, `convex/react` | XOÁ; import từ `@/lib/api/*` |

Lưu ý: bỏ `useMutation`/`useAction` wrapper — gọi thẳng async function. Bỏ import `convex/react` + `@/_generated/*`.
- [x] **Phase 4** — Server routes ĐÃ VIẾT (extract/backfill, account/delete, note media + copy-to-library, handbooks/asset-urls, transcripts/webm-chunks). Chi tiết ở mục "Phase 4 — Server routes" bên dưới. ⚠️ chưa test với file/upload thật. Còn (tùy chọn): Vercel Cron prune trash + dọn R2 mồ côi.
- [x] **Phase 5** — Search FTS XONG: `lib/api/search.ts` dùng PostgREST `.textSearch("searchVector", q, {type:websearch, config:simple})` cho documents+notes, `.ilike` note cho highlights (RLS tự lọc, KHÔNG cần RPC). `useSearch` → hook debounce fetch. Smoke-test 4/4 PASS. **→ KHÔNG còn file nào import Convex (runtime) nữa.**
- [x] ~~**Phase 6** — Migrate dữ liệu cũ~~ **ĐÃ HUỶ (fresh start)**: user quyết định không migrate. Note quan trọng duy nhất ("Ôn tập Aptis") đã xuất ra `Ôn tập Aptis.md`. Đã **xoá sạch 94 object R2** (540MB tài liệu cũ). Supabase mới bắt đầu từ trống. Convex cũ bỏ mặc (locked).
- [ ] **Phase 7** — Deploy: Vercel project thứ 2 trỏ nhánh `supabase` + keep-alive ping; test thật (upload/transcribe/handbook ZIP); cutover

---

## Phase 0 — Setup (bạn thao tác)

### 0.1 Tạo Supabase project
1. Vào https://supabase.com → đăng nhập (GitHub) → **New project**.
2. Chọn **Free plan**, region gần VN nhất: **Southeast Asia (Singapore)**.
3. Đặt **Database Password** mạnh → LƯU LẠI (cần cho connection string).
4. Đợi ~2 phút project khởi tạo.

### 0.2 Lấy keys (Project Settings → API)
Lưu vào nơi an toàn:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key (BÍ MẬT, chỉ dùng server) → `SUPABASE_SERVICE_ROLE_KEY`

### 0.3 (Sau, ở Phase 4) Connection string — Settings → Database → Connection string (URI).

> Hoàn tất 0.1–0.2 rồi báo mình. Mình sẽ thêm SDK, cập nhật `.env`, và bắt đầu Phase 1 (viết SQL schema).
