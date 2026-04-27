---
title: 'Epic 2: Content Library & Multi-Format Upload'
type: 'feature'
created: '2026-04-27'
status: 'draft'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Người dùng chưa thể upload, tổ chức, hay quản lý tài liệu — `/library` hiện là empty state placeholder không có chức năng gì.

**Approach:** Implement toàn bộ Epic 2 — storage abstraction layer (D10), upload drag-drop multi-file lên Convex (≤5 MB) hoặc R2 (>5 MB), library grid/list reactive, tag+folder, filter, rename, soft-delete 30 ngày + restore.

## Boundaries & Constraints

**Always:**
- Mọi Convex function bắt đầu bằng `requireAuth(ctx)` từ `convex/lib/auth.ts`
- Throw `ConvexError` typed (không `throw new Error(...)`)
- UI labels tiếng Việt từ `lib/i18n/labels.ts`
- File access qua presigned URL expire ≤15 phút (NFR11) — không public URL cố định
- Tất cả free-tier: Convex storage cho file ≤5 MB, R2 cho >5 MB
- Field names `camelCase` trong Convex schema (đã có sẵn)
- `storageBackend` phải ghi vào `documents` để Epic 3 biết cách lấy file

**Ask First:**
- Nếu R2 credentials chưa được cấu hình trong env → hỏi trước khi implement R2 upload path
- Nếu phát hiện schema cần thay đổi breaking change → hỏi trước khi migrate

**Never:**
- Không implement viewer (Epic 3)
- Không implement search full-text (Epic 6)
- Không implement offline/PWA (Epic 8)
- Không dùng public R2 URL không expire
- Không copy Convex data sang Zustand store

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upload file hợp lệ ≤5 MB | File PDF/EPUB/DOCX/PPTX/image/audio/video/MD drop vào dropzone | Progress bar → insert `documents` row → card hiện trong grid | Toast VI nếu Convex storage fail |
| Upload file >5 MB | File >5 MB drop vào dropzone | Chunk upload qua R2 presigned multipart, progress realtime | Toast VI nếu R2 fail; retry |
| Upload format không hỗ trợ | File .exe drop | Reject client-side, toast VI "Định dạng không hỗ trợ", không gọi server | N/A |
| Upload nhiều file cùng lúc | 3 file drop cùng lúc | 3 upload song song, progress độc lập mỗi file | Lỗi từng file báo riêng lẻ |
| Rename document | Double-click title → nhập tên mới → Enter | Mutation `rename` → title cập nhật realtime | Validation: empty/>200 chars → toast VI |
| Xoá vào thùng rác | Bấm "Xoá" + confirm | `status: "trashed"`, `trashedAt = now` → biến mất khỏi main list | N/A |
| Khôi phục từ trash | Bấm "Khôi phục" trong sidebar trash | `status: "ready"`, `trashedAt = null` → hiện lại trong library | N/A |
| Xoá vĩnh viễn | Bấm "Xoá vĩnh viễn" + confirm | Delete row + gọi `storage.delete(storageKey)` | Toast VI nếu storage delete fail |
| Gán tag | Click "Gán tag" → gõ tag mới → Enter | Tạo tag mới + gán vào doc qua `document_tags` | N/A |
| Filter theo tag | Click tag trong filter bar | List chỉ hiện doc có tag đó; URL query cập nhật | Empty state VI nếu 0 kết quả |

</frozen-after-approval>

## Code Map

- `convex/lib/auth.ts` -- `requireAuth(ctx)` helper — cần tạo mới
- `convex/lib/errors.ts` -- `ConvexError` factory helpers — cần tạo mới
- `convex/lib/telemetry.ts` -- `logTelemetry()` helper — cần tạo mới
- `convex/documents/queries.ts` -- `listByUser`, `getById`, `listTrashed` — cần tạo mới
- `convex/documents/mutations.ts` -- `finalize`, `rename`, `trash`, `restore`, `deletePermanent` — cần tạo mới
- `convex/documents/actions.ts` -- `requestUploadUrl` (route Convex vs R2), `generateDownloadUrl` — cần tạo mới
- `convex/tags/queries.ts` -- `listByUser` — cần tạo mới
- `convex/tags/mutations.ts` -- `create`, `addToDoc`, `removeFromDoc` — cần tạo mới
- `convex/folders/queries.ts` -- `listByUser` — cần tạo mới
- `convex/folders/mutations.ts` -- `create`, `assignDocToFolder`, `removeDocFromFolder` — cần tạo mới
- `convex/crons.ts` -- prune trash 30 ngày + prune expired upload_sessions — cần tạo mới
- `apps/web/src/lib/storage/types.ts` -- `StorageProvider` interface — cần tạo mới
- `apps/web/src/lib/storage/ConvexStorage.ts` -- Convex file storage provider — cần tạo mới
- `apps/web/src/lib/storage/R2Storage.ts` -- R2 presigned URL provider — cần tạo mới
- `apps/web/src/lib/storage/index.ts` -- router: file ≤5 MB → Convex, >5 MB → R2 — cần tạo mới
- `apps/web/src/lib/i18n/labels.ts` -- thêm library/upload/tags/trash labels — đã có, cần mở rộng
- `apps/web/src/components/library/UploadDropzone.tsx` -- drag-drop + nút chọn file, progress — cần tạo mới
- `apps/web/src/components/library/DocumentCard.tsx` -- card: icon, title, size, date, tag badges, actions menu — cần tạo mới
- `apps/web/src/components/library/DocumentGrid.tsx` -- grid responsive + list toggle — cần tạo mới
- `apps/web/src/components/library/FilterBar.tsx` -- tag/folder/format/date filter, URL sync — cần tạo mới
- `apps/web/src/components/library/TagPopover.tsx` -- multi-select tag với create inline — cần tạo mới
- `apps/web/src/components/library/RenameDialog.tsx` -- inline rename hoặc dialog — cần tạo mới
- `apps/web/src/components/library/TrashView.tsx` -- danh sách trashed docs — cần tạo mới
- `apps/web/src/components/ui/dialog.tsx` -- shadcn Dialog — cần add
- `apps/web/src/components/ui/badge.tsx` -- shadcn Badge — cần add
- `apps/web/src/components/ui/popover.tsx` -- shadcn Popover — cần add
- `apps/web/src/components/ui/select.tsx` -- shadcn Select — cần add
- `apps/web/src/components/ui/dropdown-menu.tsx` -- shadcn DropdownMenu — cần add
- `apps/web/src/components/ui/skeleton.tsx` -- shadcn Skeleton — cần add
- `apps/web/src/app/library/page.tsx` -- thay empty state bằng DocumentGrid + FilterBar + UploadDropzone — đã có, rewrite
- `apps/web/src/app/library/trash/page.tsx` -- TrashView page — cần tạo mới

## Tasks & Acceptance

**Execution:**

**Backend — Convex lib helpers:**
- [ ] `convex/lib/auth.ts` -- export `requireAuth(ctx: QueryCtx | MutationCtx): Promise<string>` — throw `ConvexError({code:"FORBIDDEN",...})` nếu không có identity; trả `identity.subject`
- [ ] `convex/lib/errors.ts` -- factory `convexError(code, message, messageVi?, meta?)` trả `ConvexError` typed theo architecture format
- [ ] `convex/lib/telemetry.ts` -- `logTelemetry(ctx, event, {latencyMs?, ...meta})` insert vào `telemetry_events` table

**Backend — Documents:**
- [ ] `convex/documents/queries.ts` -- `listByUser({status?})`: query `by_user_status` trả array sorted `createdAt desc`; `getById({docId})`: auth guard; `listTrashed()`: filter `status=="trashed"` sorted `trashedAt desc`
- [ ] `convex/documents/mutations.ts` -- `rename({docId, newTitle})`: auth + validate 1–200 chars + patch title+updatedAt; `trash({docId})`: set `status:"trashed"`, `trashedAt:now`; `restore({docId})`: set `status:"ready"`, `trashedAt:null`; `deletePermanent({docId})`: verify trashed, xoá row (storage delete qua action riêng); `finalizeUpload({uploadSessionId, title, format, fileSizeBytes, storageBackend, storageKey})`: insert documents row, delete upload_session
- [ ] `convex/documents/actions.ts` -- `requestUploadUrl({fileSizeBytes, format})`: nếu ≤5 MB → `ctx.storage.generateUploadUrl()` trả Convex upload URL; nếu >5 MB → generate R2 presigned multipart URL (dùng env `R2_*`); insert `upload_sessions`; `generateDownloadUrl({docId})`: lấy doc, route theo `storageBackend` → Convex `ctx.storage.getUrl()` hoặc R2 presigned GET ≤15 phút

**Backend — Tags:**
- [ ] `convex/tags/queries.ts` -- `listByUser()`: trả tất cả tags của user; `listForDoc({docId})`: join qua `document_tags`
- [ ] `convex/tags/mutations.ts` -- `create({name, color?})`: tạo tag; `addToDoc({docId, tagId})`: insert `document_tags` (idempotent — check duplicate); `removeFromDoc({docId, tagId})`: delete từ `document_tags`; `createAndAddToDoc({docId, name})`: tạo tag mới + add luôn

**Backend — Folders:**
- [ ] `convex/folders/queries.ts` -- `listByUser()`: trả tất cả folders của user; `listDocsInFolder({folderId})`: join qua `document_folders`
- [ ] `convex/folders/mutations.ts` -- `create({name})`: tạo folder; `assignDoc({docId, folderId})`: upsert `document_folders` (1 doc chỉ có 1 folder — xoá row cũ nếu có); `removeDoc({docId})`: xoá khỏi folder

**Backend — Crons:**
- [ ] `convex/crons.ts` -- schedule weekly: query `documents` có `trashedAt < now - 30d` → `deletePermanent` từng doc; schedule daily: query `upload_sessions` có `expiresAt < now` → set `status:"aborted"`, abort R2 multipart nếu có

**Frontend — Packages (install trước khi code):**
- [ ] `apps/web/package.json` -- add `@aws-sdk/client-s3`, `date-fns`, `uuidv7` — chạy `npm install` trong `apps/web/`

**Frontend — shadcn Components:**
- [ ] `apps/web/src/components/ui/` -- add `dialog.tsx`, `badge.tsx`, `popover.tsx`, `select.tsx`, `dropdown-menu.tsx`, `skeleton.tsx`, `progress.tsx`, `alert-dialog.tsx` — dùng shadcn CLI hoặc copy từ shadcn/ui

**Frontend — i18n:**
- [ ] `apps/web/src/lib/i18n/labels.ts` -- thêm sections: `upload` (dropzone, progress, errors), `library` mở rộng (filter, grid/list toggle, tag, folder, trash, rename), `trash` (empty state, restore, delete)

**Frontend — Storage abstraction:**
- [ ] `apps/web/src/lib/storage/types.ts` -- interface `StorageProvider` với: `upload(file, onProgress?): Promise<{storageBackend, storageKey}>`, `getDownloadUrl(storageBackend, storageKey): Promise<string>`, `delete(storageBackend, storageKey): Promise<void>`
- [ ] `apps/web/src/lib/storage/ConvexStorage.ts` -- implement qua Convex action `requestUploadUrl` + fetch PUT
- [ ] `apps/web/src/lib/storage/R2Storage.ts` -- implement qua R2 presigned URL từ Convex action; multipart cho file >100 MB
- [ ] `apps/web/src/lib/storage/index.ts` -- export `getStorageProvider(fileSizeBytes)`: ≤5 MB → ConvexStorage, >5 MB → R2Storage; export `StorageRouter` class

**Frontend — Upload component:**
- [ ] `apps/web/src/components/library/UploadDropzone.tsx` -- drag-drop zone + nút "Chọn file"; accept MIME types cho 8 format; reject unsupported → toast VI; multi-file: mỗi file 1 progress bar; call `StorageRouter.upload()` → on complete call `api.documents.mutations.finalizeUpload`; show error per-file

**Frontend — Library display:**
- [ ] `apps/web/src/components/library/DocumentCard.tsx` -- card: format icon (lucide), title (double-click → inline rename input), formatted size (`formatBytes`), `createdAt` VI locale (`date-fns/locale/vi`), tag badges (`Badge` shadcn), `DropdownMenu` với actions: Mở, Đổi tên, Gán tag, Chuyển folder, Xoá; aria-label VI
- [ ] `apps/web/src/components/library/DocumentGrid.tsx` -- nhận `docs[]`, render grid responsive (2 col mobile, 3 col tablet, 4 col desktop); toggle grid/list view; skeleton khi loading; empty state với CTA
- [ ] `apps/web/src/components/library/FilterBar.tsx` -- multi-select tags (Popover + checkbox), single folder (Select), multi-select format (Popover), date range (2 input date); sync với URL `?tags=&folder=&format=&from=&to=`; nút "Xoá bộ lọc"
- [ ] `apps/web/src/components/library/TagPopover.tsx` -- Popover với input tìm/tạo tag; checkbox list tag hiện có; Enter tạo tag mới + add; loading state khi mutate
- [ ] `apps/web/src/components/library/TrashView.tsx` -- list docs trashed; card compact với `trashedAt` countdown "Còn X ngày"; button Khôi phục + Xoá vĩnh viễn (AlertDialog confirm)

**Frontend — Pages:**
- [ ] `apps/web/src/app/library/page.tsx` -- rewrite: `useQuery(api.documents.queries.listByUser)` với filter params từ URL; render `FilterBar` + `UploadDropzone` modal/drawer + `DocumentGrid`; button "Thùng rác" link to `/library/trash`
- [ ] `apps/web/src/app/library/trash/page.tsx` -- trang mới; `useQuery(api.documents.queries.listTrashed)`; render `TrashView`; link back to library

**Acceptance Criteria:**
- Given user drop file PDF ≤5 MB, when upload complete, then card xuất hiện trong grid ngay lập tức (Convex reactive)
- Given user drop file video >5 MB, when upload chạy, then progress bar hiển thị %; khi xong card xuất hiện
- Given file định dạng .exe, when drop, then toast VI "Định dạng không hỗ trợ", không gọi server
- Given user double-click title, when gõ tên mới + Enter, then title cập nhật realtime; Esc cancel không lưu
- Given user bấm Xoá + confirm, when mutation xong, then doc biến khỏi library main; hiện trong /library/trash
- Given user trong trash bấm Khôi phục, then doc về lại library, trashedAt = null
- Given user filter theo tag "React", when apply, then chỉ hiện doc có tag "React"; URL query `?tags=React`
- Given filter 0 kết quả, when apply, then empty state VI "Không tài liệu nào khớp bộ lọc"
- Given cron weekly chạy, when `trashedAt < now - 30 ngày`, then doc bị delete vĩnh viễn + storage cleaned

## Design Notes

**RequireAuth pattern:**
```ts
// convex/lib/auth.ts
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "FORBIDDEN", message: "Auth required", messageVi: "Bạn cần đăng nhập" });
  return identity.subject; // Better Auth subject = userId string
}
```

**ConvexError typed format (theo architecture):**
```ts
throw new ConvexError({
  code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "INTERNAL",
  message: string,    // English (log)
  messageVi?: string, // Toast UI
})
```

**Format icon mapping (DocumentCard):**
```ts
const FORMAT_ICONS = { pdf: FileText, epub: BookOpen, docx: FileType, pptx: Presentation, image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe }
```

**File size routing:**
```ts
const CONVEX_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
```

## Verification

**Commands:**
- `cd "C:\1. FOR STUDY\8. WEB KNOWLEDGE BASE" && npx convex dev --once` -- expected: schema deploys without errors
- `cd apps/web && npm run typecheck` -- expected: 0 TypeScript errors
- `cd apps/web && npm run build` -- expected: build succeeds

**Manual checks:**
- Mở `/library` → thấy UploadDropzone + empty state
- Drop file PDF nhỏ → thấy progress → card xuất hiện
- Double-click title → rename → Enter → title thay đổi
- Click Xoá → confirm → card biến mất → vào `/library/trash` thấy doc
- Click Khôi phục → doc về library
