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
- [~] **Phase 3** — Data layer (ĐANG LÀM): foundation + domains reading_progress/tags/folders/documents-API + R2 routes xong; còn cập nhật consumer + domains notes/highlights/tabs/handbooks/transcripts.

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

### Còn lại — 7 file vẫn import convex (đều kẹt Phase 4/5, KHÔNG migrate được bằng lib/api hiện có)
- `NoteEditor` — note media upload (requestNoteMediaUploadUrl/getNoteMediaUrl/copyNoteFileToLibrary) → cần R2 route Phase 4
- `SettingsPageInner` — deleteAccount, backfillExtractText, getStorageStats
- `TranscriptButton` — transcripts mutations (init/updateStatus/saveSegments) + getWebmChunks (action)
- `HandbookResolverContext` — handbooks.listHandbookFiles (read) + getAssetUrls (action)
- `HandbookSidebar` — domains + handbooks mutations + finalizeImport (ZIP ingest)
- `ImportZipDialog` — handbooks.finalizeImport (ZIP ingest)
- `useSearch` — Phase 5 (Postgres FTS)
- ⚠️ Nợ: voice note media trong export (voiceUrls) để trống; domains/handbooks domain chưa tạo lib/api (chờ Phase 4 vì gắn với action ingest).

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
- [ ] **Phase 4** — Server functions: extract text + presigned URL → Vercel routes; cron
- [ ] **Phase 5** — Search: RPC FTS Postgres thay query `search`
- [ ] **Phase 6** — Migrate dữ liệu cũ: export Convex → transform → import Postgres (khi Convex bật lại)
- [ ] **Phase 7** — Deploy: Vercel project thứ 2 trỏ nhánh `supabase` + keep-alive ping; test; cutover

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
