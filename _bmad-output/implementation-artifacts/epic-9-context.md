# Epic 9 Context: Data Portability, Backup & Self-Observability

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

User có thể export toàn bộ hoặc từng tài liệu riêng lẻ ra ZIP (Markdown + JSON + file gốc, tương thích Obsidian); hệ thống tự backup snapshot weekly lên Google Drive của chính user và giữ ≥ 4 bản gần nhất; user có thể xoá vĩnh viễn tài khoản và toàn bộ dữ liệu; và có thể xem telemetry dashboard cá nhân (latency p50/p95, retention, days active) cùng error log để tự debug — tất cả không gửi bất kỳ dữ liệu ra third-party.

## Stories

- Story 9.1: Export 1 tài liệu đơn lẻ ra ZIP
- Story 9.2: Export toàn bộ library ra ZIP (`/export/all`)
- Story 9.3: Auto backup weekly lên Google Drive (cron + OAuth)
- Story 9.4: Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu
- Story 9.5: Telemetry ghi DB + dashboard `/admin/telemetry`
- Story 9.6: Error log table + dashboard `/admin/errors`

## Requirements & Constraints

**Export (Stories 9.1 & 9.2)**
- Export đơn lẻ: ZIP chứa file gốc (`<title>.<ext>`), `highlights.md` (dạng bảng), `notes/<noteId>.md` cho mỗi note thuộc doc đó, và `voice/<highlightId>.mp3` nếu có voice note.
- Export toàn bộ: ZIP có cấu trúc `documents/<docId>/<title>.<ext>`, `documents/<docId>/highlights.md`, `notes/<noteId>.md` (frontmatter `tags`, `parentDocId`), `data.json` (tags, reading_progress, sync_conflicts, user preferences), và `README.md` hướng dẫn Obsidian.
- Wikilink `[[doc-title]]` trong Markdown phải hoạt động khi mở trong Obsidian (NFR32).
- Export toàn bộ: phải hoàn thành trong ≤ 2 phút với thư viện ≤ 1.000 tài liệu, ≤ 5 GB (NFR19).
- ZIP build server-side qua Convex action; stream về browser qua `/api/export/[exportId]/route.ts`.
- Export toàn bộ dùng Convex scheduled action (job queue); UI hiển thị progress; xong thì cung cấp link download.

**Backup Google Drive (Story 9.3)**
- User authorize qua OAuth; refresh token lưu encrypted trong field `users.googleDriveRefreshToken`.
- Cron Convex chạy **Sunday 03:00 ICT** — tạo ZIP snapshot (dùng lại logic Story 9.2) → upload vào Drive folder `WebKnowledgeBase-Backups/<YYYY-MM-DD>.zip`.
- Auto-prune: giữ đúng 4 bản gần nhất, xoá bản cũ hơn.
- Khi fail (token revoke / Drive đầy): ghi `error_logs` + gửi email cảnh báo qua Resend.
- `/settings/backup` hiển thị danh sách 4 backup gần nhất, thời gian, size, và nút "Backup ngay".

**Xoá tài khoản (Story 9.4)**
- Confirm bằng email + password trước khi xoá.
- Convex action xoá toàn bộ: documents (kèm file storage qua `storage.delete`), tags, notes, highlights, reading_progress, tabs, voice_notes; sau đó xoá Better Auth user và revoke session.
- Sau xoá: redirect về landing, toast "Tài khoản đã xoá vĩnh viễn". Không có khả năng recover.

**Telemetry (Story 9.5)**
- Schema: `telemetry_events(userId, eventName, latencyMs?, deviceId, meta, ts)` — index `by_event_ts`, `by_user_ts`.
- Các event cần instrument: `resume_position.loaded`, `tabs.synced`, `note.saved`, `search.executed`, `upload.completed`, `outbox.flushed` — mỗi event ghi `latencyMs` và `meta`.
- Dashboard `/admin/telemetry`: bảng p50/p95/p99 theo event (7 ngày), line chart days active (30 ngày), counter doc đọc / highlight / note tạo trong tuần, heatmap giờ active.
- Bảo vệ bằng hardcoded check `userId === ADMIN_USER_ID` (env var).
- **Không gửi ra third-party** (không `google-analytics.com`, không `posthog.com`) — NFR13.

**Error logging (Story 9.6)**
- Schema: `error_logs(userId, errorCode, message, stack, route, userAgent, ts)` — index `by_user_ts`.
- `lib/errors.ts` client wrapper: mọi unknown error (không phải `ConvexError` typed) → mutation `error_logs.insert(...)`.
- `app/error.tsx` global Error Boundary: catch uncaught render error → log + hiển thị fallback UI tiếng Việt.
- Dashboard `/admin/errors`: 100 error gần nhất, filter theo route + errorCode, action "Mark resolved".

**Cost constraint**: Mọi API call (Google Drive OAuth, Resend email) phải nằm trong free tier vĩnh viễn ($0/tháng cứng).

## Technical Decisions

**Export ZIP generation**
- Build server-side trong Convex action (không build client-side) để tránh timeout browser và để stream về.
- Date/time trong `data.json`: ISO string (không ms epoch) — nhất quán với convention export.
- Dùng `date-fns/locale/vi` để format timestamp UI tiếng Việt.

**Backup cron**
- Khai báo trong `convex/crons.ts` — Convex managed cron scheduler.
- Refresh token lưu encrypted tại rest (AES-256, NFR10).
- Google Drive API dùng OAuth2 flow; `googleDriveRefreshToken` là field mới trên bảng `users` (extend Better Auth schema).

**Schema mới cần deploy**
- `telemetry_events` với index `by_event_ts`, `by_user_ts`
- `error_logs` với index `by_user_ts`
- Field mới `users.googleDriveRefreshToken: v.optional(v.string())`

**Naming conventions**
- Convex functions: `camelCase` — `exportDocument`, `exportAllDocuments`, `runBackup`, `deleteAccount`
- Routes: `app/admin/telemetry/page.tsx`, `app/admin/errors/page.tsx`, `app/settings/export/page.tsx`, `app/settings/backup/page.tsx`
- Export API route: `app/api/export/[exportId]/route.ts`
- Telemetry helper: `lib/telemetry/logger.ts` (client) + `convex/lib/telemetry.ts` (server)
- Error helper: `lib/errors.ts`

**Storage routing**: Export ZIP cần đọc file từ cả Convex file storage (≤5MB) và Cloudflare R2 (>5MB) qua `StorageProvider` interface tại `apps/web/src/lib/storage/index.ts`.

## UX & Interaction Patterns

- **Export đơn lẻ**: Nút "Export" trên card tài liệu → trigger download ngay (không cần progress bar vì file đơn).
- **Export toàn bộ**: `/settings/export` → click "Export tất cả" → progress indicator (job async) → link download khi xong.
- **Backup settings**: `/settings/backup` → nút "Kết nối Google Drive" (OAuth flow) → sau khi connect hiển thị list 4 bản backup + "Backup ngay".
- **Xoá tài khoản**: `/settings/account` → confirm dialog yêu cầu nhập email + password → destructive action → redirect + toast.
- **Admin dashboards**: route `/admin/telemetry` và `/admin/errors` — chỉ hiển thị cho `ADMIN_USER_ID`, dùng Convex reactive queries (không cần polling thủ công).

## Cross-Story Dependencies

- Story 9.3 (backup cron) phụ thuộc vào logic ZIP của Story 9.2 — implement 9.2 trước.
- Story 9.5 và 9.6 (telemetry + error log) cần deploy schema trước khi instrument code; nên chạy schema migration đầu sprint.
- Story 9.3 cần Resend email (đã có từ Epic 1 auth flows) — tái dùng Resend client, không setup mới.
- Export ZIP cần `StorageProvider` interface (D10) hoàn chỉnh — verify R2 presigned URL read flow trước khi implement export.
- Story 9.4 (xoá tài khoản) gọi `storage.delete` cho mọi file — cần đảm bảo `storageId` được lưu đầy đủ trên bảng `documents` (đã có từ Epic 2).
