---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-04-25'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# Web Knowledge Base - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Web Knowledge Base, decomposing the requirements from the PRD and Architecture decisions into implementable stories.

## Requirements Inventory

### Functional Requirements

**Auth & Session (FR1–FR5)**
- FR1: Đăng ký tài khoản bằng email + mật khẩu hoặc Google OAuth.
- FR2: Đăng nhập từ nhiều thiết bị cùng tài khoản, session tự gia hạn.
- FR3: Đăng xuất một thiết bị mà không ảnh hưởng session khác.
- FR4: Bật MFA (TOTP) cho tài khoản — bắt buộc UI có sẵn từ MVP (Architecture D2 nâng từ optional → MVP).
- FR5: Yêu cầu reset password qua email (Resend).

**Content Library (FR6–FR11)**
- FR6: Upload tài liệu PDF/EPUB/DOCX/PPTX/JPG-PNG-WEBP/MP3-M4A-WAV/MP4-WEBM/Markdown/web URL.
- FR7: Upload nhiều tài liệu đồng thời (drag-drop hoặc nút).
- FR8: Xem danh sách tài liệu (tiêu đề, định dạng, dung lượng, ngày upload).
- FR9: Đổi tên, xoá vĩnh viễn, hoặc khôi phục (thùng rác 30 ngày).
- FR10: Gán tag tự do và folder; 1 tài liệu nhiều tag.
- FR11: Lọc danh sách theo tag/folder/định dạng/khoảng ngày.

**Multi-Format Viewers (FR12–FR20)**
- FR12: PDF viewer (zoom, page nav, text selection) — PDF.js.
- FR13: EPUB viewer (font size, theme, line height) — epubjs/react-reader.
- FR14: DOCX viewer (text + ảnh + bảng inline) — mammoth.
- FR15: PPTX viewer (slide nav, fullscreen) — react-pptx.
- FR16: Image viewer (zoom, pan, gallery) — react-image-gallery.
- FR17: Audio viewer (play/pause, seek, 0.5x–2x, waveform) — Wavesurfer.
- FR18: Video viewer (play/pause, seek, 0.5x–2x, fullscreen) — Plyr.
- FR19: Markdown render (heading, list, code, table, KaTeX, mermaid) + Reading Mode typography.
- FR20: Web clip view (Mozilla Readability sạch / HTML gốc).

**Reading Progress + Resume (FR21–FR24)**
- FR21: Tự động lưu vị trí đọc mỗi 5s + on close/blur.
- FR22: Lưu vị trí theo position_type (pdf_page+offset / epub_cfi / time_seconds / scroll_pct / slide_index).
- FR23: Mở lại tài liệu (cùng/khác thiết bị) → khôi phục đúng vị trí cuối.
- FR24: Xem lịch sử đọc gần đây (≥10 entries).

**Multi-Tab Workspace (FR25–FR28)**
- FR25: Mở đồng thời nhiều tài liệu dạng tab (max 10/user).
- FR26: Đóng tab, drag-drop sắp xếp, switch nhanh.
- FR27: Đồng bộ tab list + active tab + scroll state realtime cross-device.
- FR28: "Đóng tất cả tab" / "mở lại tab vừa đóng" trong cùng phiên.

**Highlight & Annotation (FR29–FR33)**
- FR29: Bôi đen text trong PDF/EPUB/DOCX/MD/web → menu nổi tạo highlight.
- FR30: Chọn màu highlight (≥4 màu), thêm note 1-click hoặc Ctrl/Cmd+N.
- FR31: Xem danh sách highlight của tài liệu, click jump tới vị trí.
- FR32: Xoá / chỉnh sửa highlight đã tạo.
- FR33: Timestamp marker (audio/video) hoặc page bookmark (PDF/EPUB) như highlight.

**Note Workspace (FR34–FR39)**
- FR34: Note Markdown free-form workspace (heading, list, code, table, KaTeX, mermaid, paste image inline, drag-drop attachment).
- FR35: Bidirectional link `@doc-title` / `@highlight-id` hai chiều.
- FR36: Sticky note inline neo vào highlight (không rời viewer).
- FR37: Auto-save note ≤1s sau ngừng gõ.
- FR38: Tag, sắp xếp, tìm note theo tag/ngày/tài liệu nguồn.
- FR39: Voice note ghi mic đính kèm highlight (transcribe Phase 2+).

**Full-text Search (FR40–FR43)**
- FR40: Search full-text trên title + nội dung doc + nội dung note.
- FR41: Kết quả grouping theo loại (doc/highlight/note) + highlight đoạn match.
- FR42: Lọc kết quả theo tag/định dạng/ngày/tài liệu nguồn.
- FR43: Click kết quả jump tới đúng vị trí.

**Offline & PWA (FR44–FR47)**
- FR44: Cài app vào màn hình chính iOS/iPadOS (Safari Add-to-Home) + install banner Android/Desktop.
- FR45: Đọc lại tài liệu đã mở trong 7 ngày gần nhất khi offline.
- FR46: Tạo highlight/note/đổi tag offline → queue → auto-sync khi online.
- FR47: Badge số thay đổi pending sync + panel "Sync Conflicts".

**Data Portability + Backup (FR48–FR51)**
- FR48: Export toàn bộ dữ liệu ra ZIP (Markdown + JSON + file gốc).
- FR49: Export 1 tài liệu đơn lẻ (file gốc + highlight + note Markdown).
- FR50: Auto backup weekly lên Google Drive của user, giữ ≥4 bản gần nhất.
- FR51: Yêu cầu xoá vĩnh viễn tài khoản + toàn bộ dữ liệu (bao gồm storage).

**Telemetry & Self-observability (FR52–FR54)**
- FR52: Ghi event telemetry (resume_position_loaded, tabs_synced, note_save, search_query, latency) vào DB của user, không third-party.
- FR53: Dashboard `/admin/telemetry` xem latency p50/p95, retention, days active, số tài liệu.
- FR54: Error log vào bảng `error_logs`, hiển thị `/admin/errors` để debug.

**Sharing schema-ready (FR55–FR59 — Phase 2+)**
- FR55: Mời người khác đọc/comment/edit tài liệu qua email.
- FR56: Role viewer/commenter/editor; UI gating đúng quyền.
- FR57: Tab "Shared with me".
- FR58: Comment trên highlight (role ≥ commenter), realtime sync.
- FR59: Thu hồi quyền share / xoá người khỏi tài liệu.

**Reading Mode (FR60–FR68)**
- FR60: Bật Reading Mode cho PDF/EPUB/DOCX/MD/web bằng `F` hoặc `Cmd+Shift+R` — fullscreen typography tối ưu.
- FR61: Theme Sáng / Sepia / Tối, nhớ riêng cho từng định dạng.
- FR62: Tuỳ chỉnh font (Serif/Sans/Mono), size 12–28px, line-height 1.4–2.0, độ rộng cột (narrow/medium/wide).
- FR63: EPUB continuous scroll / paginated; phím tắt ←/→ + vuốt mobile.
- FR65: Progress bar + ước lượng "Còn ~X phút đọc" theo tốc độ trung bình.
- FR67: Thoát Reading Mode bằng Esc / nút X.
- FR62b (Phase 2+): Font OpenDyslexic.
- FR64 (Phase 2+): Dual-page spread EPUB/PDF desktop ≥768px.
- FR66 (Phase 2+): Focus mode (paragraph hiện tại sáng, khác mờ).
- FR68 (Phase 2+): TTS đọc to (Web Speech API MVP / Whisper Phase 3+).

### NonFunctional Requirements

**Performance (NFR1–NFR8)**
- NFR1: Resume position ≤2s ở 95% trường hợp (mạng ≥5Mbps).
- NFR2: Tab sync ≤3s ở 95% trường hợp.
- NFR3: Tải tài liệu ≤2s với file ≤50MB; ≤5s với file ≤500MB.
- NFR4: Highlight → caret note input ≤1.5s.
- NFR5: Note auto-save ≤1s sau ngừng gõ.
- NFR6: Search ≤1s với ≤500 docs; ≤500ms với ≤5k notes.
- NFR7: Initial bundle <200KB gzipped, lazy-load viewer.
- NFR8: FCP ≤1.5s trên 4G mid-tier (Lighthouse mobile).

**Security (NFR9–NFR15)**
- NFR9: HTTPS/TLS 1.3+ toàn bộ, không endpoint HTTP.
- NFR10: Tài liệu mặc định private, AES-256 at rest.
- NFR11: File access qua presigned URL expire ≤15 phút, không public URL cố định.
- NFR12: Auth dùng provider managed (Better Auth via Convex), không tự code auth.
- NFR13: Telemetry/logs không third-party, không log content tài liệu.
- NFR14: CSP strict — chỉ self + Convex + R2 + Resend.
- NFR15: Phase 2+: rate limit 100 req/phút/user cho mutations.

**Reliability (NFR16–NFR21)**
- NFR16: Sync events ≥99%, queue local cho offline mutation.
- NFR17: LWW field-level cho diff <20 ký tự; >20 ký tự → `sync_conflicts` panel.
- NFR18: Auto backup weekly Google Drive, giữ ≥4 snapshot.
- NFR19: Export `/export/all` ≤2 phút với ≤1k docs, ≤5GB total.
- NFR20: SW offline cache 100% tài liệu mở trong 7 ngày, max 500MB LRU.
- NFR21: Session 30 ngày thiết bị tin cậy, force re-auth sau 90 ngày inactive.

**Accessibility (NFR22–NFR26)**
- NFR22: WCAG 2.1 AA trên các trang chính.
- NFR23: Contrast ≥4.5:1 trên cả 3 theme.
- NFR24: Keyboard navigation đầy đủ + focus indicator rõ.
- NFR25: ARIA label cho mọi viewer control.
- NFR26: Phase 2+: OpenDyslexic + reduced-motion tôn trọng `prefers-reduced-motion`.

**Cost & Sustainability (NFR27–NFR29)**
- NFR27: Tổng chi phí $0/tháng trong suốt MVP + Phase 2 (≤5 user).
- NFR28: Free-tier vĩnh viễn, không paid trial auto-charge.
- NFR29: Mỗi dịch vụ có backup plan free-tier khác (R2→B2; Convex→Supabase/Pocketbase; CF Pages→Netlify).

**Compatibility (NFR30–NFR32)**
- NFR30: Chrome ≥110, Edge ≥110, Safari ≥16.4, Firefox ≥110 desktop.
- NFR31: Responsive 375px → 1920+px; tap target ≥44×44px mobile.
- NFR32: Data portability ZIP mở được trong Obsidian không mất highlight/note.

**Maintainability (NFR33–NFR37)**
- NFR33: TypeScript strict, no `any` không justified.
- NFR34: Test coverage ≥60% business critical (sync/position/export/auth) + E2E 3 path.
- NFR35: Deploy ≤5 phút từ git push tới prod CF Pages.
- NFR36: Rollback ≤10 phút (git revert + redeploy).
- NFR37: UI tiếng Việt mọi label/button/error; comment EN cho code, VI cho business logic phức tạp.

### Additional Requirements

**Từ Architecture (D1–D10 + Schema Supplements):**

- **Starter template**: Init bằng `npm create convex@latest web-knowledge-base -- -t get-convex/template-nextjs-convexauth-shadcn` rồi swap Convex Auth → Better Auth (Story 1.1).
- **D1 — OpenNext Cloudflare adapter**: dùng `@opennextjs/cloudflare` thay `next-on-pages` deprecated; compatibility flag `nodejs_compat_v2`; verify Better Auth callback route trên CF Pages.
- **D2 — Better Auth integration**: `@convex-dev/better-auth` với email/password + Google + GitHub OAuth + Magic Link + TOTP MFA + 2FA OTP từ MVP; tích hợp Resend free 3k/tháng (kéo từ Phase 2+ lên MVP cho password reset + magic link + 2FA backup).
- **D3 — Convex search index built-in cho MVP**; Meilisearch fallback khi vượt 1024 result limit (Phase 2+).
- **D4 — Custom Workbox + Dexie.js cho PWA + offline cache** (CacheFirst static / NetworkFirst Convex API / StaleWhileRevalidate file 500MB LRU).
- **D5 — LWW field-level + diff threshold 20 chars**; bảng mới `sync_conflicts(userId, entityType, entityId, fieldName, versionA, versionB, ...)` + UI `/sync-conflicts` side-by-side diff.
- **D6 — Hybrid offline queue**: Workbox Background Sync (Chrome/Edge/Android) + polling on visibilitychange (iOS Safari); idempotency via `clientMutationId` UUID v7; exponential backoff 1→60s, max 10 attempts.
- **D7 — GitHub Actions CI/CD free tier**: PR (lint + typecheck + vitest + playwright + bundle size) / merge main (CF Pages prod + Convex prod) / branch (CF Pages preview + Convex preview).
- **D8 — Rate Limiter Convex component (Phase 2+)**, 100 req/phút/user.
- **D9 — Convex reactive query duy nhất cho realtime** (tab sync, notes, comments, conflict log) — không thêm WebSocket service.
- **D10 — Storage abstraction layer**: ConvexStorageProvider (≤5MB) + R2StorageProvider (>5MB presigned ≤15 phút) + B2StorageProvider (backup); interface `StorageProvider` trong `apps/web/src/lib/storage/index.ts`.
- **Schema bổ sung (3 bảng mới)**: `mutation_log` (idempotency dedupe TTL 7 ngày), `sync_conflicts` (D5), `upload_sessions` (R2 multipart resumable, TTL 24h).
- **Schema extension users**: `twoFactorEnabled`, `twoFactorSecret` (encrypted), `backupCodes` (hashed), `preferences.readingMode`.
- **Schema extension highlights**: `voiceNoteStorageId: Id<"_storage">` cho FR39.
- **Position abstraction**: 5 position_type unified discriminated union, lib `apps/web/src/lib/position/{pdf,epub-cfi,time,scroll,slide}.ts`; DB lưu `JSON.stringify(position)` trong `positionValue: string`.
- **Bundle discipline**: dynamic import per viewer (`{ ssr: false }`), mermaid + KaTeX + mammoth lazy theo nhu cầu, bundle analyzer trong CI fail nếu initial >200KB gz.
- **State boundary 3 lớp**: Zustand (UI ephemeral) / Convex hooks (data reactive) / Dexie (offline cache + outbox); KHÔNG copy Convex data sang Zustand.
- **Multipart resumable upload**: chunk 100MB qua R2 multipart API + `upload_sessions` table; resume khi tab đóng giữa chừng.
- **CI bundle size gate**: fail nếu initial route bundle >200KB gz.
- **Telemetry instrumentation**: `withTelemetry()` helper + `events.snake_case.dot.notation` (resume_position.loaded, tabs.synced, note.saved, search.executed, outbox.flushed) với `latencyMs`, `deviceId`, `meta`.
- **i18n VI**: lookup `lib/i18n/labels.ts`; `date-fns/locale/vi`.
- **CSP header**: `default-src 'self'; connect-src 'self' *.convex.cloud *.r2.cloudflarestorage.com *.resend.com; ...`.
- **Backup cron**: Convex scheduled job Sunday 03:00 ICT, Google Drive OAuth của user, ZIP snapshot, auto-prune giữ 4 bản.
- **Schema-ready multi-user**: mọi bảng có `userId` index `by_user`; `document_shares` có sẵn dù chưa dùng MVP.
- **Accessibility enforcement (Rule #11)**: `@axe-core/playwright` violations = 0 mỗi test; keyboard shortcut khai báo `lib/keyboard/shortcuts.ts`; tap target ≥44×44px mobile.

### UX Design Requirements

_Không có tài liệu UX riêng. UX được nhúng trong PRD (User Journeys + Reading Mode FR60–FR68 + Note ergonomic targets) và đã được phản ánh trong FR list ở trên._

### FR Coverage Map

| FR | Epic | Mô tả ngắn |
|---|---|---|
| FR1–FR5 | Epic 1 | Auth: register/login/logout/MFA/reset password |
| FR6–FR11 | Epic 2 | Upload, library list, tag/folder, filter, trash |
| FR12–FR20 | Epic 3 | 8 viewers + Markdown + Web clip |
| FR21–FR24 | Epic 3 | Reading progress + resume + history |
| FR25–FR28 | Epic 4 | Multi-tab workspace + cross-device sync |
| FR29–FR33 | Epic 5 | Highlight + colors + bookmark/timestamp marker |
| FR34–FR39 | Epic 5 | Note workspace + bidirectional link + sticky + voice + auto-save |
| FR40–FR43 | Epic 6 | Full-text search + grouping + filter + jump |
| FR44–FR47 | Epic 8 | PWA install + offline cache + offline mutation queue + conflict UI |
| FR48–FR49 | Epic 9 | Export ZIP toàn bộ + đơn lẻ |
| FR50 | Epic 9 | Weekly backup Google Drive |
| FR51 | Epic 9 | Xoá tài khoản + toàn bộ dữ liệu |
| FR52–FR54 | Epic 9 | Telemetry + error log dashboard |
| FR55–FR59 | Epic 10 (P2+) | Sharing & collaboration |
| FR60, FR61, FR62, FR63, FR65, FR67 | Epic 7 | Reading Mode core |
| FR62b, FR64, FR66, FR68 | Epic 11 (P2+) | Reading Mode advanced |

## Epic List

### Epic 1: Foundation, Auth & Account Security
User có thể đăng ký, đăng nhập từ nhiều thiết bị, đăng xuất từng thiết bị, bật MFA TOTP, và reset password qua email. Đồng thời thiết lập nền tảng dự án (Convex starter + Better Auth + OpenNext Cloudflare adapter + CI/CD GitHub Actions + AGENTS.md guideline) làm bệ phóng cho mọi epic sau.
**FRs covered:** FR1, FR2, FR3, FR4, FR5
**NFRs khoá:** NFR9, NFR12, NFR14, NFR21, NFR27, NFR28, NFR29, NFR33, NFR35, NFR36, NFR37

### Epic 2: Content Library & Multi-Format Upload
User có thể upload tài liệu thuộc 8 định dạng (PDF/EPUB/DOCX/PPTX/Image/Audio/Video/Markdown) hoặc lưu URL web clip qua drag-drop hoặc multipart resumable upload (file >100MB không sợ rớt mạng); xem danh sách, lọc theo tag/folder/định dạng/ngày, đổi tên, xoá vào thùng rác 30 ngày, khôi phục.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11
**NFRs khoá:** NFR3, NFR10, NFR11

### Epic 3: Multi-Format Reading & Resume Anywhere
User có thể mở 8 loại viewer với UX phù hợp từng định dạng, đọc tài liệu, và quay lại đúng vị trí cuối cùng (trang+offset/CFI/timestamp/scroll %/slide index) khi mở lại trên cùng hoặc khác thiết bị trong ≤2 giây; xem lịch sử đọc gần đây.
**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24
**NFRs khoá:** NFR1, NFR7, NFR8

### Epic 4: Multi-Tab Workspace Cross-Device
User có thể mở đồng thời ≤10 tài liệu dạng tab giống trình duyệt, drag-drop sắp xếp, đóng/mở lại tab vừa đóng; tab list + active tab + scroll state đồng bộ realtime giữa laptop/iPad/iPhone trong ≤3 giây.
**FRs covered:** FR25, FR26, FR27, FR28
**NFRs khoá:** NFR2

### Epic 5: Highlight, Note & Knowledge Linking
User có thể bôi đen text → highlight 4 màu với menu nổi 1-click; thêm note ngắn bằng Ctrl/Cmd+N; xem sticky note inline neo vào highlight; viết note Markdown free-form trong workspace riêng (KaTeX/mermaid/code/table/paste image/drag-drop attachment); tạo bidirectional link `@doc` `@highlight`; ghi voice note đính kèm; auto-save 1s; tag/sắp xếp/tìm note; thêm timestamp marker (audio/video) hoặc page bookmark.
**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39
**NFRs khoá:** NFR4, NFR5

### Epic 6: Full-Text Search Across Docs + Notes
User có thể search 1 từ khoá ra đồng thời content tài liệu (PDF/EPUB/DOCX/MD/web), highlight, và note; kết quả grouping theo loại + highlight đoạn match; lọc theo tag/định dạng/ngày/tài liệu nguồn; click jump tới đúng vị trí xuất hiện.
**FRs covered:** FR40, FR41, FR42, FR43
**NFRs khoá:** NFR6

### Epic 7: Reading Mode (Focused Reading UX)
User có thể bật Reading Mode bằng phím `F` / `Cmd+Shift+R` cho PDF/EPUB/DOCX/MD/web — fullscreen typography tối ưu; chọn theme Sáng/Sepia/Tối nhớ riêng từng định dạng; tuỳ chỉnh font/size/line-height/độ rộng cột; EPUB continuous scroll hoặc paginated với phím ←/→ và vuốt mobile; progress bar + ước lượng "Còn ~X phút đọc"; Esc thoát.
**FRs covered:** FR60, FR61, FR62, FR63, FR65, FR67
**NFRs khoá:** NFR22, NFR23, NFR24, NFR25, NFR31

### Epic 8: Offline & PWA Reliability
User có thể cài app vào màn hình chính qua Safari Add-to-Home / install banner; đọc 100% tài liệu đã mở trong 7 ngày gần nhất khi offline; tạo highlight/note/đổi tag offline → queue local → auto-sync khi online (Workbox BG Sync + iOS polling fallback); thấy badge số thay đổi pending; review side-by-side conflict diff trong panel "Sync Conflicts" và chọn version đúng.
**FRs covered:** FR44, FR45, FR46, FR47
**NFRs khoá:** NFR16, NFR17, NFR20, NFR30

### Epic 9: Data Portability, Backup & Self-Observability
User có thể export toàn bộ dữ liệu hoặc 1 tài liệu đơn lẻ ra ZIP (Markdown + JSON + file gốc, mở được trong Obsidian); hệ thống tự backup weekly lên Google Drive của user (giữ ≥4 bản); user có thể xoá vĩnh viễn tài khoản; xem telemetry dashboard cá nhân (latency p50/p95, retention, days active) và error log để tự debug.
**FRs covered:** FR48, FR49, FR50, FR51, FR52, FR53, FR54
**NFRs khoá:** NFR13, NFR18, NFR19, NFR32, NFR34

### Epic 10: Sharing & Collaboration (Phase 2+)
User có thể mời người khác đọc/comment/edit 1 tài liệu cụ thể qua email với role viewer/commenter/editor/owner; người được mời thấy tab "Shared with me"; comment trên highlight sync realtime; owner thu hồi quyền hoặc xoá người khỏi tài liệu. Schema `document_shares` đã có sẵn từ MVP nên không cần migration đau.
**FRs covered:** FR55, FR56, FR57, FR58, FR59
**NFRs khoá:** NFR15

### Epic 11: Reading Mode Advanced (Phase 2+)
User có thể chọn font OpenDyslexic; bật dual-page spread cho EPUB/PDF trên màn hình ≥768px; bật Focus mode (chỉ paragraph hiện tại sáng rõ, các paragraph khác mờ); bật TTS đọc to (Web Speech API ở Phase 2+, Whisper TTS Phase 3+).
**FRs covered:** FR62b, FR64, FR66, FR68
**NFRs khoá:** NFR26

---

## Epic 1: Foundation, Auth & Account Security

User có thể đăng ký, đăng nhập từ nhiều thiết bị, đăng xuất từng thiết bị, bật MFA TOTP, reset password qua email; đồng thời thiết lập nền tảng dự án (Convex starter + Better Auth + OpenNext CF Pages + CI/CD + AGENTS.md) làm bệ phóng cho mọi epic sau.

### Story 1.1: Khởi tạo dự án từ Convex starter + swap Better Auth + deploy CF Pages preview

As a single coder dùng Claude Code,
I want một codebase chạy được với Convex starter + Better Auth + OpenNext Cloudflare adapter + Tailwind/shadcn + monorepo gọn,
So that tôi có nền tảng sẵn sàng cho mọi feature sau và verify được toàn bộ stack $0/tháng deploy thật trên Cloudflare Pages preview.

**Acceptance Criteria:**

**Given** repo trống
**When** chạy `npm create convex@latest web-knowledge-base -- -t get-convex/template-nextjs-convexauth-shadcn`
**Then** monorepo được tạo với `apps/web/` (Next.js 15 App Router + TS strict + Tailwind v3 + shadcn/ui) và `convex/` (schema.ts + functions/) đúng theo Architecture
**And** `pnpm web dev` + `pnpm convex dev` chạy song song không lỗi

**Given** template ban đầu dùng Convex Auth
**When** swap sang Better Auth theo D2
**Then** đã cài `@convex-dev/better-auth` + `better-auth`, `convex/auth.config.ts` cấu hình Better Auth, route `/api/auth/[...all]` hoạt động, provider Email/Password + Google + GitHub + Magic Link bật được
**And** Convex Auth cũ đã gỡ hoàn toàn

**Given** project cần deploy CF Pages
**When** thêm `@opennextjs/cloudflare` + `open-next.config.ts` + `wrangler.toml` với `compatibility_flags = ["nodejs_compat_v2"]`
**Then** `pnpm build` tạo output OpenNext + `npx wrangler pages deploy` thành công, URL preview load landing page
**And** Better Auth callback Google OAuth thành công round-trip trên domain preview

**Given** developer cần guideline
**When** tạo `AGENTS.md` ở root
**Then** ghi đầy đủ Naming patterns (camelCase field, `by_<fields>` index, `clientMutationId` UUID v7), State boundary 3 lớp, Auth gating (`requireAuth(ctx)`), Error pattern (`ConvexError` typed)
**And** `README.md` có quick-start + link `architecture.md`

**Given** TS strict + lint
**When** mở `tsconfig.base.json` và `eslint.config.js`
**Then** `strict: true`, `@typescript-eslint/no-explicit-any: error` bật, `pnpm typecheck` pass

**Given** secrets
**When** tạo `.env.example`
**Then** liệt kê đủ tên biến (CONVEX_DEPLOY_KEY, BETTER_AUTH_SECRET, GOOGLE/GITHUB OAuth, RESEND_API_KEY, R2/B2/Google Drive) không chứa giá trị thật
**And** `.gitignore` ignore `.env`, `convex/_generated/`, `.next/`, `.open-next/`

### Story 1.2: Đăng ký tài khoản (email+password / Google / GitHub / Magic Link)

As a người dùng mới,
I want đăng ký tài khoản bằng email+password, Google, GitHub, hoặc Magic Link,
So that tôi vào được app trong < 1 phút (FR1).

**Acceptance Criteria:**

**Given** user vào `/signup` chưa đăng nhập
**When** nhập email + password hợp lệ → submit
**Then** Better Auth tạo account, gửi email verify qua Resend (template VI), redirect `/verify-email`
**And** record `users` insert Convex với `userId`, `email`, `twoFactorEnabled: false`

**Given** user click "Đăng ký bằng Google" / "GitHub"
**When** OAuth round-trip hoàn tất
**Then** account tự tạo (skip verify email), redirect `/library` đã đăng nhập

**Given** user chọn Magic Link
**When** nhập email → click link inbox
**Then** đăng ký + đăng nhập 1 bước, redirect `/library`

**Given** form validation VI
**When** email sai format hoặc password < 8 ký tự
**Then** error VI từ `lib/i18n/labels.ts` qua `react-hook-form` + `zod`

**Given** CSP strict (NFR14)
**When** check response headers `/signup`
**Then** CSP đúng theo Architecture

### Story 1.3: Đăng nhập từ nhiều thiết bị + session 30 ngày

As a user đã có tài khoản,
I want đăng nhập trên laptop/iPad/iPhone với session tự gia hạn,
So that không phải đăng nhập lại mỗi sáng (FR2 + NFR21).

**Acceptance Criteria:**

**Given** user verify email xong
**When** vào `/login` nhập email+password đúng
**Then** Better Auth tạo session 30 ngày, cookie `httpOnly` + `Secure` + `SameSite=Lax`, redirect `/library`

**Given** user đã login laptop
**When** mở app iPad/iPhone login cùng tài khoản
**Then** cả 3 session độc lập với `deviceId` riêng, không invalidate lẫn nhau

**Given** session đang dùng
**When** activity gần nhất < 30 ngày
**Then** sliding expiration tự gia hạn

**Given** user inactive ≥ 90 ngày
**When** mở app
**Then** redirect `/login` re-auth (NFR21)

**Given** đăng nhập sai 5 lần
**When** thử lần 6
**Then** rate-limit, error VI "Quá nhiều lần thử, thử lại sau 5 phút"

### Story 1.4: Đăng xuất per-device

As a user dùng nhiều thiết bị,
I want đăng xuất 1 thiết bị mà không mất session ở thiết bị khác,
So that logout máy mượn không ảnh hưởng laptop chính (FR3).

**Acceptance Criteria:**

**Given** user login 3 thiết bị
**When** bấm "Đăng xuất" iPad
**Then** chỉ session iPad bị xoá; laptop + iPhone vẫn login

**Given** trang `/settings/account` mục "Phiên đang hoạt động"
**When** load
**Then** liệt kê tất cả session với `deviceId`, `lastActiveAt`, location ước lượng IP + nút "Đăng xuất"
**And** click "Đăng xuất tất cả thiết bị khác" giữ lại session hiện tại

**Given** user đăng xuất
**When** vào `/library`
**Then** redirect `/login`

### Story 1.5: Bật MFA TOTP + backup codes

As a user quan tâm bảo mật,
I want bật 2FA TOTP qua Google Authenticator/Authy với 10 backup codes,
So that tài khoản an toàn từ MVP (FR4 + D2).

**Acceptance Criteria:**

**Given** user vào `/settings/account` mục "Bảo mật 2 lớp"
**When** bấm "Bật 2FA"
**Then** hiện QR code (TOTP secret) + 10 backup codes; user scan + nhập 6-digit OTP confirm
**And** confirm đúng → `twoFactorEnabled = true`, `twoFactorSecret` encrypted at rest, `backupCodes` hashed

**Given** user bật 2FA + login lần sau
**When** nhập email+password đúng
**Then** redirect `/2fa-verify` yêu cầu 6-digit OTP hoặc backup code
**And** session chỉ valid sau `session.twoFactorVerified = true`

**Given** user mất Authenticator
**When** chọn "Dùng backup code"
**Then** nhập 1 trong 10 backup code → login + mark used (no reuse)

**Given** user vào settings đã bật 2FA
**When** bấm "Tắt 2FA" + xác nhận password
**Then** clear `twoFactorSecret`, `backupCodes`, `twoFactorEnabled = false`

### Story 1.6: Reset password qua email (Resend)

As a user quên mật khẩu,
I want nhận email link reset password và đặt mật khẩu mới,
So that không bị khoá tài khoản (FR5).

**Acceptance Criteria:**

**Given** user vào `/forgot-password`
**When** nhập email + submit
**Then** nếu email tồn tại → gửi email reset qua Resend (template VI) link expire 60 phút; nếu không → vẫn hiện thông báo chung (chống email enumeration)

**Given** user click link
**When** vào `/reset-password?token=...`
**Then** form nhập password mới + confirm; submit thành công → update password + invalidate tất cả session cũ + redirect `/login` toast "Đặt lại mật khẩu thành công"

**Given** link expire / đã dùng
**When** click lại
**Then** error VI "Link reset đã hết hạn hoặc đã dùng"

### Story 1.7: GitHub Actions CI/CD pipeline

As a single coder,
I want PR tự lint+typecheck+test+bundle-size check, merge main tự deploy prod, branch tự deploy preview,
So that mỗi commit có quality gate, rollback ≤ 10 phút (D7 + NFR34, 35, 36).

**Acceptance Criteria:**

**Given** repo có 3 workflow `.github/workflows/{ci,deploy-preview,deploy-prod}.yml`
**When** push PR
**Then** `ci.yml` chạy ESLint + `pnpm typecheck` + Vitest unit + Playwright smoke + bundle-size (fail nếu initial >200KB gz)
**And** PR block merge nếu bất kỳ job fail

**Given** push branch ≠ main
**When** CI pass
**Then** `deploy-preview.yml` deploy CF Pages preview + `convex deploy --preview-name <branch>`

**Given** merge PR vào main
**When** CI pass
**Then** `deploy-prod.yml` deploy CF Pages prod + `convex deploy --prod`
**And** thời gian git push → prod URL < 5 phút (NFR35)

**Given** Vitest + Playwright config
**When** mở `apps/web/{vitest,playwright}.config.ts`
**Then** Vitest có `@vitest/coverage-v8` threshold 0% ban đầu, Playwright spec smoke login pass local

**Given** secrets deploy
**When** xem GitHub Secrets
**Then** README document `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CONVEX_DEPLOY_KEY`

---

## Epic 2: Content Library & Multi-Format Upload

User có thể upload tài liệu 8 định dạng hoặc URL web clip qua drag-drop hoặc multipart resumable upload; xem danh sách, lọc theo tag/folder/định dạng/ngày, đổi tên, xoá vào thùng rác, khôi phục.

### Story 2.1: Storage abstraction layer (D10) — Convex + R2 + B2

As a developer,
I want lớp `StorageProvider` route file ≤5MB → Convex, >5MB → R2, backup B2,
So that swap backend ≤ 1 tuần khi free-tier đổi (D10 + NFR29).

**Acceptance Criteria:**

**Given** `apps/web/src/lib/storage/index.ts`
**When** mở
**Then** export interface `StorageProvider` với `upload`, `getDownloadUrl`, `delete`, `getMultipartUploadId`, `uploadPart`, `completeMultipart`
**And** 3 file `ConvexStorage.ts`, `R2Storage.ts`, `B2Storage.ts` implement đúng interface

**Given** router logic
**When** `storage.upload(file)` với file ≤ 5MB
**Then** dùng `ConvexStorage`, trả `{storageBackend: "convex", storageKey: Id<"_storage">}`

**Given** file > 5MB
**When** `storage.upload(file)`
**Then** dùng `R2Storage` qua presigned multipart URL

**Given** R2 fail
**When** retry với fallback flag
**Then** chuyển `B2Storage` không đổi call site

**Given** presigned URL
**When** generate
**Then** mọi URL ≤ 15 phút (NFR11)

**Given** unit test
**When** `pnpm test lib/storage`
**Then** mock 3 provider pass, coverage ≥ 80%

### Story 2.2: Upload đơn lẻ ≤5MB (Convex storage path) cho 8 định dạng

As a user,
I want kéo-thả 1 file ≤ 5MB và thấy nó trong library,
So that bắt đầu xây library nhanh (FR6, FR7).

**Acceptance Criteria:**

**Given** user vào `/library/upload`
**When** drop 1 file ≤ 5MB hợp lệ
**Then** upload qua Convex action `documents.actions.requestUpload(size, format)` → ConvexStorage → `documents.mutations.finalize(uploadSessionId)` → insert `documents` row với `userId`, `title`, `format`, `sizeBytes`, `storageBackend: "convex"`, `storageKey`, `createdAt`

**Given** format không hỗ trợ (.exe)
**When** drop
**Then** reject client-side toast VI "Định dạng không hỗ trợ"

**Given** upload thành công
**When** library reload (reactive)
**Then** doc mới xuất hiện đầu list (sort `createdAt desc`)

**Given** telemetry
**When** upload xong
**Then** `logTelemetry("upload.completed", {latencyMs, sizeBytes, format})`

### Story 2.3: Multipart resumable upload >5MB qua R2

As a user,
I want upload file lớn (audio 200MB, video 1.2GB) chia chunk 100MB resumable,
So that mất mạng/đóng tab không phải upload lại (NFR3 + upload_sessions).

**Acceptance Criteria:**

**Given** drop file > 5MB
**When** upload bắt đầu
**Then** Convex action tạo R2 multipart, insert `upload_sessions` với `uploadId`, `storageBackend: "r2"`, `storageKey`, `totalSize`, `chunkSizeBytes: 100MB`, `partsCompleted: []`, `expiresAt: now + 24h`

**Given** upload đang chạy
**When** mỗi chunk hoàn tất
**Then** push `{partNumber, etag}` vào `partsCompleted`; UI progress realtime (Convex reactive)

**Given** đóng tab giữa chừng
**When** mở lại `/library/upload` chọn cùng file
**Then** detect `upload_sessions` match → tiếp tục chunk chưa upload

**Given** tất cả part complete
**When** finalize
**Then** R2 `completeMultipart`, insert `documents`, xoá `upload_sessions`
**And** telemetry `upload.completed`

**Given** session expire 24h
**When** cron prune
**Then** `upload_sessions` row + R2 multipart aborted

### Story 2.4: Lưu URL web clip

As a user,
I want paste URL web → lưu thành document đọc được,
So that read-it-later (FR6, FR20).

**Acceptance Criteria:**

**Given** user paste URL vào input "Lưu web clip"
**When** submit
**Then** Convex action fetch HTML server-side, chạy Mozilla Readability extract title + content + main image, lưu HTML cleaned + raw vào storage Convex, insert `documents` với `format: "webclip"`, `sourceUrl`

**Given** URL không reach / Readability fail
**When** submit
**Then** error VI "Không tải được URL này"

**Given** clip thành công
**When** mở từ library
**Then** Epic 3 viewer render (verify document tồn tại)

### Story 2.5: Library list reactive

As a user,
I want xem danh sách doc với title/format icon/size/ngày, sort newest first,
So that thấy ngay những gì đã upload (FR8).

**Acceptance Criteria:**

**Given** `/library`
**When** load (`useQuery(api.documents.queries.listByUser)`)
**Then** render `<DocumentGrid>` mỗi card hiển thị format icon, title, size formatted, `createdAt` format VI
**And** loading skeleton khi `useQuery === undefined`

**Given** library trống
**When** load
**Then** empty state VI + CTA upload

**Given** ≥ 1 doc
**When** upload doc mới ở tab khác
**Then** list cập nhật realtime không refresh

### Story 2.6: Tag + Folder gán cho document

As a user,
I want gán nhiều tag và 1 folder cho mỗi doc,
So that tổ chức library (FR10).

**Acceptance Criteria:**

**Given** schema `tags(userId, name)`, `documents.tagIds: Id<"tags">[]`, `documents.folderId: Id<"folders"> | null`
**When** mở `/library`
**Then** schema deploy không lỗi

**Given** card document
**When** bấm icon "Gán tag"
**Then** popover multi-select; gõ tag mới → enter tạo + add; click tag có sẵn → toggle

**Given** doc có tag
**When** xem card
**Then** badge tag với màu auto-assign

**Given** sidebar "Folders"
**When** tạo folder + drag doc vào
**Then** `folderId` update, doc hiện trong folder

### Story 2.7: Filter library theo tag/folder/định dạng/khoảng ngày

As a user,
I want lọc list theo tag/folder/format/date,
So that tìm doc nhanh (FR11).

**Acceptance Criteria:**

**Given** filter bar
**When** chọn 1+ tag, 1 folder, 1+ format, date range
**Then** list cập nhật ngay; URL query string bookmark

**Given** xoá tất cả filter
**When** bấm "Xoá bộ lọc"
**Then** list về full

**Given** 0 kết quả
**When** apply
**Then** empty state VI "Không tài liệu nào khớp bộ lọc"

### Story 2.8: Đổi tên document

As a user,
I want đổi tên 1 doc inline,
So that title rõ hơn (FR9).

**Acceptance Criteria:**

**Given** card document
**When** double-click title hoặc icon "Đổi tên"
**Then** title thành input; Enter save → mutation `rename`; Esc cancel

**Given** newTitle empty hoặc > 200 chars
**When** save
**Then** validation VI

### Story 2.9: Xoá vào thùng rác 30 ngày + khôi phục

As a user,
I want xoá vào thùng rác và khôi phục trong 30 ngày,
So that không sợ xoá nhầm (FR9).

**Acceptance Criteria:**

**Given** schema `documents.deletedAt: number | null`
**When** bấm "Xoá" + confirm
**Then** mutation set `deletedAt = now`; doc biến mất khỏi list mặc định

**Given** sidebar "Thùng rác"
**When** click
**Then** liệt kê doc có `deletedAt != null` sort desc

**Given** card trong thùng rác
**When** "Khôi phục"
**Then** `deletedAt = null`, doc về library
**And** "Xoá vĩnh viễn" + confirm → xoá row + `storage.delete`

**Given** cron weekly
**When** chạy
**Then** auto xoá doc có `deletedAt < now - 30d`

---

## Epic 3: Multi-Format Reading & Resume Anywhere

User có thể mở 8 viewer, đọc tài liệu, và quay lại đúng vị trí cuối cùng khi mở lại trên cùng/khác thiết bị trong ≤2 giây.

### Story 3.1: Position abstraction lib (5 position_type)

As a developer,
I want lib `lib/position/` với 5 position_type discriminated union + serializer,
So that mọi viewer + sync layer dùng chung 1 abstraction (innovation 1).

**Acceptance Criteria:**

**Given** `apps/web/src/lib/position/{index,pdf,epub-cfi,time,scroll,slide}.ts`
**When** import
**Then** export type `ReadingPosition` discriminated union 5 nhánh
**And** export `serialize` (JSON.stringify) + `deserialize(s, type)` validate, throw `ConvexError` nếu invalid

**Given** mỗi nhánh helper riêng
**When** mở
**Then** export utility tính progress % (`pdfProgressPct`, `epubProgressPct`, `timeProgressPct`, ...)

**Given** unit test
**When** `pnpm test lib/position`
**Then** round-trip 5 type pass; coverage ≥ 80%

### Story 3.2: Schema reading_progress + Convex CRUD + viewer dispatcher skeleton

As a user,
I want hệ thống lưu vị trí đọc cuối cùng + viewer dispatcher theo format,
So that nền tảng cho resume + 8 viewer (FR21, FR22).

**Acceptance Criteria:**

**Given** schema `reading_progress(userId, docId, positionType, positionValue, updatedAt)` index `by_user_doc`
**When** deploy
**Then** apply

**Given** `convex/reading_progress/{queries,mutations}.ts`
**When** mở
**Then** export `getByDoc(docId)` reactive + `upsert({docId, positionType, positionValue, clientMutationId})` idempotent

**Given** `components/viewers/ViewerDispatcher.tsx`
**When** render với `doc`
**Then** route theo `doc.format` → đúng viewer (lazy `dynamic({ssr: false})`); chưa có → placeholder

**Given** route `/(authenticated)/reader/[docId]/page.tsx`
**When** mở doc
**Then** `useQuery(getById)` + `useQuery(reading_progress.getByDoc)` + render dispatcher

### Story 3.3: PDF Viewer (PDF.js) + auto-save position

As a user,
I want mở PDF với zoom/page nav/text selection và auto lưu trang+offset,
So that resume PDF chính xác (FR12 + FR21).

**Acceptance Criteria:**

**Given** `components/viewers/PDFViewer.tsx` lazy
**When** render với storage download URL
**Then** PDF.js render canvas, toolbar zoom 50–200%, page input nav, text selection bật

**Given** user scroll/đổi trang
**When** position đổi
**Then** throttle 5s + on `visibilitychange/beforeunload` → `useReadingProgress.upsert({pdf_page, page, offset})` qua `mutateWithOutbox`

**Given** open doc có saved progress
**When** mount
**Then** restore tới `page` + `offset` ≤ 2s sau PDF.js init (NFR1)
**And** telemetry `resume_position.loaded`

### Story 3.4: EPUB Viewer (epubjs) + CFI position

As a user,
I want đọc EPUB với font/theme/line-height chỉnh được, lưu CFI,
So that resume EPUB chính xác (FR13 + FR22 epub_cfi).

**Acceptance Criteria:**

**Given** `components/viewers/EPUBViewer.tsx` lazy
**When** render
**Then** epubjs/react-reader hiển thị, toolbar font size, theme light/dark, line height

**Given** lật trang/scroll
**When** CFI đổi
**Then** throttle 5s upsert `{epub_cfi, cfi}`

**Given** mở doc có CFI saved
**When** mount
**Then** epubjs `display(cfi)` ≤ 2s

### Story 3.5: DOCX Viewer (mammoth)

As a user,
I want mở DOCX đọc text + ảnh + bảng inline,
So that không cần Word (FR14).

**Acceptance Criteria:**

**Given** `components/viewers/DOCXViewer.tsx` lazy (mammoth lazy)
**When** render
**Then** mammoth convert DOCX → HTML, render trong div scrollable + CSS typography

**Given** scroll
**When** đổi
**Then** upsert `{scroll_pct, pct, charOffset?}`

**Given** restore
**When** mount
**Then** scroll tới `pct` ≤ 2s

### Story 3.6: PPTX Viewer (react-pptx)

As a user,
I want xem PPTX slide với prev/next, fullscreen, slide index,
So that review slide khoá học (FR15 + FR22 slide_index).

**Acceptance Criteria:**

**Given** `PPTXViewer.tsx` lazy
**When** render
**Then** react-pptx render slide, toolbar trước/sau, input "Slide X/Y", fullscreen

**Given** đổi slide
**When**
**Then** upsert `{slide_index, slide}`

**Given** restore
**When** mount
**Then** jump tới `slide` ngay

### Story 3.7: Image Viewer (react-image-gallery)

As a user,
I want xem ảnh đơn với zoom + pan,
So that review screenshot/photo (FR16).

**Acceptance Criteria:**

**Given** `ImageViewer.tsx` lazy
**When** render với 1 ảnh
**Then** zoom (scroll) + pan (drag)
**And** position lưu `{scroll_pct, pct: 0}` (placeholder)

### Story 3.8: Audio Viewer (Wavesurfer) + timestamp

As a user,
I want nghe audio với play/pause/seek/0.5–2x/waveform, lưu timestamp,
So that resume audio chính xác (FR17 + FR22 time_seconds).

**Acceptance Criteria:**

**Given** `AudioViewer.tsx` lazy
**When** render
**Then** Wavesurfer waveform, play/pause, seek bar, dropdown speed 0.5/0.75/1/1.25/1.5/2x

**Given** đang nghe
**When** mỗi 5s hoặc pause/blur
**Then** upsert `{time_seconds, seconds: currentTime}`

**Given** restore
**When** mount
**Then** seek tới `seconds` ≤ 2s, "Đang ở phút X:YZ"

### Story 3.9: Video Viewer (Plyr)

As a user,
I want xem video với play/pause/seek/0.5–2x/fullscreen, lưu timestamp,
So that resume video khoá học (FR18 + FR22).

**Acceptance Criteria:**

**Given** `VideoViewer.tsx` lazy
**When** render
**Then** Plyr với native controls + fullscreen + speed dropdown

**Given** xem
**When** mỗi 5s/pause/blur
**Then** upsert `{time_seconds, seconds}`

**Given** restore
**When** mount
**Then** seek tới `seconds` ≤ 2s

### Story 3.10: Markdown Viewer (react-markdown + KaTeX + mermaid)

As a user,
I want render Markdown đầy đủ (heading/list/code/table/KaTeX/mermaid),
So that đọc note .md từ Obsidian (FR19).

**Acceptance Criteria:**

**Given** `MarkdownViewer.tsx` lazy
**When** render
**Then** react-markdown + remark-gfm + remark-math + rehype-katex + mermaid lazy chỉ khi doc có math/mermaid

**Given** code block
**When** render
**Then** syntax highlight (rehype-prism / shiki)

**Given** scroll
**When** đổi
**Then** upsert `{scroll_pct, pct, charOffset?}`

### Story 3.11: Web Clip Viewer (Readability / HTML gốc)

As a user,
I want đọc web clip "reader view" sạch hoặc HTML gốc,
So that bài web không bị quảng cáo (FR20).

**Acceptance Criteria:**

**Given** `WebClipViewer.tsx` lazy
**When** render
**Then** mặc định reader view (HTML cleaned); toggle "HTML gốc"
**And** scroll upsert `{scroll_pct, pct}`

### Story 3.12: Reading history

As a user,
I want xem lịch sử đọc gần đây của 1 doc,
So that biết đã quay lại bao lần (FR24).

**Acceptance Criteria:**

**Given** schema `reading_history(userId, docId, positionType, positionValue, openedAt, deviceId)` index `by_user_doc_opened`
**When** mở doc
**Then** insert row mới (rate-limit 1/giờ/doc)

**Given** reader toolbar icon "Lịch sử"
**When** bấm
**Then** popover ≥ 10 entries gần nhất với `openedAt` VI + position summary
**And** click jump tới position đó

---

## Epic 4: Multi-Tab Workspace Cross-Device

User có thể mở ≤10 tab giống trình duyệt, drag-drop sắp xếp, đóng/mở lại tab vừa đóng; tab list + active tab + scroll state đồng bộ realtime ≤3s.

### Story 4.1: Schema tabs + Convex reactive

As a developer,
I want bảng `tabs(userId, docId, order, isActive, scrollState, lastActiveAt)` với reactive `useTabSync`,
So that mọi thiết bị nhận update realtime (D9 + FR27).

**Acceptance Criteria:**

**Given** schema `tabs` với fields trên + index `by_user`
**When** deploy
**Then** apply

**Given** `convex/tabs/{queries,mutations}.ts`
**When** mở
**Then** export `listByUser()` reactive + `openTab(docId)` + `closeTab(tabId)` + `reorderTabs(orders)` + `setActive(tabId)` + `updateScrollState(tabId, scrollState)`
**And** mọi mutation `requireAuth` + idempotent

**Given** giới hạn 10 tab
**When** open tab thứ 11
**Then** throw `ConvexError({code: "VALIDATION", messageVi: "Tối đa 10 tab cùng lúc"})`

### Story 4.2: Tab bar UI (open/close/switch + 10-tab limit)

As a user,
I want tab bar trên cùng giống trình duyệt,
So that mở nhiều doc (FR25, FR26, FR28).

**Acceptance Criteria:**

**Given** `components/tabs/TabBar.tsx` (desktop) + `TabDropdown.tsx` (mobile <768px)
**When** render
**Then** TabBar list horizontal với favicon (format icon) + title truncated + nút X close; click tab → switch + `setActive`

**Given** ở `/library` click 1 doc "Mở trong tab"
**When**
**Then** `openTab(docId)` + redirect `/reader/[docId]`

**Given** mở tab #11
**When**
**Then** toast VI "Tối đa 10 tab"

**Given** mobile ≥ 4 tab
**When**
**Then** TabDropdown thay TabBar

### Story 4.3: Drag-drop sắp xếp tab + Zustand UI state

As a user,
I want drag-drop sắp xếp tab,
So that nhóm tài liệu liên quan (FR26).

**Acceptance Criteria:**

**Given** TabBar dùng `@dnd-kit/sortable`
**When** drag + drop
**Then** UI optimistic reorder (Zustand `useTabUiStore`) → mutation `reorderTabs` → Convex; fail revert
**And** order đồng bộ qua reactive query thiết bị khác

### Story 4.4: Sync tab cross-device + scroll state realtime

As a user,
I want đóng laptop → mở iPhone thấy đúng 5 tab và scroll state mới nhất,
So that workflow liên tục xuyên thiết bị (FR27 + NFR2).

**Acceptance Criteria:**

**Given** mở 5 tab laptop, scroll vài doc
**When** đóng laptop, mở iPhone đã login
**Then** TabBar iPhone load 5 tab cùng order ≤ 3s sau ConvexProvider connect (NFR2)
**And** click 1 tab → scroll tới `scrollState` đã lưu

**Given** mở app 2 thiết bị
**When** A scroll
**Then** B nhận `scrollState` update qua reactive ≤ 3s
**And** telemetry `tabs.synced`

### Story 4.5: Đóng tất cả tab + mở lại tab vừa đóng

As a user,
I want "Đóng tất cả" và "Mở lại tab vừa đóng" như Chrome Ctrl+Shift+T,
So that recover khi đóng nhầm (FR28).

**Acceptance Criteria:**

**Given** menu tab có "Đóng tất cả"
**When** bấm
**Then** mutation xoá tất cả tabs row của user; UI reset

**Given** session local Zustand stack 5 closed tab gần nhất `{docId, order, scrollState}`
**When** Ctrl/Cmd+Shift+T
**Then** pop stack + `openTab(docId)` restore scrollState
**And** stack chỉ tồn tại session hiện tại (refresh là mất — chấp nhận MVP)

---

## Epic 5: Highlight, Note & Knowledge Linking

User có thể bôi đen → highlight 4 màu menu nổi 1-click; Ctrl/Cmd+N tạo note; sticky note inline; note workspace Markdown free-form; bidirectional link; voice note; auto-save 1s; tag/sắp xếp/tìm note; timestamp/page bookmark.

### Story 5.1: Schema highlights + Convex CRUD

As a developer,
I want bảng `highlights(userId, docId, color, anchor, text, createdAt, updatedAt, voiceNoteStorageId?)`,
So that nền tảng highlight (FR29–FR33).

**Acceptance Criteria:**

**Given** schema `highlights` với `anchor: string` (CFI/page+range/text-quote/timestamp/slide+range), `color: enum`, `text: string`, index `by_user_doc`
**When** deploy
**Then** apply

**Given** `convex/highlights/{queries,mutations}.ts`
**When** mở
**Then** export `listByDoc(docId)`, `create({docId, color, anchor, text, clientMutationId})`, `update`, `delete` đều `requireAuth` + idempotent

### Story 5.2: Highlight inline + floating menu 4 màu

As a user,
I want bôi đen text → menu nổi 1-click tạo highlight 4 màu,
So that mark đoạn nhanh (FR29, FR30).

**Acceptance Criteria:**

**Given** `components/highlight/HighlightLayer.tsx` + `FloatingMenu.tsx` mount trong viewer PDF/EPUB/DOCX/MD/WebClip
**When** select text ≥ 3 ký tự
**Then** FloatingMenu xuất hiện gần selection với 4 swatch màu (yellow/green/blue/pink) + "Note" + "Copy"

**Given** click 1 màu
**When**
**Then** mutation `highlights.create`; highlight render ngay (optimistic + reactive)

**Given** mutation fail (offline)
**When** outbox queue
**Then** highlight render local Dexie + badge pending (Epic 8 flush)

### Story 5.3: Highlight list + jump

As a user,
I want xem list highlight 1 doc, click jump,
So that review nhanh (FR31).

**Acceptance Criteria:**

**Given** sidebar reader panel "Highlights"
**When** mở
**Then** liệt kê highlight sort `createdAt desc`, mỗi item color swatch + text snippet ≤120 chars + relative VI

**Given** click 1 highlight
**When**
**Then** viewer scroll/seek tới `anchor` đúng (gọi viewer-specific `scrollToAnchor`)

### Story 5.4: Edit + Delete highlight

As a user,
I want sửa màu hoặc xoá highlight,
So that dọn dẹp/đổi ý (FR32).

**Acceptance Criteria:**

**Given** click 1 highlight
**When** popover hiện
**Then** 4 swatch đổi màu + nút "Xoá"

**Given** "Xoá" + confirm
**When**
**Then** mutation `delete`; biến mất khỏi viewer + list

### Story 5.5: Bookmark/Timestamp marker

As a user,
I want bookmark page PDF/EPUB, timestamp audio/video, slide bookmark PPTX như highlight,
So that mark vị trí không có text selection (FR33).

**Acceptance Criteria:**

**Given** AudioViewer/VideoViewer toolbar "Bookmark vị trí này"
**When** bấm
**Then** mutation `create` với anchor `{time_seconds, seconds: currentTime}`, text "Mốc tại phút X:YZ"

**Given** PDFViewer/EPUBViewer "Bookmark trang"
**When** bấm
**Then** create với anchor `{pdf_page, page, offset: 0}` hoặc CFI

**Given** PPTXViewer
**When** bookmark
**Then** create với `{slide_index, slide}`
**And** highlight list hiển thị các bookmark này, click jump

### Story 5.6: Sticky note inline neo highlight

As a user,
I want sticky note nhỏ neo vào highlight, click expand/collapse,
So that recall ý nghĩ tại vị trí (FR36).

**Acceptance Criteria:**

**Given** schema `highlights.stickyNoteText: string | null`
**When** highlight có stickyNoteText
**Then** viewer render icon 📝 cạnh highlight; click expand thành sticky note ≤200 chars; click collapse

**Given** highlight chưa có sticky
**When** right-click hoặc icon edit
**Then** popover input "Ghi chú nhanh" + Lưu → mutation `update(id, {stickyNoteText})`

**Given** sticky > 200 chars
**When** gõ
**Then** auto truncate + gợi ý "Note dài hơn? Mở Note pane (Ctrl+N)"

### Story 5.7: Note pane từ highlight với Ctrl/Cmd+N (≤1.5s)

As a user,
I want Ctrl/Cmd+N → pane note bên cạnh viewer mở caret ≤1.5s,
So that gõ note ngay không rời tài liệu (FR30 + NFR4).

**Acceptance Criteria:**

**Given** floating menu có "Note"
**When** click hoặc Ctrl/Cmd+N với selection active
**Then** pane note slide-in từ phải (40% viewport) + caret focus input ≤ 1.5s từ keypress (NFR4)
**And** telemetry `note.opened_from_highlight`

**Given** pane note mở
**When** gõ + đóng (X/Esc)
**Then** mutation `notes.upsert` + create relationship `note_links(noteId, highlightId)` bidirectional

### Story 5.8: Schema notes + auto-save ≤1s

As a developer,
I want bảng `notes(userId, title, bodyMd, tagIds, parentDocId?, updatedAt)` với upsert auto-save throttled,
So that note không mất + auto-save ≤1s (FR34, FR37 + NFR5).

**Acceptance Criteria:**

**Given** schema `notes` + `note_links(noteId, targetType, targetId, createdAt)` index `by_note`, `by_target`
**When** deploy
**Then** apply

**Given** `convex/notes/{queries,mutations}.ts`
**When** mở
**Then** export `getById`, `listByUser({tagIds?, parentDocId?, dateRange?})`, `upsert({noteId?, title, bodyMd, parentDocId?, clientMutationId})`

**Given** editor gõ
**When** ngừng gõ
**Then** debounce 800ms → upsert; toast "Đã lưu" ≤1s sau ngừng (NFR5)

### Story 5.9: Note workspace `/notes` Markdown editor

As a user,
I want trang `/notes` editor Markdown free-form (KaTeX/mermaid/code/table/paste image/drag-drop),
So that viết bài tổng hợp (FR34).

**Acceptance Criteria:**

**Given** `/notes/[noteId]/page.tsx` editor (CodeMirror 6 hoặc TipTap)
**When** render
**Then** toolbar H1–H3, list, code, table, math, mermaid, link; preview pane react-markdown + KaTeX + mermaid lazy

**Given** paste ảnh clipboard Ctrl+V
**When**
**Then** ảnh upload qua `storage.upload` → insert `![](url)` tại caret

**Given** drag-drop file vào editor
**When**
**Then** upload, insert link đính kèm

**Given** `/notes` (list)
**When** load
**Then** liệt kê note user sort `updatedAt desc`, nút "Tạo note mới"

### Story 5.10: Bidirectional link `@doc-title` `@highlight-id`

As a user,
I want gõ `@` autocomplete doc/highlight → link 2 chiều,
So that knowledge graph hình thành (FR35).

**Acceptance Criteria:**

**Given** editor note
**When** gõ `@`
**Then** popover autocomplete liệt kê doc + highlight gần đây (`useQuery` search-as-you-type), tab/enter chọn → insert `[@Tên doc](docref:DOCID)` markdown

**Given** chọn 1 target
**When** save note
**Then** insert `note_links(noteId, targetType: "doc"|"highlight", targetId)`

**Given** mở doc
**When** xem panel "Backlinks"
**Then** liệt kê note có link tới doc này (query `note_links` by `targetId`)

**Given** xoá doc
**When** confirm
**Then** giữ note_links nhưng render placeholder "[Doc đã xoá]"

### Story 5.11: Tag note + filter/sort

As a user,
I want gán tag note và filter tag/ngày/doc nguồn,
So that tổ chức note (FR38).

**Acceptance Criteria:**

**Given** editor note có input tag (chung `tags` table với doc)
**When** gõ tag
**Then** insert vào `notes.tagIds`

**Given** `/notes` filter bar
**When** chọn tag/date/`parentDocId`
**Then** list filter, URL query string reflect

### Story 5.12: Voice note đính kèm highlight (FR39)

As a user,
I want bấm mic ghi voice → đính kèm highlight (chỉ lưu file, không transcribe MVP),
So that ghi cảm xúc nhanh hơn gõ (FR39).

**Acceptance Criteria:**

**Given** floating menu trên highlight có "🎤 Voice note"
**When** click
**Then** modal recorder (`MediaRecorder`) + Start/Stop + waveform realtime; max 2 phút

**Given** stop
**When** "Lưu"
**Then** upload (MP3/WebM ≤ 5MB) qua `storage.upload` → set `highlights.voiceNoteStorageId = Id<"_storage">`

**Given** highlight có voiceNoteStorageId
**When** xem
**Then** icon 🎤 → click play audio mini-player

**Given** browser không có mic permission
**When** bấm
**Then** error VI "Cần cấp quyền microphone"

---

## Epic 6: Full-Text Search Across Docs + Notes

User có thể search 1 từ khoá ra đồng thời doc content + note + highlight; grouping + snippet highlight; filter; click jump.

### Story 6.1: Convex search index + extract text content

As a developer,
I want extract text từ PDF/EPUB/DOCX/PPTX/MD/web khi upload + Convex search index,
So that search ra content (FR40 + D3).

**Acceptance Criteria:**

**Given** Convex action `documents.actions.extractTextContent(docId)` chạy sau finalize upload
**When** format ∈ {pdf, epub, docx, pptx, md, webclip}
**Then** server-side extract text (PDF.js / epubjs / mammoth / docx-template / raw text/HTML cleaned)
**And** lưu vào `documents.searchableText: string` (max 1MB cắt đoạn)

**Given** schema `documents` có search index `search_text` trên `searchableText` filter `userId`, `format`
**When** deploy
**Then** Convex search index built

**Given** audio/video/image
**When** upload xong
**Then** `searchableText = title` (không OCR/transcribe MVP)

**Given** Convex search 1024 limit
**When** query
**Then** acceptable MVP; document fallback Meilisearch khi vượt (P2+)

### Story 6.2: Search bar + query unified

As a user,
I want gõ 1 từ khoá → kết quả từ doc + note + highlight,
So that 1 phát ra hết (FR40).

**Acceptance Criteria:**

**Given** topbar `<SearchBar>` (Cmd/Ctrl+K mở)
**When** gõ ≥ 2 ký tự, debounce 200ms
**Then** parallel 3 query `api.documents.queries.search`, `api.notes.queries.search`, `api.highlights.queries.search`
**And** kết quả ≤ 1s với ≤500 docs (NFR6)

**Given** 1 query
**When** chạy
**Then** telemetry `search.executed` với `latencyMs`, `q.length`, `resultCount`

### Story 6.3: Search results UI — grouping + snippet highlight

As a user,
I want kết quả grouping theo loại với snippet highlight match,
So that scan kết quả nhanh (FR41).

**Acceptance Criteria:**

**Given** `/search?q=...` hoặc dropdown
**When** render
**Then** 3 section "Tài liệu (X)", "Note (Y)", "Highlight (Z)"; mỗi item title + snippet ~120 chars với `<mark>` quanh keyword

**Given** snippet generation
**When** server trả `searchableText`
**Then** client `lib/search/snippet.ts` extract context ±60 chars quanh match (case-insensitive)

### Story 6.4: Filter search

As a user,
I want refine search bằng filter tag/format/date/parentDoc,
So that thu hẹp khi nhiều match (FR42).

**Acceptance Criteria:**

**Given** filter bar bên cạnh result
**When** chọn filter
**Then** query re-run với filter args; URL bookmarkable
**And** filter "format" multi-select; "tag" multi-select; "date" range; "parentDoc" dropdown (Note)

### Story 6.5: Click result jump

As a user,
I want click result → mở doc/note đúng vị trí keyword,
So that không phải scroll tìm (FR43).

**Acceptance Criteria:**

**Given** click 1 doc result
**When**
**Then** redirect `/reader/[docId]?q=keyword&pos=offset` → viewer mount + scroll/seek tới occurrence đầu tiên + highlight tạm 3s

**Given** click 1 note result
**When**
**Then** `/notes/[noteId]?q=keyword` → editor scroll match đầu

**Given** click 1 highlight result
**When**
**Then** `/reader/[docId]` + scroll tới `anchor`

---

## Epic 7: Reading Mode (Focused Reading UX)

User có thể bật Reading Mode bằng F/Cmd+Shift+R cho PDF/EPUB/DOCX/MD/web → fullscreen typography; theme Sáng/Sepia/Tối nhớ riêng từng định dạng; tuỳ chỉnh font/size/line-height/cột; EPUB continuous/paginated; progress bar + ước lượng "Còn ~X phút"; Esc thoát.

### Story 7.1: Schema users.preferences.readingMode + reducer

As a developer,
I want lưu reading mode preferences per format vào `users.preferences.readingMode`,
So that user mở doc đúng format thấy ngay setting đã chọn (FR61, FR62).

**Acceptance Criteria:**

**Given** schema extension bổ sung map per-format `{pdf?, epub?, docx?, md?, webclip?}` mỗi entry `{theme, font, fontSize, lineHeight, columnWidth}`
**When** deploy
**Then** apply

**Given** mutation `users.updateReadingModePreferences(format, prefs)` reactive
**When** user chỉnh
**Then** lưu + sync ngay sang thiết bị khác

### Story 7.2: Toggle Reading Mode F/Cmd+Shift+R/Esc

As a user,
I want F hoặc Cmd+Shift+R bật Reading Mode (ẩn chrome, fullscreen typography); Esc thoát,
So that tập trung đọc (FR60, FR67).

**Acceptance Criteria:**

**Given** keyboard shortcut declared `lib/keyboard/shortcuts.ts`
**When** trên reader page bấm `F` hoặc `Cmd+Shift+R`
**Then** `useReaderUiStore.setReadingMode(true)` → tab bar/sidebar/header ẩn (CSS class), viewer fullscreen 100vw/100vh

**Given** Reading Mode bật
**When** Esc hoặc nút X
**Then** thoát về UI bình thường

**Given** chỉ format ∈ {pdf, epub, docx, md, webclip} support
**When** đang xem audio/video/image/pptx
**Then** shortcut không effect; toast VI "Reading Mode chỉ cho định dạng đọc"

### Story 7.3: Theme Sáng/Sepia/Tối + nhớ per-format

As a user,
I want chọn theme cho Reading Mode, mỗi format nhớ riêng,
So that EPUB sách đêm tối, PDF research sáng (FR61).

**Acceptance Criteria:**

**Given** Reading Mode panel (icon ⚙ trong fullscreen)
**When** click 1 trong 3 theme swatch
**Then** background + text color switch ngay; mutation `updateReadingModePreferences(format, {theme})` lưu

**Given** mỗi theme
**When** kiểm contrast
**Then** ≥ 4.5:1 text/background (NFR23) — verify qua axe CI

**Given** mở EPUB lần sau
**When** Reading Mode bật
**Then** restore theme đã chọn cho EPUB

### Story 7.4: Tuỳ chỉnh font + size + line-height + column width

As a user,
I want font (Serif/Sans/Mono), size 12–28px, line-height 1.4–2.0, column narrow/medium/wide,
So that typography đẹp nhất (FR62).

**Acceptance Criteria:**

**Given** Reading Mode settings panel
**When** chỉnh slider/dropdown
**Then** preview real-time + auto-save mutation per change (debounce 500ms)

**Given** font dropdown
**When** chọn
**Then** body font apply (Charter/Georgia, Inter, JetBrains Mono — qua next/font)

**Given** column width
**When** chọn narrow (40ch) / medium (65ch) / wide (90ch)
**Then** content `max-width` apply

### Story 7.5: EPUB continuous/paginated + ←/→ + swipe

As a user,
I want EPUB continuous scroll hoặc paginated với ←/→ desktop và vuốt mobile,
So that chọn trải nghiệm phù hợp (FR63).

**Acceptance Criteria:**

**Given** EPUBViewer trong Reading Mode toggle "Cuộn / Lật trang"
**When** chọn paginated
**Then** epubjs `flow: "paginated"`; ←/→ chuyển trang; swipe ngang mobile

**Given** continuous
**When** chọn
**Then** `flow: "scrolled-doc"`; scroll dọc; ←/→ disabled

**Given** preferences nhớ
**When** mở lại
**Then** restore mode

### Story 7.6: Progress bar + ước lượng "Còn ~X phút"

As a user,
I want progress bar dưới + "Còn ~12 phút",
So that biết còn bao lâu đọc xong (FR65).

**Acceptance Criteria:**

**Given** schema `users.preferences.avgReadingSpeedWPM: number | null`
**When** Reading Mode bật
**Then** progress bar dưới hiện % đọc + "Còn ~X phút"

**Given** lần đầu chưa có WPM
**When** assume 250 WPM default
**Then** estimate dựa trên 250 + remaining text length

**Given** sau 5 phút đọc
**When** đo qua telemetry (rate × text length)
**Then** update `avgReadingSpeedWPM` adaptive (moving average)

---

## Epic 8: Offline & PWA Reliability

User có thể cài app vào màn hình chính; đọc offline tài liệu 7 ngày gần nhất; offline highlight/note → queue → auto-sync; conflict resolution UI.

### Story 8.1: PWA manifest + install banner + Safari Add-to-Home

As a user,
I want cài app vào home screen iPhone/iPad qua Safari "Add to Home" và Android/Desktop install banner,
So that mở từ home như native (FR44).

**Acceptance Criteria:**

**Given** `apps/web/public/manifest.webmanifest`
**When** mở
**Then** chứa `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `background_color`, `theme_color`, icons 192/512/maskable

**Given** Safari iOS
**When** Share → "Add to Home Screen"
**Then** icon home screen, tap mở app standalone

**Given** Chrome/Edge desktop hoặc Android
**When** vào app
**Then** install banner sau ≥ 30s engagement; click → installed

**Given** Lighthouse PWA audit
**When** chạy
**Then** score ≥ 90, "Installable" + "PWA Optimized" pass

### Story 8.2: Service Worker + Workbox

As a user,
I want SW cache static + tài liệu mở, NetworkFirst Convex, fallback offline,
So that 7 ngày gần nhất offline (FR45 + NFR20 + D4).

**Acceptance Criteria:**

**Given** `apps/web/public/sw.ts` build qua Workbox CLI
**When** dev/build
**Then** sinh `sw.js`:
  - CacheFirst static `*.{js,css,woff2,png,svg}` expire 1 năm
  - NetworkFirst `*.convex.cloud` timeout 3s fallback cache
  - StaleWhileRevalidate doc binary URL expire 7 ngày + max 500MB LRU eviction theo `last_opened_at` (NFR20)

**Given** online
**When** mở doc lần đầu
**Then** SW cache file
**And** sau đó offline mở lại → load từ cache <1s

**Given** cache vượt 500MB
**When** SW evict
**Then** xoá doc oldest `last_opened_at`

**Given** SW update mới
**When** deploy
**Then** Workbox `skipWaiting` + `clientsClaim`, toast VI "Bản cập nhật mới — refresh để dùng"

### Story 8.3: Dexie.js IndexedDB cache

As a developer,
I want Dexie DB `webkb` mirror Convex offline,
So that data offline + outbox queue (D4).

**Acceptance Criteria:**

**Given** `apps/web/src/lib/outbox/dexie.ts`
**When** init
**Then** Dexie DB `webkb` v1 với store: `documents_cache`, `notes_cache`, `mutation_outbox`, `media_blob`, `tabs_cache`

**Given** hook `useOfflineDoc(docId)`
**When** online
**Then** Convex query → mirror Dexie + return data

**Given** hook offline
**When**
**Then** đọc từ Dexie

### Story 8.4: Outbox + Workbox BG Sync + iOS polling (D6)

As a user,
I want offline highlight/note/tag → ghi local → tự sync khi online (kể cả iOS Safari),
So that không sợ mất offline data (FR46 + D6).

**Acceptance Criteria:**

**Given** `lib/outbox/queue.ts` + `useMutateWithOutbox`
**When** mọi mutation client
**Then** ghi `mutation_outbox` Dexie trước (optimistic) + tag `clientMutationId: uuidv7()`

**Given** Chrome/Edge/Android online
**When** SW receive `sync` event
**Then** flush outbox: mỗi entry → call Convex mutation; thành công xoá entry; fail exponential backoff (1s,2s,4s,...,60s, max 10 attempts)

**Given** iOS Safari (no BG Sync)
**When** `visibilitychange` tab visible + online
**Then** flush outbox như trên

**Given** Convex side
**When** mutation chạy
**Then** check `mutation_log` qua `clientMutationId` → đã có → skip (idempotent)

**Given** entry fail 10 attempts
**When**
**Then** mark `permanentlyFailed: true`, hiện UI "Sync Conflicts" → user xử thủ công

### Story 8.5: Sync badge + pending count

As a user,
I want badge "3 thay đổi chưa sync" khi outbox không rỗng,
So that biết data còn local (FR47).

**Acceptance Criteria:**

**Given** topbar `<SyncBadge>`
**When** Dexie outbox count > 0 (live query)
**Then** badge VI "3 thay đổi chưa sync" + spinner khi flush

**Given** outbox = 0
**When**
**Then** ẩn badge

**Given** click badge
**When**
**Then** popover liệt kê pending mutation (entityType + thời gian) + "Thử sync ngay"

### Story 8.6: Conflict resolution UI `/sync-conflicts` (D5)

As a user,
I want panel side-by-side diff khi conflict (>20 chars), chọn A/B/merge,
So that không mất data khi 2 thiết bị edit (FR47 + NFR17 + D5).

**Acceptance Criteria:**

**Given** schema `sync_conflicts` đã có Architecture index `by_user_resolved`
**When** server LWW detect diff > 20 chars
**Then** insert row `sync_conflicts` thay vì overwrite

**Given** user vào `/sync-conflicts`
**When** load
**Then** liệt kê tất cả `resolved: false`; mỗi item `entityType` + `entityId` + `fieldName` + diff side-by-side (A vs B highlight chữ đổi qua `diff-match-patch`)

**Given** chọn version
**When** "Giữ A" / "Giữ B" / merge thủ công
**Then** mutation update entity với value chọn + `sync_conflicts.resolved = true`

**Given** ≥ 1 conflict pending
**When** topbar
**Then** badge đỏ "X conflicts cần xử"

---

## Epic 9: Data Portability, Backup & Self-Observability

User có thể export toàn bộ/đơn lẻ ra ZIP (Obsidian-compat); auto backup weekly Google Drive; xoá tài khoản; xem telemetry + error dashboard.

### Story 9.1: Export 1 document đơn lẻ

As a user,
I want export 1 doc thành ZIP (file gốc + highlights.md + notes.md liên quan),
So that share/backup riêng (FR49).

**Acceptance Criteria:**

**Given** card document có "Export"
**When** click
**Then** Convex action build ZIP server-side: `<title>.<ext>` (file gốc), `highlights.md` (table), `notes/<noteId>.md` cho mỗi note có `parentDocId = docId`
**And** stream qua `/api/export/[exportId]/route.ts` → browser download

**Given** doc có voice note
**When** export
**Then** include `voice/<highlightId>.mp3` trong ZIP

**Given** Markdown
**When** mở Obsidian
**Then** wikilink `[[doc-title]]` hoạt động (NFR32)

### Story 9.2: Export `/export/all` toàn bộ

As a user,
I want endpoint xuất toàn bộ library + note + highlight + tag + reading_progress ra ZIP,
So that data portability ngày 1 (FR48 + NFR19, NFR32).

**Acceptance Criteria:**

**Given** `/settings/export` có "Export tất cả"
**When** click
**Then** Convex scheduled action queue export job; UI progress; xong → link download

**Given** ZIP cấu trúc
**When** mở
**Then** chứa:
  - `documents/<docId>/<title>.<ext>` (file gốc)
  - `documents/<docId>/highlights.md`
  - `notes/<noteId>.md` (frontmatter `tags`, `parentDocId`)
  - `data.json` (raw export tags, reading_progress, sync_conflicts, users.preferences)
  - `README.md` Obsidian guide

**Given** library ≤ 1000 docs, ≤ 5GB
**When** export
**Then** ≤ 2 phút (NFR19)

**Given** mở data.json + folder docs Obsidian vault
**When**
**Then** wikilink + tag hoạt động, không mất highlight/note

### Story 9.3: Auto backup weekly Google Drive

As a user,
I want auto backup snapshot weekly lên Google Drive của tôi, giữ 4 bản,
So that data an toàn (FR50 + NFR18).

**Acceptance Criteria:**

**Given** `/settings/backup` "Kết nối Google Drive" OAuth
**When** authorize
**Then** lưu refresh token Convex (encrypted) `users.googleDriveRefreshToken`

**Given** `convex/crons.ts` cron Sunday 03:00 ICT
**When** chạy
**Then** với mỗi user có Drive token: tạo ZIP snapshot (Story 9.2 logic) → upload Drive folder `WebKnowledgeBase-Backups/<YYYY-MM-DD>.zip`
**And** auto-prune giữ 4 bản

**Given** token revoke / Drive đầy
**When** cron fail
**Then** `error_logs` ghi + email user qua Resend "Backup tuần này thất bại"

**Given** `/settings/backup`
**When** load
**Then** list 4 backup gần nhất + thời gian + size + "Backup ngay"

### Story 9.4: Xoá vĩnh viễn tài khoản

As a user,
I want xoá tài khoản + toàn bộ data,
So that quyền remove triệt để (FR51).

**Acceptance Criteria:**

**Given** `/settings/account` "Xoá tài khoản"
**When** click + nhập email confirm + password
**Then** Convex action: xoá tất cả documents (kèm storage qua `storage.delete`), tags, notes, highlights, reading_progress, tabs, voice_notes; xoá Better Auth user; revoke session

**Given** xoá xong
**When**
**Then** redirect landing + toast "Tài khoản đã xoá vĩnh viễn"
**And** không recover

### Story 9.5: Telemetry + dashboard `/admin/telemetry`

As a self-observer,
I want telemetry ghi DB + dashboard latency p50/p95, retention, days active,
So that biết app performance thực tế (FR52, FR53).

**Acceptance Criteria:**

**Given** schema `telemetry_events(userId, eventName, latencyMs?, deviceId, meta, ts)` index `by_event_ts`, `by_user_ts`
**When** deploy
**Then** apply

**Given** helper `lib/telemetry/logger.ts` + `convex/lib/telemetry.ts`
**When** action user-facing có latency budget (resume_position.loaded, tabs.synced, note.saved, search.executed, upload.completed, outbox.flushed)
**Then** call `logTelemetry(eventName, {latencyMs, meta})` → insert event

**Given** `/admin/telemetry` (chỉ self — hardcoded check `userId === ADMIN_USER_ID` env)
**When** load
**Then** hiển thị:
  - Bảng p50/p95/p99 cho mỗi event 7 ngày qua
  - Line chart days active 30 ngày
  - Counter số doc đọc, highlight, note tạo tuần
  - Heatmap giờ active

**Given** không gửi third-party
**When** check network tab
**Then** không request `*.google-analytics.com`, `*.posthog.com` (NFR13)

### Story 9.6: Error log dashboard `/admin/errors`

As a self-debugger,
I want bảng error_logs với stack + context,
So that bắt regression sớm (FR54).

**Acceptance Criteria:**

**Given** schema `error_logs(userId, errorCode, message, stack, route, userAgent, ts)` index `by_user_ts`
**When** deploy
**Then** apply

**Given** `lib/errors.ts` client wrapper
**When** catch unknown error (không phải `ConvexError` typed)
**Then** mutation `error_logs.insert({errorCode: "INTERNAL", message, stack, route, userAgent})`

**Given** `app/error.tsx` global Boundary
**When** uncaught render error
**Then** log + UI fallback "Có lỗi xảy ra — đã ghi nhận để debug"

**Given** `/admin/errors` table
**When** load
**Then** liệt kê 100 error gần nhất với filter route + errorCode + "Mark resolved"

---

## Epic 10: Sharing & Collaboration (Phase 2+)

User có thể mời người khác qua email với role viewer/commenter/editor; "Shared with me"; realtime comment trên highlight; thu hồi quyền. Schema `document_shares` đã có sẵn từ MVP.

> **Stories được expand khi sang Phase 2+:**
> - Story 10.1: Schema `document_shares` + invite flow qua email (FR55)
> - Story 10.2: Role-based UI gating viewer/commenter/editor (FR56)
> - Story 10.3: "Shared with me" tab (FR57)
> - Story 10.4: Realtime comment trên highlight qua Convex reactive (FR58)
> - Story 10.5: Notification system in-app + email
> - Story 10.6: Revoke share + remove user (FR59)
> - Story 10.7: Rate limit 100 req/phút/user qua Convex Rate Limiter (D8 + NFR15)

---

## Epic 11: Reading Mode Advanced (Phase 2+)

User có thể chọn font OpenDyslexic; bật dual-page spread; Focus mode; TTS đọc to.

> **Stories được expand khi sang Phase 2+:**
> - Story 11.1: Font OpenDyslexic + reduced-motion preference (FR62b + NFR26)
> - Story 11.2: Dual-page spread EPUB/PDF ≥768px (FR64)
> - Story 11.3: Focus mode — paragraph hiện tại sáng (FR66)
> - Story 11.4: TTS Web Speech API + sync scroll (FR68 MVP P2+)
> - Story 11.5: TTS Whisper TTS chất lượng cao (FR68 Phase 3+)
