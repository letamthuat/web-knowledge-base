---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain-skipped', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
releaseMode: 'phased'
phases: ['Phase 1: Core Reading (tuần 1–3)', 'Phase 2: Multi-tab & Note (tuần 4–5)', 'Phase 3: Polish & Safety (tuần 6–8)', 'Phase 2+: Growth (Multi-user, AI, Web clipper)', 'Phase 3+: Vision (Knowledge graph, mobile native, TTS, AI agent)']
visionInsights:
  oneLiner: 'Workspace đọc & học cá nhân duy nhất — mở mọi loại tài liệu, đồng bộ vị trí đọc giữa mọi thiết bị, ghi chú liền mạch.'
  differentiators:
    - 'All-format trong 1 chỗ (PDF/EPUB/DOCX/PPTX/Audio/Video/Ảnh/Web/MD)'
    - 'Resume Anywhere cho MỌI định dạng (không chỉ ebook)'
    - 'Multi-tab dạng trình duyệt, đồng bộ tab cross-device'
  coreInsight: 'Đọc & học là dòng chảy liên tục xuyên thiết bị/định dạng/thời gian — máy nên nhớ vị trí, không phải não.'
  futureAudience: 'Đồng nghiệp + bạn học (small group sharing, invite-by-email, role-based)'
  whyNow: 'Niềm tin SaaS đóng sụp đổ post-Omnivore/Pocket; AI-coding 2026 cho phép non-coder build trong 8 tuần; free-tier hosting cực rộng.'
inputDocuments:
  - _bmad-output/planning-artifacts/research/market-personal-knowledge-base-reading-app-research-2026-04-25.md
workflowType: 'prd'
projectName: 'Web Knowledge Base'
author: 'Thuat'
date: '2026-04-25'
classification:
  projectType: 'Web App + PWA (single-page reading & note workspace)'
  domain: 'Personal Knowledge Management & Learning'
  complexity: 'Medium-High'
  projectContext: 'greenfield'
  userScopeMvp: 'single-user'
  futureScope: 'multi-user with sharing & role-based permissions (Phase 2+)'
  aiFeatures: 'deferred to Phase 2+'
  codingActor: 'Claude Code'
  platforms:
    - 'Web (laptop browser, primary)'
    - 'PWA via Safari Add-to-Home on iOS/iPad'
---

# Product Requirements Document — Web Knowledge Base

**Author:** Thuat
**Date:** 2026-04-25
**Status:** Draft v1 — Ready for Architecture phase
**Companion docs:** [Market Research](research/market-personal-knowledge-base-reading-app-research-2026-04-25.md)

## Mục lục

1. [Executive Summary](#executive-summary)
2. [Project Classification](#project-classification)
3. [Success Criteria](#success-criteria)
4. [User Journeys](#user-journeys)
5. [Innovation & Novel Patterns](#innovation--novel-patterns)
6. [Web App + PWA — Technical Requirements](#web-app--pwa--technical-requirements)
7. [Scope, Phases & Roadmap](#scope-phases--roadmap)
8. [Functional Requirements](#functional-requirements) (FR1–FR68)
9. [Non-Functional Requirements](#non-functional-requirements) (NFR1–NFR37)
10. [Document Status & Next Steps](#document-status--next-steps)

---

## Executive Summary

**Web Knowledge Base** là một workspace đọc & học cá nhân hợp nhất — nơi mọi loại tài liệu (PDF, EPUB, DOCX, PPTX, ảnh, audio, video, Markdown, web clip) được upload, đọc, ghi chú và đồng bộ vị trí đọc liền mạch giữa laptop, iPad và iPhone. Sản phẩm phục vụ trước tiên một người dùng (Thuat) trong vai trò người học suốt đời — đọc nghiên cứu, sách, slide, podcast học, video khoá học — với mục tiêu tri thức không bao giờ thất lạc giữa các app, các định dạng và các thiết bị. Phase 2+ mở rộng sang nhóm nhỏ (đồng nghiệp, bạn học) với chia sẻ tài liệu phân quyền theo vai trò.

Vấn đề cốt lõi: thị trường 2026 không có sản phẩm phổ thông nào đáp ứng đồng thời 12 tiêu chí của persona "Multi-format Learner" (xác minh qua feature matrix 12 cột × 10 đối thủ trong nghiên cứu thị trường kèm theo). Readwise Reader đắt và không upload video/PPTX/audio dài; Notion không annotate được PDF; Obsidian sync hay lỗi cross-device; BookFusion chỉ ebook; Karakeep chỉ bookmark/PDF ngắn. Cú shutdown của Omnivore (11/2024) và Pocket-35M-user (07/2025) còn làm sụp đổ niềm tin với SaaS đóng — đẩy người dùng tìm giải pháp tự sở hữu dữ liệu.

### What Makes This Special

Ba điểm khác biệt cốt lõi (ngang nhau về ưu tiên):

1. **All-format trong 1 chỗ** — PDF · EPUB · DOCX · PPTX · ảnh · audio · video · web/MD đều mở được, đều note được, đều resume được trong cùng một UX. Đây là combo chưa có sản phẩm phổ thông nào làm trọn vẹn.
2. **"Resume Anywhere" cho mọi định dạng** — không chỉ ebook. Đóng laptop nửa chừng PDF → mở iPhone → load đúng trang đúng dòng. Nghe podcast iPad đến phút 23:15 → mở laptop tiếp tục từ 23:15. Sync vị trí dùng CFI (EPUB), page+offset (PDF), timestamp (audio/video), scroll % (web/MD).
3. **Multi-tab dạng trình duyệt, đồng bộ cross-device** — mở 5 tài liệu cùng lúc, tab bar giống Chrome, đóng laptop → mở iPad thấy đúng 5 tab đó.

**Core insight**: Đọc và học không phải hành động "1 thiết bị, 1 phiên" — nó là dòng chảy liên tục xuyên thiết bị, định dạng, và thời gian. Mọi tool hiện tại bắt người dùng nhớ "lần trước đọc tới đâu / file nào / app nào" — đó là việc của máy, không phải việc của não.

**Why now**: AI-coding 2026 (Claude Code) cho phép một người không-code build trong 8 tuần (44% SaaS có lợi nhuận hiện do 1 founder vận hành). OSS viewer libraries đầy đủ (PDF.js, epubjs, mammoth, react-pptx, Plyr, Wavesurfer). Free-tier hosting cực rộng (Cloudflare Pages unlimited bandwidth, Cloudflare R2 zero egress). Tổng chi phí vận hành mục tiêu: **$0/tháng**.

## Project Classification

| Mục | Giá trị |
|---|---|
| Project Type | Web App + PWA (Safari "Add to Home" cho iOS/iPad; web thường trên laptop) |
| Domain | Personal Knowledge Management & Learning |
| Complexity | Medium-High (multi-format viewer, realtime cross-device sync, multi-tab state, offline PWA) |
| Project Context | Greenfield |
| User Scope (MVP) | Single-user; schema chuẩn bị sẵn cho multi-user + sharing có phân quyền (Phase 2+) |
| AI Features | Phase 2+ (không có ở MVP) |
| Coding Actor | Claude Code (user không code) |
| Target Cost | **$0/tháng** trên hạ tầng free-tier |

---

## Success Criteria

### User Success

User Thuat coi sản phẩm là **thành công** khi đạt cả các trải nghiệm sau, đo trong 30 ngày sử dụng đầu tiên:

1. **"Resume Anywhere" hoạt động không nghĩ ngợi**: đổi thiết bị giữa 3 máy (laptop ↔ iPad ↔ iPhone) và mở lại đúng vị trí đọc trong **≤ 2 giây**, ≥ 95% lần đổi máy. Đo qua telemetry nội bộ (event `resume_position_loaded` với latency).
2. **Không bao giờ phải hỏi "lần trước đọc tới đâu/file nào"**: tab list xuất hiện ngay khi mở app, đồng bộ trong **≤ 3 giây** giữa thiết bị (event `tabs_synced`).
3. **Multi-format reality check**: upload và đọc trọn vẹn ít nhất 5 tài liệu cho mỗi định dạng (PDF/EPUB/DOCX/PPTX/ảnh/audio/video/MD) — tổng tối thiểu **40 tài liệu** đa dạng.
4. **Search 1 phát ra hết**: tìm 1 từ khoá → kết quả từ cả nội dung file lẫn note, **≤ 1 giây** với thư viện ≤ 500 tài liệu.
5. **Note-taking thuận lợi tuyệt đối** (mục tiêu cốt lõi, ngang với Resume Anywhere):
    - **5a. Highlight → Note ≤ 1 thao tác**: bôi đen đoạn text → menu nổi xuất hiện ngay → 1 click "Note" mở pane note bên cạnh, không rời tài liệu, không chuyển trang. Phím tắt `Ctrl+N` / `Cmd+N` để gõ note ngay sau khi highlight, không cần chạm chuột.
    - **5b. Note inline ngay tại vị trí**: gõ note xuất hiện như sticky note nhỏ neo vào highlight; có thể thu/mở; không che chữ đang đọc.
    - **5c. Note workspace tự do**: bên ngoài tài liệu, có 1 trang note Markdown free-form (không gắn cứng với 1 tài liệu) — dùng để tổng hợp, viết bài, brainstorm; có thể mention `@tài-liệu` hoặc `@highlight-id` để link 2 chiều.
    - **5d. Format phong phú**: Markdown đầy đủ (heading, list, code, table, math KaTeX, mermaid diagram), inline image paste, drag-drop file đính kèm.
    - **5e. Voice note** (cố gắng kịp MVP): nút mic → ghi âm → lưu kèm highlight (transcribe để Phase 2+).
    - **5f. Note tìm được dễ**: full-text search ra cả nội dung note; filter theo tag, theo tài liệu nguồn, theo ngày.
    - **5g. Note không bao giờ mất**: auto-save mỗi 1 giây sau khi gõ; offline cache; conflict resolution rõ ràng nếu sync.
    - *Tiêu chí cảm xúc*: sau 1 tuần, Thuat tự nói được câu **"viết note ở đây dễ hơn cả Notion/Obsidian"** — đo bằng self-rating ergonomic 1–5 sau ngày 7, mục tiêu **≥ 4.5**.
6. **"Aha moment" cảm xúc tổng**: sau 1 tuần dùng đều, Thuat tự nói được câu "tôi không cần nhớ vị trí đọc nữa" — đo bằng self-rating 1–5 sau ngày 7, mục tiêu **≥ 4**.
7. **Reading Mode dùng được không nghĩ**: toggle 1 phím tắt (`F` hoặc `Cmd+Shift+R`), typography đẹp ngay không cần config lại; đọc 1 chương sách EPUB/PDF dài hơn 30 phút mắt không mỏi — self-rating ergonomic typography ≥ **4/5** sau 1 tuần.

### Business Success

Vì đây là sản phẩm cá nhân, **business success = sustainability + cost discipline**:

- **Chi phí vận hành**: **$0/tháng** trong suốt 6 tháng đầu (chỉ chi phí Claude Code, không tính API hosting/DB/storage).
- **Time-to-MVP**: **≤ 8 tuần** từ ngày kick-off đến lúc dùng được toàn bộ Phase 1+2 trên 3 thiết bị thật.
- **Retention cá nhân**: vẫn dùng đều (≥ 5 ngày/tuần) sau **3 tháng** kể từ MVP.
- **Phase 2 readiness**: ≤ 2 tuần để mở rộng sang **5 user beta** (đồng nghiệp/bạn học) khi quyết định share — schema không cần migration đau.

### Technical Success

- **Cross-device sync reliability**: ≥ **99% sync events** thành công, không mất dữ liệu khi 2 thiết bị offline-online ngẫu nhiên (last-write-wins + conflict log).
- **Page load**: tải tài liệu trung bình ≤ **2 giây** cho file ≤ 50MB; ≤ **5 giây** cho file ≤ 500MB (video/audio dài).
- **Offline PWA**: 100% tài liệu đã mở trong 7 ngày gần nhất đọc được offline trên iPad (Service Worker + IndexedDB cache).
- **Data portability**: endpoint `/export/all` xuất ZIP đầy đủ Markdown + JSON + file gốc; mở lại được trong Obsidian mà không mất highlight/note.
- **Backup**: snapshot tự động hàng tuần lên Google Drive (cron Cloudflare Worker), giữ ≥ 4 bản gần nhất.
- **Auth security**: dùng Clerk hoặc Supabase Auth, MFA tuỳ chọn, session timeout 30 ngày trên thiết bị tin cậy.

### Measurable Outcomes (KPI MVP)

| Metric | Mục tiêu | Cách đo |
|---|---|---|
| Resume position latency | ≤ 2s, ≥ 95% lần | Telemetry |
| Tab sync latency | ≤ 3s | Telemetry |
| Search latency (≤500 docs) | ≤ 1s | Telemetry |
| **Highlight → bắt đầu gõ note** | **≤ 1.5s** | Telemetry |
| **Note auto-save độ trễ** | **≤ 1s từ khi ngừng gõ** | Telemetry |
| **Note search latency (≤5.000 note)** | **≤ 500ms** | Telemetry |
| Sync success rate | ≥ 99% | Sync log |
| Monthly cost | $0 | Hoá đơn |
| Time-to-MVP | ≤ 8 tuần | Lịch dự án |
| Personal retention 3 tháng | ≥ 5 ngày/tuần | App usage log |
| 30-day "Aha" self-rating | ≥ 4/5 | Self-survey |
| **30-day Note ergonomic rating** | **≥ 4.5/5** | Self-survey |

## Scope, Phases & Roadmap

### MVP Strategy & Philosophy

**MVP Approach: Problem-Solving MVP** — không phải "experience MVP" hay "revenue MVP". Mục tiêu cốt lõi: **lấp khoảng trống 12 tiêu chí** mà thị trường để lại (xem feature matrix trong [market research](research/market-personal-knowledge-base-reading-app-research-2026-04-25.md)).

- **Definition of "useful"**: Thuat dùng app này thay thế Readwise + Notion + Obsidian + BookFusion cho 80% workflow đọc-học hàng ngày trong 30 ngày liên tục.
- **Definition of "potential"**: Sau 3 tháng, có thể mời 5 đồng nghiệp/bạn học vào dùng mà không cần migration đau (Phase 2+ readiness).
- **Fastest path to validated learning**: 3 phases × 2-3 tuần, mỗi phase có "demo trên 3 thiết bị thật" làm gate kiểm chứng.

**Resource Requirements**:

- **Team size**: 1 (Thuat) + Claude Code (AI pair-programmer)
- **Skills cần**: PM thinking + ability to read/test code (không cần viết code)
- **Time commitment**: ước tính 10–15 giờ/tuần × 8 tuần = 80–120 giờ tổng
- **Budget**: $0/tháng vận hành; chi phí Claude Code subscription do user tự quản lý

### MVP — Minimum Viable Product (8 tuần)

**Phase 1 — Core Reading (tuần 1–3)**

- Auth (email + Google qua Clerk)
- Upload đa định dạng (PDF, EPUB, DOCX, PPTX, ảnh, audio, video, MD), drag-drop hoặc nút
- Viewer cho từng định dạng (PDF.js, epubjs, mammoth, react-pptx, react-image-gallery, Plyr, Wavesurfer, react-markdown)
- `reading_progress` lưu mỗi 5s + on close/blur, resume khi mở lại
- Folder + tag cơ bản

**Phase 2 — Multi-tab & Note (tuần 4–5)**

- Tab bar dạng trình duyệt, mở ≤ 10 tab cùng lúc, tab list đồng bộ realtime cross-device
- Highlight inline với menu nổi 1-click + phím tắt `Ctrl/Cmd+N`
- Sticky note inline neo vào highlight
- Note workspace Markdown free-form (KaTeX, mermaid, code highlight, table)
- Bidirectional link `@doc` `@highlight`
- Inline image paste + drag-drop attachment vào note
- Auto-save 1s, offline cache, conflict resolution
- Voice note: cố gắng kịp MVP (transcribe Phase 2+)
- Full-text search (Postgres tsvector hoặc SQLite FTS5) ra cả nội dung file lẫn note
- **Reading Mode core**: toggle phím tắt, theme Sáng/Sepia/Tối, font Serif/Sans/Mono, font size + line-height + column width, paginated/continuous EPUB, progress + ước lượng thời gian còn lại, Esc thoát

**Phase 3 — Polish & Safety (tuần 6–8)**

- PWA manifest + Service Worker (cài qua Safari "Add to Home")
- Offline cache cho 7 ngày gần nhất (IndexedDB)
- Mobile responsive (laptop + iPad + iPhone)
- Export `/export/all` → ZIP MD + JSON + file gốc, mở được trong Obsidian
- Backup tự động weekly lên Google Drive
- Web clip extension (optional, nếu kịp)

### Growth Features (Post-MVP — Phase 2+)

- **Multi-user + Sharing**: invite-by-email, role-based (owner/editor/commenter/viewer), `document_shares` table
- **AI tích hợp**: chat-with-document (Claude API), tóm tắt audio/video qua Whisper, spaced-repetition
- **Voice note transcribe** (Whisper)
- **Web clipper extension** (Chrome/Firefox) nếu MVP bỏ
- **Annotation nâng cao**: PDF freehand, sticky note màu, voice memo
- **Collections / Reading List**: nhóm tài liệu theo chủ đề học
- **Semantic search** qua embedding
- **Sync history & versioning**: undo edit highlight/note
- **Public share link** (read-only URL có expire)
- **Reading Mode advanced**: OpenDyslexic font, dual-page spread (book layout), Focus mode (mờ paragraph khác), TTS đọc to (Web Speech API → Whisper)

### Vision (Future, ≥ 1 năm)

- **Knowledge graph** nội bộ với view 2D/3D
- **Mobile native** (Expo) nếu PWA chạm trần
- **Audio TTS** đọc PDF/EPUB chất lượng cao
- **AI agent học cùng**: đặt câu hỏi kiểm tra sau khi đọc xong
- **Plugin/extension API** cho cộng đồng nếu sau này có người khác dùng
- **Self-host option**: Docker compose cho privacy-first user

### Must-Have vs Nice-to-Have trong MVP

**MUST-HAVE — không có thì sản phẩm không tồn tại**:

- Auth (Convex Auth)
- Upload + viewer cho **8 định dạng**: PDF, EPUB, DOCX, PPTX, ảnh, audio, video, MD/web
- `reading_progress` cho từng định dạng + resume cross-device ≤ 2s
- Multi-tab cross-device sync
- Highlight inline + note pane (Ctrl/Cmd+N)
- Note workspace Markdown free-form với KaTeX/mermaid
- Auto-save 1s
- Full-text search across docs+notes
- Export `/export/all` (data portability ngày 1 — bài học Omnivore/Pocket)
- Reading Mode core (theme/font/typography/pagination/progress)

**NICE-TO-HAVE trong MVP — bỏ được nếu kẹt thời gian** (priority drop list theo thứ tự):

1. Voice note (drop trước nhất; transcribe sang Phase 2+)
2. Web clip extension (defer sang Phase 2+)
3. Advanced PPTX rendering (chấp nhận "đủ đọc được" với react-pptx)
4. Inline image paste vào note (chỉ giữ drag-drop)
5. Conflict resolution UI nâng cao (last-write-wins là đủ cho 1 user MVP)

### Risk Mitigation Strategy

**Technical Risks**:

- **R-T1 — Sync vị trí audio/video không tin cậy**: bắt đầu với PDF + EPUB; thêm audio/video tuần 3. Sai >5% → fallback "vị trí gần đúng + UI kéo lùi 10s".
- **R-T2 — Convex full-text search không đủ tốt**: nếu tệ với >1k tài liệu, fallback Neon Postgres tsvector free 0.5GB hoặc Meilisearch self-host trên Oracle Cloud Always Free.
- **R-T3 — iOS Safari quirks (Service Worker + IndexedDB)**: test sớm trên thiết bị thật từ tuần 3.
- **R-T4 — Cloudflare R2 từ chối thẻ**: backup Backblaze B2 đã có sẵn (~10 dòng code đổi).
- **R-T5 — File >100MB upload thất bại trên mobile**: multipart resumable upload từ Phase 1 (tuần 2).

**Market/Personal Risks** (single-user nên "market" = "personal value"):

- **R-M1 — Build xong nhưng không dùng đều**: "dogfood week" cuối Phase 1 (tuần 3) — Thuat dùng làm reader chính 7 ngày liên tục để phát hiện friction.
- **R-M2 — Phase 2 sharing không thực sự cần**: defer Phase 2 cho đến khi MVP dùng đủ 3 tháng và có 1+ đồng nghiệp/bạn học hỏi xin truy cập.

**Resource Risks**:

- **R-R1 — Hết thời gian khi gặp bug khó**: priority drop list đã định nghĩa (Voice note → Web clip → advanced PPTX bỏ trước nếu cần).
- **R-R2 — Claude Code không hiểu requirement phức tạp**: chia stories nhỏ (mỗi story ≤ 1 ngày work), E2E test sau mỗi feature để bắt regression sớm.
- **R-R3 — Free tier service đột ngột thay đổi**: kiến trúc decoupled 3 dịch vụ, mỗi dịch vụ có backup plan; data layer abstraction để chuyển stack ≤ 1 tuần.

### Scope Confirmation

Tất cả requirements user đã yêu cầu đều **TRONG SCOPE MVP**:

✅ 8 định dạng file (PDF, EPUB, DOCX, PPTX, ảnh, audio, video, MD/web)
✅ Cross-device sync vị trí cho mọi định dạng
✅ Multi-tab dạng trình duyệt
✅ Note thuận lợi (highlight + sticky + workspace + KaTeX/mermaid)
✅ Reading Mode (đọc sách tập trung)
✅ PWA mobile (Safari Add-to-Home)
✅ $0/tháng vận hành
✅ Schema chuẩn bị multi-user Phase 2+

KHÔNG có item nào bị silently defer.

---

## User Journeys

### Persona 1: Thuat — Người học suốt đời (Primary)

**Bối cảnh**: Thuat làm việc tại GoSmartLog (squad3@gosmartlog.com), thường đọc tài liệu đa định dạng — research paper PDF, sách EPUB, slide PPTX của khoá học, podcast học thuật MP3, video đã tải, ảnh chụp ghi chú whiteboard, bài web blog hay. Thuat dùng laptop ở văn phòng, iPad ở quán cà phê, iPhone trên xe khi commute. Vấn đề hiện tại: mỗi tool chỉ giỏi 1 mảng → mở Notion thì PDF không annotate được, mở Obsidian thì sync hỏng giữa máy, Readwise không upload video, mất 5–10 phút mỗi sáng để nhớ "hôm qua đọc tới đâu".

#### Journey 1.1 — Happy Path: "Học liền mạch trong 1 ngày"

**Opening Scene (07:00, sáng, trên xe đến công ty)** — iPhone trong tay, mở app Web Knowledge Base từ home screen (đã cài qua Safari "Add to Home"). Tab list xuất hiện ngay: 3 tab đang mở từ tối hôm trước — paper "Distributed Systems", podcast "Lex Fridman #410", chương 5 sách "Designing Data-Intensive Applications". Chọn tab podcast, app load đúng phút **47:23** đã nghe dở. Cảm xúc: "*tự nhiên như đeo headphone tiếp tục*."

**Rising Action (09:30, văn phòng, laptop)** — Mở Chrome, vào URL app, đăng nhập 1 click qua Google (Clerk session vẫn còn). Tab list đồng bộ — podcast đã pause, paper "Distributed Systems" mở ngay tại trang **17, dòng đầu của section 3.2**. Đọc tiếp, bôi đen 1 đoạn quan trọng → menu nổi xuất hiện → bấm "Note" → pane note bên cạnh mở ra → gõ Markdown "*Quorum đọc-ghi không đảm bảo linearizability nếu có timing skew*", auto-save sau 1s. Tag note với `#distributed-systems`. Cảm xúc: "*viết note dễ hơn cả Notion*."

**Climax (14:00, cuộc họp giãn ra, iPad)** — Thuat mở iPad, cần xem lại slide PPTX "Architecture Review" của đồng nghiệp gửi 2 ngày trước. Tab list trên iPad có sẵn slide ấy, mở ra ngay slide **12/45** đang xem dở. Slide hiển thị tốt, có thể phóng to text. Đột nhiên nhớ ra cần đối chiếu với note đã viết sáng — gõ search "quorum" → kết quả ra cả note Markdown vừa gõ + đoạn highlight gốc trong PDF + 1 đoạn trong sách EPUB. Mở note → mention `@paper-distributed-systems` → link 2 chiều tự động. Cảm xúc: "*tri thức đang xếp lại với nhau.*"

**Resolution (22:00, ở nhà, laptop)** — Mở note workspace free-form, viết bài tổng hợp "What I Learned About Quorum This Week" — kéo các highlight + note đã neo thành paragraph. KaTeX render công thức N+W+R, mermaid vẽ sơ đồ. Đóng laptop, biết rằng sáng mai mở iPhone tab list sẽ y nguyên. Cảm xúc: "*đây là trạng thái học tập tôi luôn muốn có.*"

**Capabilities revealed**: PWA install · Auth + session persistence · Tab sync realtime cross-device · Resume position cho audio (timestamp), PDF (page+offset), EPUB (CFI), PPTX (slide index) · Highlight inline với menu nổi · Note pane bên cạnh viewer · Note Markdown với KaTeX/mermaid · Auto-save · Tag · Full-text search across docs+notes · Bidirectional link `@doc` · Note workspace free-form.

#### Journey 1.2 — Edge Case: "Internet chập chờn ở quán cà phê"

**Opening (10:00, quán cà phê, iPad, WiFi yếu)** — Mở app, Service Worker đã cache 7 ngày tài liệu gần nhất → load tab list từ IndexedDB ngay cả khi offline. Mở paper PDF đang đọc dở — file đã cache, đọc bình thường.

**Rising Action** — Bôi đen 1 đoạn, gõ note dài. Note auto-save vào IndexedDB local. UI hiển thị badge nhỏ "3 thay đổi chưa sync" góc trên phải.

**Climax** — WiFi chập chờn lại 1 lúc → app tự sync background (queue worker). Trong lúc ấy, ở văn phòng, Thuat đang sửa cùng 1 note trên laptop → khi cả 2 online, conflict resolution kích hoạt: hệ thống dùng last-write-wins cho field đơn giản (text), nhưng giữ cả 2 phiên bản trong "Sync Conflicts" panel để Thuat duyệt thủ công nếu khác biệt lớn (>20 ký tự).

**Resolution** — Thuat mở "Sync Conflicts", chọn version đúng, merge xong. Note trở lại sạch sẽ trên cả 3 máy. Cảm xúc: "*offline không khiến tôi sợ nữa.*"

**Capabilities revealed**: Service Worker offline cache · IndexedDB queue cho mutation offline · Background sync worker · Last-write-wins + conflict log UI · Status badge số thay đổi pending.

#### Journey 1.3 — Edge Case: "Upload video 1.2GB"

**Opening (cuối tuần, laptop)** — Thuat tải về 1 video khoá học 1.2GB, kéo-thả vào app. UI hiện progress bar chia nhỏ chunk → multipart upload lên Cloudflare R2 (chunk 100MB). Thuat đóng tab giữa chừng → upload tự resume khi mở lại nhờ `upload_sessions` table.

**Resolution** — Sau 6 phút, video xuất hiện trong library, mở Plyr viewer, watch ở 1080p, sync timestamp đọc dở khi đổi máy. Cảm xúc: "*Readwise không cho upload thế này.*"

**Capabilities revealed**: Multipart resumable upload · Progress UI · Plyr video viewer · Timestamp-based reading_progress cho video.

### Persona 2: Linh — Đồng nghiệp được mời share (Phase 2+)

**Bối cảnh**: Linh là đồng nghiệp của Thuat tại GoSmartLog. Thuat muốn chia sẻ với Linh 1 paper + slide nội bộ về kiến trúc hệ thống mới. Linh không muốn cài thêm app phức tạp.

#### Journey 2.1 — Invited to Read

**Opening** — Linh nhận email "Thuat shared 'Architecture Review v2' with you". Click link → landing page Web Knowledge Base, 1 click đăng ký bằng Google.

**Rising Action** — Vào dashboard, tab "Shared with me" hiển thị tài liệu Thuat share. Mở ra, đọc PDF, có thể highlight (role = `commenter`), thêm comment bên lề. Comment xuất hiện realtime cho Thuat ở phía bên kia.

**Climax** — Linh gõ thắc mắc trong note: "*Phần 3.2 mình thấy không match với current arch — Thuat check giùm?*" Thuat (đang mở app trên laptop) thấy notification, click vào → load đúng vị trí Linh đang chỉ tới.

**Resolution** — Hai người cùng review tài liệu, bỏ qua việc gửi bản PDF mới mỗi lần edit. Cảm xúc Linh: "*nhẹ hơn Google Docs vì có cả PDF gốc.*"

**Capabilities revealed (Phase 2+)**: `document_shares(doc_id, shared_with_user_id, role)` · Email invite flow · Role-based UI gating (viewer/commenter/editor/owner) · Realtime comment sync · Notification system · "Shared with me" view.

### Journey Requirements Summary

**Authentication & Session**
- Email + Google OAuth qua Clerk hoặc Supabase Auth
- Session persistence 30 ngày, MFA optional

**File Management**
- Multi-format upload (8+ định dạng) drag-drop
- Multipart resumable upload (file ≤ 5GB)
- Upload session table để resume

**Viewer Stack**
- PDF.js (PDF), epubjs/react-reader (EPUB), mammoth (DOCX→HTML), react-pptx (PPTX), react-image-gallery (ảnh), Plyr (video), Wavesurfer (audio), react-markdown + KaTeX + mermaid (MD), Mozilla Readability (web clip)

**Reading Progress Sync**
- Lưu mỗi 5s + on close/blur
- Position types: `pdf_page` · `epub_cfi` · `time_seconds` · `scroll_pct` · `slide_index`
- Resume ≤ 2s khi mở lại

**Multi-tab**
- Tab list state (≤ 10 tab) đồng bộ realtime cross-device
- Tab order, scroll state, last-active timestamp

**Highlight & Note**
- Floating menu khi select text
- Sticky note inline neo vào highlight
- Note workspace Markdown free-form (KaTeX, mermaid, code, table, image paste)
- Bidirectional link `@doc` `@highlight`
- Auto-save 1s
- Voice note (mic → MP3 → đính kèm highlight)

**Search**
- Full-text search ra cả file content + note (Postgres tsvector hoặc SQLite FTS5)
- Filter by tag, doc, date

**Offline & PWA**
- Service Worker cache 7 ngày tài liệu gần nhất
- IndexedDB queue cho mutation offline
- Background sync worker
- Conflict resolution (LWW + manual review UI)

**Data Safety**
- Export `/export/all` → ZIP MD + JSON + file gốc
- Weekly backup → Google Drive (Cloudflare Worker cron)

**Sharing (Phase 2+)**
- `document_shares(doc_id, user_id, role)` với roles: owner/editor/commenter/viewer
- Email invite + landing page onboarding
- "Shared with me" view
- Realtime comment + notification

---

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **Unified Position Sync Across Heterogeneous Formats** — Phần lớn reader chỉ sync vị trí cho 1 loại format (Apple Books/Kindle: ebook; Plyr: video; Readwise: web/PDF). Sản phẩm này hợp nhất qua 1 schema `reading_progress(position_type, position_value)` với 5+ position_type cùng tồn tại — cho phép resume xuyên định dạng trong cùng UX.

2. **Multi-tab Cross-Device State** — Trình duyệt có tab nhưng không sync giữa thiết bị (Chrome Sync chỉ sync URL, không scroll state, không "active tab"). Sản phẩm này lưu `tabs(id, doc_id, scroll_state, order, last_active_at)` realtime cross-device — closer tới UX "cloud workspace" hơn là "tài liệu rời".

3. **Note-First Reading Workflow** — Hầu hết reader xem note là tính năng phụ. Sản phẩm này coi note là first-class: highlight → 1 click → caret trong note pane ≤ 1.5s; bidirectional link `@doc` `@highlight`; note search full-text ngang với doc search. Lấy cảm hứng từ Roam/Logseq nhưng áp dụng vào reading-app.

4. **Self-Buildable trên Free-Tier Stack ($0/tháng)** — Innovation về **business model + delivery**: chứng minh non-coder dùng Claude Code có thể build sản phẩm ngang Readwise ($14/m) với chi phí vận hành $0. "Indie hacker pattern 2026" áp dụng vào PKM.

### Market Context & Competitive Landscape

Tham chiếu đầy đủ trong [tài liệu market research](research/market-personal-knowledge-base-reading-app-research-2026-04-25.md):

- Sau Omnivore (11/2024) và Pocket-35M-user (07/2025) shutdown, thị trường đã thay đổi tiêu chí — **data portability + sustainability** trở thành critical.
- Karakeep (OSS, 24.300+ stars), Recall (AI-native), Heptabase (visual) đang nổi nhưng vẫn không cover full multi-format.
- Cơ hội: lấp khoảng trống "12 tiêu chí" với sản phẩm cá nhân, tránh cạnh tranh thị trường.

### Validation Approach

- **V1 — Build & Use** (8 tuần MVP): tự dùng đủ 30 ngày, đo 12 KPI đã xác định ở Success Criteria. Hit cả "Resume ≤ 2s" + "Note ergonomic ≥ 4.5/5" + retention ≥ 5 ngày/tuần → validated.
- **V2 — Beta nhỏ Phase 2+** (sau 3 tháng): mời 5 đồng nghiệp/bạn học, interview 30 phút + NPS + retention.
- **V3 — Tech proof xuyên suốt**: mỗi sprint demo trên 3 thiết bị thật, không emulator.

### Innovation Risk Mitigation

- **R1: Sync vị trí không tin cậy như Apple Books/Kindle**. Mitigation: bắt đầu PDF + EPUB (chuẩn CFI/page có sẵn); audio/video sau. Nếu sai >5% → rollback "vị trí gần đúng" + UI kéo lùi 10s/1 trang.
- **R2: Multi-tab UX rối khi >5 tab trên mobile**. Mitigation: giới hạn 10 tab, gesture vuốt ngang switch tab; iPad/iPhone hiển thị tab dropdown thay vì tab bar ngang.
- **R3: Note workflow không vượt Obsidian/Heptabase**. Mitigation: focus "note + nguồn ở cùng 1 chỗ" (USP); chấp nhận note workspace đơn giản hơn (không graph view ở MVP) — graph view post-MVP.
- **R4: Free-tier stack ($0) không đủ chạy thật**. Mitigation: kiến trúc decoupled với chỉ 3 dịch vụ free-forever; backup plan B2 nếu R2 từ chối thẻ; benchmark 100 tài liệu thật trong 4 tuần đầu.

---

## Web App + PWA — Technical Requirements

### Project-Type Overview

Sản phẩm là **Single-Page App (SPA) full-stack** chạy trong trình duyệt hiện đại, có khả năng cài đặt làm PWA trên iOS/iPadOS qua Safari "Add to Home Screen" và trên Android/Desktop qua install banner. Backend là **Backend-as-a-Service (BaaS)** managed để giữ chi phí $0 tuyệt đối và giảm code phải viết.

### Stack Decision (chốt cho MVP)

**Triết lý**: tối thiểu hoá số dịch vụ phụ thuộc — chỉ **3 dịch vụ chính** đều ở free-tier vĩnh viễn, không yêu cầu credit card (hoặc có backup nếu cần).

| Layer | Lựa chọn | Free vĩnh viễn | Cần thẻ? |
|---|---|---|---|
| **Hosting (frontend + Workers)** | **Cloudflare Pages** | ✅ Unlimited bandwidth, 500 builds/m, cho commercial | ❌ |
| **Backend all-in-one** (DB + Realtime + Auth + Functions + Cron + Search) | **Convex** | ✅ 1M function calls/m, 20 GB-h compute, 0.5GB DB, 1GB file, **không pause sau 7 ngày** | ❌ |
| **File Storage lớn** (video/audio > 1GB) | **Cloudflare R2** | ✅ 10GB + **0$ egress** | ⚠️ có thể yêu cầu xác minh thẻ |

**Backup plan nếu R2 từ chối thẻ**: **Backblaze B2** (10GB free, S3-compatible, ~10 dòng code đổi).

**Bị loại** (đã verify):

- **Vercel Hobby** — cấm commercial → buộc Pro $20/m
- **Supabase free** — pause DB sau 7 ngày inactive (bất tiện cho personal use)
- **Firebase Spark** — pricing rối, vendor lock-in nặng, dễ vượt quota với power user
- **Netlify Starter** — đã cắt build minutes 300→100 năm 2025 (signal đáng lo về free-tier sustainability)

**Đã loại bỏ khỏi stack ban đầu để giảm dependency**:

- ❌ **Clerk** → dùng **Convex Auth built-in** (email + Google + GitHub OAuth)
- ❌ **PostHog** → bảng `telemetry_events` trong Convex (custom dashboard)
- ❌ **Sentry** → `console.error` + bảng `error_logs` trong Convex

### Frontend & Tooling

| Layer | Lựa chọn | Lý do |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | Claude Code thạo nhất; deploy CF Pages dễ qua adapter |
| UI | **Tailwind CSS + shadcn/ui** | Component có sẵn, mobile-first dễ |
| State client | **Zustand** + **TanStack Query** + **Convex React hooks** | Reactive query Convex thay phần lớn TanStack Query cho data sync |
| Viewer libraries | PDF.js, epubjs/react-reader, mammoth, react-pptx, react-image-gallery, Plyr, Wavesurfer.js, react-markdown + KaTeX + mermaid, Mozilla Readability | Tất cả OSS, miễn phí |
| Test | Vitest (unit), Playwright (E2E critical path) | Free, chạy local |

### Email (Phase 2+ — chỉ khi share)

- **Resend free** — 3.000 emails/tháng, 100/ngày, không cần thẻ. Đợi đến Phase 2 mới đăng ký.

### Platform Requirements

**Browser support (MVP)**:

- Chrome/Edge ≥ 110
- Safari ≥ 16.4 (iOS 16.4+, macOS Ventura+) — vì PWA Add-to-Home & Service Worker đầy đủ chỉ ổn từ 16.4
- Firefox ≥ 110 (desktop only)
- Hiển thị thông báo "Trình duyệt quá cũ" nếu dưới mức trên

**Device targets**:

- **Laptop**: macOS 12+, Windows 10+, Linux (browser hiện đại)
- **iPad**: iPadOS 16.4+ (cài qua Safari "Add to Home")
- **iPhone**: iOS 16.4+ (cài qua Safari "Add to Home")
- **Android**: Android 10+ (Chrome → "Install app")

**Screen sizes**: Mobile 375–430px · Tablet 768–1024px · Desktop 1280–1920px+

### PWA Requirements

- **Manifest**: `manifest.webmanifest` với name, icons (192/512), `display: standalone`
- **Service Worker**: register `/sw.js`, dùng Workbox
  - **Cache strategy**: `CacheFirst` cho static assets, `NetworkFirst` cho API, `StaleWhileRevalidate` cho file đã download
  - **Pre-cache**: app shell (HTML, CSS, JS bundle, icons)
  - **Runtime cache**: tài liệu user đã mở trong 7 ngày gần nhất, max 500MB total
- **iOS quirks**:
  - Service Worker storage có thể hết khi user xoá Safari history → backup IndexedDB ra Convex thường xuyên
  - Không có Background Sync API trên iOS Safari → polling khi app mở lại
  - Push Notification chỉ iOS 16.4+ và yêu cầu user "Add to Home" trước
- **Install prompt**: hiển thị banner "Cài lên home" khi user vào lần thứ 3, không chặn UX

### Architecture Pattern (đơn giản hoá còn 3 dịch vụ)

```
┌─────────────────────────────────────────────────┐
│  Browser / PWA                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Next.js App Router (RSC + Client)        │   │
│  │  ├─ Routes: /, /library, /reader/[id],   │   │
│  │  │   /notes, /settings                   │   │
│  │  ├─ State: Zustand (UI), Convex hooks    │   │
│  │  └─ Service Worker + IndexedDB cache     │   │
│  └──────────────────────────────────────────┘   │
│           Hosted on Cloudflare Pages            │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────▼───────────────────────┐
              │ Convex (all-in-one)           │
              │  ├─ Auth (email+OAuth)        │
              │  ├─ Tables + reactive queries │
              │  ├─ Mutations                 │
              │  ├─ Actions (HTTP/external)   │
              │  ├─ Scheduled jobs (cron)     │
              │  ├─ Full-text search          │
              │  └─ telemetry_events table    │
              └───────┬───────────────────────┘
                      │ presigned URL
              ┌───────▼───────────────────────┐
              │ Cloudflare R2                 │
              │ (file storage, 0$ egress)     │
              └───────────────────────────────┘
```

### Data Layer & Schema (Convex sơ lược, chi tiết ở Architecture doc)

```ts
defineSchema({
  users: defineTable({ email: v.string(), createdAt: v.number() }).index("by_email", ["email"]),
  documents: defineTable({
    userId: v.id("users"),
    title: v.string(),
    format: v.union(v.literal("pdf"), v.literal("epub"), v.literal("docx"), v.literal("pptx"), v.literal("image"), v.literal("audio"), v.literal("video"), v.literal("markdown"), v.literal("web")),
    storageBackend: v.union(v.literal("convex"), v.literal("r2"), v.literal("b2")),
    storageKey: v.string(),
    size: v.number(),
    uploadedAt: v.number(),
    tags: v.array(v.string()),
  }).index("by_user", ["userId"]).searchIndex("search_title", { searchField: "title" }),
  reading_progress: defineTable({
    userId: v.id("users"), docId: v.id("documents"),
    positionType: v.union(v.literal("pdf_page"), v.literal("epub_cfi"), v.literal("time_seconds"), v.literal("scroll_pct"), v.literal("slide_index")),
    positionValue: v.string(), deviceId: v.string(), updatedAt: v.number(),
  }).index("by_user_doc", ["userId", "docId"]),
  highlights: defineTable({ userId: v.id("users"), docId: v.id("documents"), anchor: v.string(), color: v.string(), text: v.string(), createdAt: v.number() }).index("by_user_doc", ["userId", "docId"]),
  notes: defineTable({ userId: v.id("users"), parentDocId: v.optional(v.id("documents")), parentHighlightId: v.optional(v.id("highlights")), bodyMd: v.string(), updatedAt: v.number() }).index("by_user", ["userId"]).searchIndex("search_body", { searchField: "bodyMd" }),
  tabs: defineTable({ userId: v.id("users"), docId: v.id("documents"), scrollState: v.string(), order: v.number(), lastActiveAt: v.number() }).index("by_user", ["userId"]),
  telemetry_events: defineTable({ userId: v.id("users"), eventType: v.string(), latencyMs: v.optional(v.number()), deviceId: v.string(), ts: v.number(), meta: v.optional(v.any()) }).index("by_event_ts", ["eventType", "ts"]),
  error_logs: defineTable({ userId: v.optional(v.id("users")), level: v.string(), message: v.string(), stack: v.optional(v.string()), ts: v.number() }).index("by_ts", ["ts"]),
  // Phase 2+ (schema sẵn)
  document_shares: defineTable({
    docId: v.id("documents"), sharedWithUserId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("commenter"), v.literal("viewer")),
    invitedAt: v.number(),
  }).index("by_doc", ["docId"]).index("by_user", ["sharedWithUserId"]),
})
```

### Storage Routing Strategy

- **File ≤ 5 MB** (PDF nhỏ, DOCX, ảnh, MD): lưu trực tiếp Convex file storage (1GB free)
- **File > 5 MB** (audio, video, PDF dày, EPUB lớn): lưu Cloudflare R2 (10GB free, 0$ egress) qua presigned URL
- **Bảng `documents.storageBackend`** track nơi lưu để code đọc tự routing đúng nguồn

### Implementation Considerations

**Performance**:
- Code splitting theo route (Next.js tự lo)
- Lazy load viewer libraries — chỉ tải khi mở doc tương ứng
- Image optimization qua `next/image` + Cloudflare CDN
- Bundle size target: < 200KB gzipped initial

**Security**:
- Auth qua Convex Auth (JWT), mọi mutation Convex check `ctx.auth.getUserIdentity()`
- File access: R2 presigned URL có expire (15 phút) — không expose public URL
- CSP header strict (only `self` + Convex + R2 domains)
- UI throttle cho upload (max 5 file song song)

**Accessibility**:
- WCAG AA tối thiểu: contrast ≥ 4.5:1, keyboard nav full, ARIA labels cho viewer controls
- Reader mode: dyslexia-friendly font option (OpenDyslexic) ở Phase 2+

**Observability ($0)**:
- Telemetry: lưu `telemetry_events` table trong Convex; tạo 1 trang `/admin/telemetry` query reactive ra dashboard custom
- Error tracking: try-catch global → log vào `error_logs` table; xem trong Convex dashboard hoặc custom UI

**DX cho Claude Code**:
- Monorepo: `apps/web` (Next.js) + `convex/` (functions + schema)
- TypeScript strict mode
- Tailwind config chuẩn shadcn
- Pre-commit: prettier + eslint
- Test: Vitest (unit) + Playwright (E2E critical path)

---

## Functional Requirements

> **Capability Contract**: Đây là danh sách binding các capability mà sản phẩm sẽ có. Bất kỳ feature nào không liệt kê ở đây sẽ KHÔNG tồn tại trong sản phẩm trừ khi được thêm vào danh sách này. Mỗi FR đều là capability test được, không nói cách triển khai.

### 1. User Management & Authentication

- **FR1**: User có thể đăng ký tài khoản bằng email + mật khẩu hoặc Google OAuth.
- **FR2**: User có thể đăng nhập từ nhiều thiết bị cùng một tài khoản, session tự động gia hạn.
- **FR3**: User có thể đăng xuất từ một thiết bị mà không ảnh hưởng session trên thiết bị khác.
- **FR4**: User có thể bật MFA cho tài khoản (optional ở MVP).
- **FR5**: User có thể yêu cầu đặt lại mật khẩu qua email.

### 2. Content Library Management

- **FR6**: User có thể upload tài liệu định dạng PDF, EPUB, DOCX, PPTX, JPG/PNG/WEBP, MP3/M4A/WAV, MP4/WEBM, Markdown, hoặc lưu URL web clip.
- **FR7**: User có thể upload nhiều tài liệu đồng thời bằng kéo-thả hoặc nút chọn file.
- **FR8**: User có thể xem danh sách tất cả tài liệu đã upload với tiêu đề, định dạng, dung lượng, ngày upload.
- **FR9**: User có thể đổi tên, xoá vĩnh viễn, hoặc khôi phục tài liệu (thùng rác giữ 30 ngày).
- **FR10**: User có thể gán tag tự do và folder cho tài liệu; một tài liệu có nhiều tag.
- **FR11**: User có thể lọc danh sách tài liệu theo tag, folder, định dạng, hoặc khoảng ngày.

### 3. Document Reading (Multi-Format Viewers)

- **FR12**: User có thể mở tài liệu PDF và đọc với các thao tác cơ bản (zoom, page navigation, text selection).
- **FR13**: User có thể mở tài liệu EPUB và đọc với tuỳ chỉnh font size, theme sáng/tối, line height.
- **FR14**: User có thể mở tài liệu DOCX và đọc nội dung chính (text + ảnh + bảng) hiển thị inline.
- **FR15**: User có thể mở tài liệu PPTX và xem từng slide với navigation prev/next, fullscreen.
- **FR16**: User có thể xem ảnh với zoom, pan, và xem theo gallery nếu có nhiều ảnh.
- **FR17**: User có thể nghe audio với play/pause, seek, tốc độ phát 0.5x–2x, hiển thị waveform.
- **FR18**: User có thể xem video với play/pause, seek, tốc độ phát 0.5x–2x, fullscreen.
- **FR19**: User có thể đọc Markdown với render đầy đủ (heading, list, code highlight, table, KaTeX, mermaid) và áp dụng được Reading Mode typography (xem mục 13).
- **FR20**: User có thể xem web clip dưới dạng "reader view" sạch (Mozilla Readability) hoặc HTML gốc.

### 4. Reading Progress & Resume

- **FR21**: System tự động lưu vị trí đọc của user mỗi 5 giây và khi đóng tab/đổi tab.
- **FR22**: System lưu vị trí đọc theo loại định dạng (page+offset cho PDF, CFI cho EPUB, timestamp cho audio/video, scroll % cho web/MD, slide index cho PPTX).
- **FR23**: User mở lại tài liệu trên cùng hoặc khác thiết bị → System tự động khôi phục đúng vị trí đọc cuối cùng.
- **FR24**: User có thể xem lịch sử đọc gần đây của một tài liệu (≥ 10 entries gần nhất).

### 5. Multi-Tab Workspace

- **FR25**: User có thể mở đồng thời nhiều tài liệu dưới dạng tab (giới hạn 10 tab/user).
- **FR26**: User có thể đóng tab, sắp xếp lại thứ tự tab bằng drag-drop, switch nhanh giữa các tab.
- **FR27**: System đồng bộ danh sách tab + tab đang active + scroll state qua mọi thiết bị của user trong thời gian thực.
- **FR28**: User có thể "đóng tất cả tab" hoặc "mở lại tab vừa đóng" trong cùng phiên.

### 6. Highlighting & Annotation

- **FR29**: User có thể bôi đen text trong PDF/EPUB/DOCX/MD/web để tạo highlight với menu nổi xuất hiện ngay.
- **FR30**: User có thể chọn màu highlight (≥ 4 màu), thêm note ngắn vào highlight bằng 1 click hoặc phím tắt `Ctrl/Cmd+N`.
- **FR31**: User có thể xem danh sách tất cả highlight của một tài liệu, click để jump tới vị trí gốc.
- **FR32**: User có thể xoá hoặc chỉnh sửa highlight đã tạo.
- **FR33**: User có thể thêm timestamp marker (audio/video) hoặc page bookmark (PDF/EPUB) như một dạng highlight.

### 7. Note Workspace

- **FR34**: User có thể viết note Markdown free-form trong workspace riêng (ngoài tài liệu) với hỗ trợ heading, list, code, table, KaTeX, mermaid, paste image inline, drag-drop file đính kèm.
- **FR35**: User có thể tạo bidirectional link giữa note và tài liệu/highlight bằng mention `@doc-title` hoặc `@highlight-id`; link hiển thị 2 chiều.
- **FR36**: User có thể xem "sticky note" inline neo vào highlight ngay khi đọc tài liệu, không cần rời viewer.
- **FR37**: System tự động lưu note ≤ 1 giây sau khi user ngừng gõ.
- **FR38**: User có thể tag, sắp xếp, tìm note theo tag/ngày/tài liệu nguồn.
- **FR39**: User có thể ghi voice note bằng mic và đính kèm vào highlight (transcribe ở Phase 2+).

### 8. Search & Discovery

- **FR40**: User có thể tìm kiếm full-text trên tiêu đề tài liệu, nội dung tài liệu (PDF/EPUB/DOCX/MD/web), và nội dung note.
- **FR41**: System trả kết quả tìm kiếm có grouping theo loại (doc/highlight/note) và highlight đoạn match.
- **FR42**: User có thể lọc kết quả search theo tag, định dạng, ngày, hoặc tài liệu nguồn.
- **FR43**: User có thể click kết quả search để jump tới đúng vị trí xuất hiện trong tài liệu.

### 9. Offline & PWA

- **FR44**: User có thể cài app vào màn hình chính trên iOS/iPadOS qua Safari "Add to Home" và trên Android/Desktop qua install banner.
- **FR45**: User có thể đọc lại các tài liệu đã mở trong 7 ngày gần nhất khi không có mạng.
- **FR46**: User có thể tạo highlight, note, đổi tag khi offline; thay đổi được queue local và auto-sync khi online lại.
- **FR47**: System hiển thị badge số thay đổi pending sync, và panel "Sync Conflicts" khi có xung đột không tự giải quyết được.

### 10. Data Portability & Backup

- **FR48**: User có thể export toàn bộ dữ liệu (tài liệu, highlight, note, tag, reading_progress) ra file ZIP chứa Markdown + JSON + file gốc bất kỳ lúc nào.
- **FR49**: User có thể export một tài liệu đơn lẻ (file gốc + highlight + note Markdown đính kèm).
- **FR50**: System tự động backup snapshot toàn bộ dữ liệu user lên Google Drive của chính user mỗi tuần, giữ ≥ 4 bản gần nhất.
- **FR51**: User có thể yêu cầu xoá vĩnh viễn tài khoản và toàn bộ dữ liệu (bao gồm file trên storage).

### 11. Telemetry & Self-Observability

- **FR52**: System ghi nhận event telemetry (resume_position_loaded, tabs_synced, note_save, search_query, latency) vào DB của chính user, không gửi ra dịch vụ ngoài.
- **FR53**: User có thể xem dashboard telemetry cá nhân (latency p50/p95, retention, số ngày active, số tài liệu đọc) trên trang `/admin/telemetry`.
- **FR54**: System ghi error log vào bảng `error_logs`, hiển thị trên trang admin để Thuat tự debug.

### 12. Sharing & Collaboration (Phase 2+, schema sẵn ở MVP)

- **FR55** (Phase 2+): User có thể mời người khác đọc/comment/edit một tài liệu cụ thể qua email.
- **FR56** (Phase 2+): User được mời nhận role (viewer/commenter/editor) và chỉ thực hiện đúng quyền được cấp.
- **FR57** (Phase 2+): User có thể xem tab "Shared with me" liệt kê tài liệu được người khác share.
- **FR58** (Phase 2+): User có thể thêm comment trên highlight của người khác (nếu role ≥ commenter); comment sync realtime.
- **FR59** (Phase 2+): User có thể thu hồi quyền share hoặc xoá người khỏi tài liệu.

### 13. Reading Mode (Đọc sách tập trung)

**MVP (Phase 2 — tuần 4–5):**

- **FR60**: User có thể bật **Reading Mode** cho tài liệu PDF / EPUB / DOCX / MD / web bằng phím tắt (`F` hoặc `Cmd+Shift+R`) hoặc nút trong viewer toolbar — ẩn tab bar, sidebar, header, hiển thị nội dung fullscreen với typography tối ưu.
- **FR61**: User có thể chọn theme đọc: **Sáng** (nền trắng), **Sepia** (nền vàng nâu cho mắt), **Tối** (nền đen). Theme nhớ riêng cho từng định dạng.
- **FR62**: User có thể tuỳ chỉnh font (Serif / Sans-serif / Mono), font size (12–28px), line-height (1.4–2.0), độ rộng cột text (narrow / medium / wide).
- **FR63**: User có thể chọn cách trình bày EPUB: **continuous scroll** (cuộn dọc) hoặc **paginated** (lật trang) với phím tắt `←/→` / vuốt ngang trên mobile.
- **FR65**: System hiển thị progress bar + ước lượng "Còn ~X phút đọc" dựa trên tốc độ đọc trung bình của user (đo qua telemetry).
- **FR67**: User có thể thoát Reading Mode bằng phím `Esc` hoặc nút X góc trên — về lại UI tab/multi-doc.

**Phase 2+ (Post-MVP):**

- **FR62b** (Phase 2+): Thêm tuỳ chọn font **OpenDyslexic** cho user dyslexia.
- **FR64** (Phase 2+): User có thể bật chế độ **dual-page spread** cho EPUB/PDF trên desktop/tablet (≥ 768px) — hiển thị 2 trang cạnh nhau như sách giấy.
- **FR66** (Phase 2+): User có thể bật **Focus mode** — chỉ paragraph hiện tại sáng rõ, các paragraph khác mờ đi (giảm phân tán).
- **FR68** (Phase 2+): User có thể bật **TTS đọc to** với chọn giọng/tốc độ, đồng bộ scroll với câu đang đọc (dùng Web Speech API browser ở MVP, Whisper TTS chất lượng cao ở Phase 3+).

---

## Non-Functional Requirements

### Performance

- **NFR1**: Resume vị trí đọc khi mở lại tài liệu (cùng/khác thiết bị) hoàn tất trong **≤ 2 giây** ở 95% trường hợp với mạng ổn định ≥ 5 Mbps.
- **NFR2**: Tab list đồng bộ giữa các thiết bị trong **≤ 3 giây** ở 95% trường hợp.
- **NFR3**: Tải tài liệu trung bình **≤ 2 giây** với file ≤ 50 MB; **≤ 5 giây** với file ≤ 500 MB.
- **NFR4**: Highlight → caret xuất hiện trong note input trong **≤ 1.5 giây**.
- **NFR5**: Note auto-save **≤ 1 giây** từ khi user ngừng gõ.
- **NFR6**: Full-text search trả kết quả **≤ 1 giây** với thư viện ≤ 500 tài liệu; **≤ 500 ms** với ≤ 5.000 note.
- **NFR7**: Initial bundle size khi load app lần đầu **< 200 KB gzipped**; lazy-load viewer libraries khi cần.
- **NFR8**: First Contentful Paint **≤ 1.5 giây** trên kết nối 4G mid-tier (Lighthouse mobile profile).

### Security & Privacy

- **NFR9**: Toàn bộ traffic dùng HTTPS/TLS 1.3+; không endpoint nào nhận traffic HTTP.
- **NFR10**: Tài liệu user mặc định **private**, mã hoá at rest tại provider storage (Convex, R2 đều mặc định AES-256).
- **NFR11**: File access chỉ qua **presigned URL có expire ≤ 15 phút**, không có public URL cố định.
- **NFR12**: Auth dùng provider managed (Convex Auth/Clerk) đã pen-test, **không tự code auth flow**.
- **NFR13**: Telemetry & logs **không gửi ra dịch vụ third-party** — lưu vào DB chính của user; không log content tài liệu.
- **NFR14**: CSP header strict — chỉ cho phép resource từ `self`, Convex domain, R2 domain.
- **NFR15**: Phase 2+: rate limiting **max 100 req/phút/user** cho mutation endpoints để chống abuse khi share.

### Reliability & Data Safety

- **NFR16**: Sync events thành công **≥ 99%** khi cả 2 thiết bị có mạng; queue local cho mutation offline → retry tự động khi online.
- **NFR17**: Conflict resolution: last-write-wins cho field text dưới 20 ký tự khác biệt; field khác biệt lớn hơn lưu cả 2 phiên bản trong panel "Sync Conflicts".
- **NFR18**: Backup tự động **weekly** lên Google Drive; giữ ≥ **4 snapshot gần nhất**.
- **NFR19**: Export `/export/all` thành công với thư viện ≤ 1.000 tài liệu, ≤ 5GB total trong **≤ 2 phút** (download as ZIP).
- **NFR20**: Service Worker offline cache hoạt động cho **100% tài liệu mở trong 7 ngày gần nhất**, max 500 MB total cache.
- **NFR21**: Auth session timeout **30 ngày** trên thiết bị tin cậy; force re-auth nếu inactive 90 ngày.

### Accessibility

- **NFR22**: Đạt **WCAG 2.1 AA** tối thiểu trên các trang chính (library, reader, note workspace, settings).
- **NFR23**: Contrast ratio text/background **≥ 4.5:1** ở tất cả theme (Light/Sepia/Dark).
- **NFR24**: Keyboard navigation đầy đủ — mọi action có thể thực hiện không cần chuột; focus indicator rõ ràng.
- **NFR25**: ARIA labels cho mọi viewer control (play/pause, page nav, highlight buttons).
- **NFR26**: Phase 2+: Reading Mode hỗ trợ font OpenDyslexic; reduced-motion mode tôn trọng `prefers-reduced-motion`.

### Cost

- **NFR27**: Chi phí vận hành tổng cộng (DB + storage + hosting + auth + email + cron + telemetry + error tracking) = **$0/tháng** trong suốt thời gian MVP và Phase 2 với ≤ 5 user.
- **NFR28**: Tất cả dịch vụ thuộc free-tier vĩnh viễn; **không có paid trial tự động chuyển sang paid**.
- **NFR29**: Mỗi dịch vụ trong stack có **backup plan free-tier khác** (R2 → B2; Convex → Supabase/Pocketbase; CF Pages → Netlify) để chuyển nếu free tier thay đổi đột ngột.

### Compatibility & Portability

- **NFR30**: App chạy trên Chrome ≥ 110, Edge ≥ 110, Safari ≥ 16.4 (iOS/iPadOS 16.4+, macOS Ventura+), Firefox ≥ 110 (desktop).
- **NFR31**: Mobile responsive xuyên suốt 375 px → 1920+ px; touch-friendly tap targets **≥ 44×44 px** trên mobile.
- **NFR32**: Data portability: export ra ZIP với Markdown + JSON + file gốc đảm bảo **mở lại được trong Obsidian** mà không mất highlight/note.

### Maintainability & DX

- **NFR33**: TypeScript strict mode bật toàn bộ codebase; không `any` không justified.
- **NFR34**: Test coverage **≥ 60%** cho business logic critical (sync, position, export, auth); E2E test cho 3 critical user paths (login → upload → đọc; highlight → note → save; offline → online sync).
- **NFR35**: Deploy time **≤ 5 phút** từ git push tới production trên Cloudflare Pages.
- **NFR36**: Mỗi feature có thể rollback bằng git revert + redeploy ≤ 10 phút.
- **NFR37**: UI tiếng Việt cho mọi label/button/error message; mã có comment tiếng Anh chuẩn cho code và tiếng Việt cho business logic phức tạp.

---

## Document Status & Next Steps

**Status**: Draft v1 — Ready for Architecture phase. Tất cả 12 capability area + 68 FR + 37 NFR đã thống nhất với Thuat. Stack chốt: **Cloudflare Pages + Convex + Cloudflare R2** ($0/tháng).

**Companion documents**:

- 📊 **Market Research** — [`research/market-personal-knowledge-base-reading-app-research-2026-04-25.md`](research/market-personal-knowledge-base-reading-app-research-2026-04-25.md) (đã xong)
- 🏗 **Architecture Solution Design** — chưa có; đề xuất chạy `/bmad-create-architecture` tiếp theo để có schema chi tiết, API contract, sequence diagram cho Claude Code
- 🎨 **UX Design Spec** — chưa có; tuỳ chọn `/bmad-create-ux-design` nếu muốn wireframe trước khi code
- 📋 **Epics & Stories** — chưa có; sau Architecture chạy `/bmad-create-epics-and-stories` để chia roadmap 8 tuần thành story Claude Code dùng được

**Next-step recommendation cho Thuat**:

1. ✅ Đọc lại PRD này, xác nhận hoặc ghi note "open question" nếu còn vấn đề
2. ▶ Chạy `/bmad-create-architecture` với PRD này làm input → có schema Convex chi tiết, presigned URL flow, sync algorithm, conflict resolution logic
3. ▶ Chạy `/bmad-create-epics-and-stories` với PRD + Architecture → có ~30–50 story nhỏ, mỗi story ≤ 1 ngày work, sẵn sàng cho Claude Code thực thi
4. ▶ Đăng ký account: Cloudflare (Pages + R2 + Workers) + Convex
5. ▶ Tuần 1: kick-off Phase 1 — Auth + Upload + viewer PDF/EPUB

**Open Questions cần làm rõ trước Architecture phase**:

- [ ] Cloudflare R2 có yêu cầu xác minh thẻ tại Việt Nam không? Cần test đăng ký thực tế trước khi commit
- [ ] Voice note: Web Speech API hay MediaRecorder + lưu MP3? (Quyết ở Architecture)
- [ ] Conflict resolution chi tiết cho note Markdown dài (>200 từ) — diff-match-patch hay last-write-wins thuần? (Quyết ở Architecture)
- [ ] Telemetry retention: giữ event bao lâu trước khi xoá? (đề xuất 90 ngày → đủ trend, không phình DB)

---

*PRD này được build qua workflow `bmad-create-prd` (12 steps) — phối hợp giữa Thuat (PM/PO/QA/end-user) và Claude (PM facilitator). Mỗi mục đều có thể trace ngược về user input cụ thể; không có item nào tự sinh hay silently defer.*
