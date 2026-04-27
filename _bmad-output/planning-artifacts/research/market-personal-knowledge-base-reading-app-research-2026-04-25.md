---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'market'
research_topic: 'Personal Knowledge Base & Reading App (multi-format upload, cross-device reading sync, multi-tab, notes) — để tự code lại bằng Claude trên Supabase free tier'
research_goals: 'Khảo sát thị trường để chắt lọc UX/feature tốt nhất, đề xuất tech stack free phù hợp người không code (Claude code hộ), tận dụng Supabase free, tối đa hoá trải nghiệm đọc & học cá nhân'
user_name: 'Thuat'
date: '2026-04-25'
web_research_enabled: true
source_verification: true
---

# Research Report: Market Research

**Date:** 2026-04-25
**Author:** Thuat
**Research Type:** Market Research

---

## Research Overview

Báo cáo này khảo sát thị trường Personal Knowledge Base & Reading App năm 2026 nhằm đề xuất bản thiết kế web app cá nhân cho Thuat — multi-format upload (PDF, EPUB, DOCX, PPTX, ảnh, audio, video, Markdown), cross-device reading-progress sync (laptop + iPad + iPhone), multi-tab dạng trình duyệt, và workspace ghi chú — sẽ do Claude Code triển khai trên hạ tầng free-tier ($0/tháng).

**Phát hiện then chốt**: (1) Sau cú shutdown của Omnivore (11/2024) và Pocket-35M-user (07/2025), người dùng PKM 2026 ưu tiên **data portability + sync tin cậy + sustainable business model**. (2) Không sản phẩm phổ thông nào (Readwise Reader, BookFusion, Notion, Obsidian, Heptabase, Recall, Karakeep, Calibre-Web…) đáp ứng đầy đủ 12 tiêu chí của persona "Multi-format Learner" — đây là **khoảng trống thị trường rõ rệt** mà app cá nhân có thể lấp. (3) Bối cảnh AI-coding 2026 (44% SaaS lợi nhuận do 1 founder, 1/3 indie founder dùng AI cho >70% workflow) cho phép Thuat tự build dù không code.

**Khuyến nghị stack ưu tiên**: **Convex + Cloudflare R2 + Clerk + Cloudflare Pages** ($0/tháng, sync realtime mạnh, R2 zero egress). Phương án thay thế: Supabase / Pocketbase tự host trên Fly.io / Appwrite Cloud. Roadmap MVP **8 tuần** chia 3 phase. Chi tiết ở phần **Strategic Synthesis & Recommendations** ở cuối tài liệu.

---

# Market Research: Personal Knowledge Base & Reading App

## Research Initialization

### Research Understanding Confirmed

**Topic**: Personal Knowledge Base & Reading App với multi-format upload, cross-device reading-progress sync, multi-tab, in-doc notes
**Goals**: Lấy insight thị trường để tự build (qua Claude code) một web app cá nhân — chi phí web = $0, dùng Supabase free DB, có auth.
**Research Type**: Market Research
**Date**: 2026-04-25

### Research Scope

**Market Analysis Focus Areas:**

- Phân khúc sản phẩm: Read-it-Later (Readwise Reader, Omnivore, Matter, Pocket, Instapaper), PKB/Note (Obsidian, Logseq, Notion, AnyType, Reflect, Mem, Heptabase, Capacities), File-based reader (Calibre Web, Komga, Kavita, Bookshelf), AI-native (Recall, NotebookLM, Mymind, Glasp), Self-host (Wallabag, Karakeep/Hoarder, Linkwarden, Outline, AppFlowy, Trilium, Paperless-ngx)
- Tính năng chính cần benchmark: multi-format upload, cross-device read-position sync, multi-tab UX, highlight/note, search, AI tóm tắt, audio/video timestamp, offline, auth, pricing
- Persona: cá nhân học tập / knowledge worker, không code, đa thiết bị (laptop + iPad + iPhone)
- Tech stack candidates cho self-build: Next.js + Supabase (Auth + Postgres + Storage + Realtime), hosting free (Vercel/Netlify/Cloudflare Pages), viewer libraries (PDF.js, mammoth, react-pptx, plyr/video.js, wavesurfer)

**Research Methodology:**

- Web search & verify trên trang chính chủ sản phẩm + reviews độc lập (Reddit, HN, blog)
- Trích dẫn nguồn cho mọi claim quan trọng
- Đánh giá độ tin cậy khi dữ liệu không chắc chắn

### Next Steps

**Research Workflow:**

1. ✅ Initialization and scope setting (current step)
2. Customer Insights and Behavior Analysis (hành vi đọc đa thiết bị, pain khi học)
3. Customer Pain Points (sync, format support, note workflow, lock-in)
4. Customer Decisions (tiêu chí chọn app, willingness to self-build)
5. Competitive Landscape (deep-dive top sản phẩm + feature matrix)
6. Strategic Synthesis (đề xuất feature MVP + tech stack + roadmap để Claude code)

**Research Status**: Scope confirmed by user on 2026-04-25.

---

## Customer Behavior and Segments

### Customer Behavior Patterns

Người dùng PKB/Reading-app năm 2025–2026 đang dịch chuyển từ "ghi chú đơn thuần" sang **PKM như một thực hành & lối tư duy** — đọc, lưu, suy nghĩ, kết nối và xuất bản tri thức trong cùng một dòng chảy. ([PKM in 2025 — Medium](https://medium.com/@ann_p/pkm-in-2025-why-were-not-just-taking-notes-anymore-f7dae509f622))

- **Behavior Drivers**: Quá tải thông tin (Microsoft Work Trend Index 2025: **275 lượt gián đoạn/ngày**, knowledge worker tốn **1.8 giờ/ngày để tìm kiếm thông tin**; OpenText: **80% nhân sự toàn cầu** bị information overload). ([Readless — Best Read-Later Apps 2026](https://www.readless.app/blog/best-read-later-apps-comparison))
- **Interaction Preferences**: Mobile-first đang lên ngôi — người dùng muốn capture mọi nơi (điện thoại) nhưng đọc sâu trên iPad/laptop, đòi hỏi sync real-time. ([The Best Mobile PKMSes for 2025 — Medium](https://medium.com/@theo-james/the-best-mobile-pkmses-for-2025-capture-knowledge-on-the-go-fafc0059f8f2))
- **Decision Habits**: Power-user chọn theo "ecosystem + integration" (Readwise → Obsidian/Notion); người đọc "thường" chọn theo cảm giác đọc dễ chịu (Matter). ([The Sweet Setup — Matter vs Readwise Reader](https://thesweetsetup.com/is-matter-or-readwise-reader-the-read-later-app-for-you/))

### Demographic Segmentation

- **Age/Role**: Knowledge worker 25–45, lập trình viên, nhà nghiên cứu, sinh viên cao học, content creator. Job posting yêu cầu Notion **+145% YoY** trên LinkedIn → Notion lan ra product/marketing/ops; Obsidian gắn với dev & researcher. ([dasroot.net — Obsidian vs Logseq vs Notion 2026](https://dasroot.net/posts/2026/03/obsidian-logseq-notion-pkm-systems-compared-2026/))
- **Geographic**: Toàn cầu, nhưng cộng đồng tự-host & OSS (Logseq, Obsidian, Wallabag) tập trung ở Bắc Mỹ, EU, một phần Đông Á. _Confidence: medium — không có khảo sát chính thức công bố._
- **Education**: Thiên về đại học trở lên, kỹ năng số cao; nhóm "self-host" cần kỹ thuật khá. ([Omnivore Review — molodtsov.me](https://molodtsov.me/2023/08/omnivore-review-an-underrated-read-later-app/))
- **Device**: Phần lớn dùng ≥2 thiết bị (laptop + phone, nhiều người thêm tablet). Apple Books, Kindle đặt chuẩn kỳ vọng "đồng bộ vị trí đọc" mặc định. ([Apple Support — Access books on other Apple devices](https://support.apple.com/guide/iphone/access-books-on-other-apple-devices-iphb886e1752/ios))

### Psychographic Profiles

- **Values**: Tự chủ dữ liệu (data ownership), học suốt đời, "build a second brain", tránh lock-in.
- **Lifestyle**: Đọc sâu, take-note có hệ thống, thích cá nhân hoá workflow; sẵn lòng tự build nếu công cụ thị trường không vừa.
- **Attitudes**: Hoài nghi với cloud-only đóng kín (sau cú **Omnivore bị ElevenLabs mua lại & shutdown cuối 2024** → người dùng mất dữ liệu, niềm tin sụp đổ với SaaS đóng). ([Readless — Readwise Alternatives 2026](https://www.readless.app/blog/readwise-alternatives-2026))
- **Personality**: Curious, systematic, độc lập — "tinkerer" sẵn sàng học công cụ mới.

### Customer Segment Profiles

| # | Segment | Đặc điểm | Tool tiêu biểu |
|---|---|---|---|
| 1 | **Power Researcher / Dev** | Đọc nhiều paper, blog, code; cần highlight, link 2 chiều, plugin, tự host | Obsidian + Readwise Reader, Logseq |
| 2 | **Casual Knowledge Reader** | Lướt newsletter, longread, podcast; muốn UX đẹp, đọc thư giãn | Matter, Readwise Reader, Pocket |
| 3 | **Self-host / Privacy-first** | Sợ shutdown, muốn full ownership, có chút khả năng kỹ thuật | Wallabag, Karakeep/Hoarder, Linkwarden, Trilium |
| 4 | **Multi-format Learner** (← **persona Thuat thuộc nhóm này**) | Upload PDF, PPTX, audio, video, ảnh; học đa phương tiện trên đa thiết bị, muốn note + tab | Notion + drive, BookFusion, Calibre-Web, Recall |

([Slant — Cross-platform PKM tools 2026](https://www.slant.co/topics/4249/~cross-platform-tools-for-personal-knowledge-management), [BookFusion](https://www.bookfusion.com/))

### Behavior Drivers and Influences

- **Emotional**: Lo "mất kiến thức đã tích luỹ" (FOMO tri thức) → muốn lưu hết, đánh dấu hết. Cú shutdown của Omnivore khiến nỗi sợ này tăng mạnh. ([Readless — Readwise Alternatives 2026](https://www.readless.app/blog/readwise-alternatives-2026))
- **Rational**: Tiết kiệm thời gian tìm lại, ROI học tập, sync để không phải mở lại file thủ công.
- **Social**: Cộng đồng PKM (Reddit r/ObsidianMD, r/PKMS, Twitter "build-in-public") ảnh hưởng mạnh tới lựa chọn công cụ. ([MPU Talk — Reader vs Matter vs Omnivore](https://talk.macpowerusers.com/t/readwise-reader-vs-matter-vs-omnivore/35211))
- **Economic**: Sẵn lòng trả $8–10/tháng cho Readwise nếu thấy ROI; nhóm self-host muốn $0 + chỉ tốn hosting/cloud nhỏ.

### Customer Interaction Patterns

- **Research/Discovery**: Reddit, YouTube review, blog so sánh (TheSweetSetup, Tech-Insider, Slant), word-of-mouth. ([Tech-Insider — Notion vs Obsidian 2026](https://tech-insider.org/notion-vs-obsidian-2026/))
- **Decision Process**: (1) Trial free → (2) Import dữ liệu cũ → (3) Setup workflow + sync → (4) Quyết định trả phí hoặc tự build.
- **Post-Purchase**: Tinker plugin/template, viết blog "my setup", chia sẻ Obsidian Vault.
- **Loyalty**: Cao khi tool mở data, sync ổn, không lock-in. Rất thấp với SaaS đóng — Omnivore là bài học. ([Readless](https://www.readless.app/blog/readwise-alternatives-2026))

**Confidence Note**: Số liệu định lượng (% người dùng từng segment) hiếm — đa phần là khảo sát cộng đồng nhỏ và bài review chuyên gia. Mình ưu tiên trích báo cáo có nguồn (Microsoft Work Trend, OpenText, LinkedIn job-posting) và bổ sung quan sát cộng đồng cho phần còn lại.

---

## Customer Pain Points and Needs

### Customer Challenges and Frustrations

- **Sync xuyên thiết bị không tin cậy** — Obsidian forum (2024–2025) ghi nhận hàng loạt báo lỗi: plugin/settings/hotkeys không sync, file bị overwrite khi đổi giữa iPhone và desktop, đôi khi mất file. Đây là **pain #1** của PKM hiện đại. ([Obsidian Forum — Persistent sync issues](https://forum.obsidian.md/t/persistent-syncing-issues-with-plugins-settings-and-hotkeys-across-devices/88889), [Obsidian Forum — Sync overwrites newer data on iPhone](https://forum.obsidian.md/t/obsidian-sync-on-iphone-overwrites-newer-data-causing-data-loss/85214))
- **Notion không annotate được PDF** — không highlight/note trực tiếp trên PDF, không index nội dung PDF (search không tìm ra), free chỉ upload **5MB/file**. ([PageOn.AI — Using Notion to edit PDFs](https://www.pageon.ai/blog/can-i-use-notion-to-edit-a-pdf-file), [Notion HQ tweet xác nhận không có PDF annotation](https://x.com/notionhq/status/1219773796770402304))
- **Readwise Reader đắt** — bundle Reader + Readwise = **$9.99–13.99/tháng**, EPUB còn lỗi, không retain highlight từ Kindle/Apple Books vì copyright. ([Readwise Pricing](https://readwise.io/pricing/reader), [Readwise FAQ](https://docs.readwise.io/reader/docs/faqs))
- **Mất dữ liệu do shutdown**: Omnivore shutdown 11/2024 (ElevenLabs acquihire) — chỉ thông báo trước ~1 tháng, export thì mỗi 20 article = 1 file JSON, user **12.000 article phải upload 600 file thủ công** sang chỗ khác. Pocket shutdown 08/07/2025 (35 triệu user). ([Gleamr — Pocket & Omnivore are dead](https://gleamr.io/blog/pocket-shutting-down-alternatives), [molodtsov.me — Omnivore is dead](https://molodtsov.me/2024/10/omnivore-is-dead-where-to-go-next/))

### Unmet Customer Needs

- **Đa định dạng "đọc & học" trong 1 chỗ**: hiện chưa có sản phẩm phổ thông nào đọc tốt **đồng thời** PDF + EPUB + DOCX + PPTX + MD + audio + video + ảnh + có note + sync vị trí. Mỗi tool mới mạnh 2–3 định dạng. (gap rõ — Readwise Reader: PDF/EPUB/web; BookFusion: ebook; Calibre-Web: ebook; Notion: file embed nhưng không annotate)
- **Resume vị trí đọc cho mọi định dạng** — Apple Books/Kindle làm tốt cho ebook; PDF/PPTX/audio/video resume cross-device thì hầu như không có giải pháp tích hợp.
- **Multi-tab thực sự**: rất ít app cho mở nhiều tài liệu song song theo dạng tab (Readwise Reader có "split view" giới hạn; Obsidian có tab nhưng cho note); chưa thấy reading-app cá nhân nào làm tốt.
- **Note ngay-trên-tài-liệu + tổng hợp riêng**: kết hợp annotation inline + một "note workspace" tự do (như Heptabase/Obsidian) trong cùng UX còn rời rạc.

### Barriers to Adoption

- **Price**: Readwise Reader $13.99/m bị xem là "không cho casual reader". ([SaaSLens](https://saaslens.app/tools/readwise))
- **Technical**: Self-host Supabase đòi Docker/DevOps — ngoài tầm với của user không code. ([Supabase Self-Hosting Docs](https://supabase.com/docs/guides/self-hosting))
- **Trust**: Sau Omnivore + Pocket, user cảnh giác mọi SaaS đóng kín. **Data portability + open data + sustainable business model** trở thành tiêu chí hàng đầu khi chọn năm 2026. ([Readless — Best Read-Later Apps 2026](https://www.readless.app/blog/best-read-later-apps-comparison))
- **Convenience**: Setup vault Obsidian + Sync + plugin trên 3 thiết bị tốn công; sync iCloud "khá ổn nhưng rất không reliable". ([Medium — Cross-Platform Obsidian Sync](https://medium.com/@xcxwcqctcb/cross-platform-obsidian-how-to-keep-your-vault-synced-across-all-your-devices-ff2805951dd1))

### Service and Support Pain Points

- **Hỗ trợ chậm/thiếu** với SaaS nhỏ — Omnivore không reply trước khi shutdown.
- **Migration/import khổ sở** — không có chuẩn chung; user phải tự chuyển dữ liệu giữa các tool. ([molodtsov.me](https://molodtsov.me/2024/10/omnivore-is-dead-where-to-go-next/))
- **Sync conflict resolution kém** — Obsidian + OneDrive xoá file một bên thì bên kia restore lại. ([Paul's Vault Members — Two-way sync issue](https://paulsvaultmembers.com/insight/two-way-sync-keeps-restoring-deleted-notes-obsidian-onedrive-foldersync/))

### Customer Satisfaction Gaps

- **Expectation vs reality**: Người dùng kỳ vọng "đồng bộ vị trí đọc" là **mặc định** (Apple Books/Kindle đặt chuẩn), nhưng đa số PKB/reading-app không có. ([Apple Support — Sync books across devices](https://support.apple.com/guide/iphone/access-books-on-other-apple-devices-iphb886e1752/ios))
- **Quality**: PDF render trong Notion/Obsidian iOS khá kém, chậm với file lớn.
- **Value perception**: Trả $14/tháng cho Reader nhưng vẫn không upload được file lớn / đa định dạng video → cảm giác "không xứng tiền" với power user.
- **Trust**: SaaS đóng = niềm tin thấp.

### Emotional Impact Assessment

- **Frustration**: Cao — mất dữ liệu (Omnivore/Pocket), data lock-in, sync làm hỏng note.
- **Loyalty risks**: Rất cao với SaaS đóng. Self-host (Logseq, Trilium) loyalty cao hơn vì user "sở hữu" file Markdown.
- **Reputation**: Tool nào shutdown là thương hiệu ngang nhau "không đáng tin"; OECD 2024 đã cảnh báo data portability là vấn đề thị trường.
- **Retention**: Migration đau → user thường ở lại vì "ngại chuyển", không phải vì hài lòng (giả-loyalty).

### Pain Point Prioritization (cho dự án của Thuat)

| Mức | Pain Point | Cơ hội cho web app cá nhân |
|---|---|---|
| **🔴 High** | Sync vị trí đọc cross-device không tin cậy | **Đây là USP**. Lưu `last_position` per (user, doc, device) trong Supabase Postgres + realtime → resume tức thì khi đổi máy |
| **🔴 High** | Đa định dạng trong 1 app | Xài viewer riêng cho từng loại (PDF.js, mammoth, pptx-renderer, plyr, wavesurfer) — Claude code được |
| **🔴 High** | Note inline + workspace riêng | Lớp annotation đè lên viewer + bảng `notes` quan hệ với `document_id` + `position` |
| **🟡 Medium** | Multi-tab UX | State client lưu mảng `open_tabs[]` đồng bộ qua Supabase realtime |
| **🟡 Medium** | Storage cho file lớn (video/audio) | **Cảnh báo**: Supabase free chỉ 1GB storage + **file ≤50MB** ([Supabase Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)). Cần xem lựa chọn thay thế (xem Bước 6) |
| **🟢 Low** | Plugin ecosystem | Không cần ở MVP cá nhân |
| **🟢 Low** | AI tóm tắt / chat with doc | Nice-to-have, thêm sau bằng Claude API |

**Rủi ro lớn nhất với hướng tự build trên Supabase free**: **giới hạn 50MB/file và 1GB tổng** — sẽ chặn bạn upload video/audio dài. Mình sẽ giải quyết ở Bước 6 (Strategic Synthesis) bằng kiến trúc lai: metadata + note → Supabase/Pocketbase/Convex, file lớn → Cloudflare R2 free 10GB hoặc Backblaze B2 free 10GB.

---

## Customer Decision Processes and Journey

### Customer Decision-Making Processes

Quy trình chọn PKB/Reading-app được cộng đồng PKM năm 2025 mô tả khá nhất quán qua 5 giai đoạn:

| Giai đoạn | Mô tả | Thời gian điển hình |
|---|---|---|
| **1. Trigger** | Cú shutdown (Pocket 7/2025, Omnivore 11/2024) hoặc đau với tool hiện tại | Vài ngày |
| **2. Awareness** | Đọc blog so sánh, Reddit r/PKMS, YouTube reviewer | 1–2 tuần |
| **3. Evaluation** | Trial 2–4 app song song, import dữ liệu thử | 2–6 tuần |
| **4. Decision** | Chọn 1 (hoặc 2 app bổ trợ — capture vs deep-read) | 1 tuần |
| **5. Setup & Lock-in** | Build vault/workflow, plugin, sync, RSS | 1–3 tháng |

Cú shutdown của Pocket (Mozilla, 8/7/2025) đã đẩy hàng triệu user vào Phase 1 "emergency scramble" trước hạn export 8/10/2025. ([Readless — Omnivore Alternatives 2026](https://www.readless.app/blog/omnivore-alternatives-2026), [TabMark — Pocket Alternatives 2026](https://tabmark.dev/blog/posts/pocket-alternatives/))

### Decision Factors and Criteria

Top tiêu chí cộng đồng PKM 2025–2026 dùng để chọn:

| # | Tiêu chí | Trọng số | Ghi chú |
|---|---|---|---|
| 1 | **Data portability / Open format** | 🔴 Critical | Markdown/EPUB/JSON xuất dễ; sau Omnivore-Pocket → đây là "must-have" 2026 |
| 2 | **Sync cross-device tin cậy** | 🔴 Critical | Apple Books/Kindle là benchmark |
| 3 | **Sustainable business model** | 🔴 Critical | Tránh free-VC-burning model như Omnivore |
| 4 | **Privacy / Data ownership** | 🟠 High | Local-first (Obsidian, Logseq) > cloud-only |
| 5 | **Bidirectional links + graph view** | 🟠 High | Foundational PKM |
| 6 | **Search + tag system** | 🟠 High | Full-text + semantic ngày càng kỳ vọng |
| 7 | **Multi-format support** | 🟠 High (đặc biệt cho Thuat) | Hiếm app làm tốt |
| 8 | **Annotation / highlight inline** | 🟡 Medium | Notion fail tiêu chí này |
| 9 | **Price** | 🟡 Medium | Casual reader bỏ Readwise vì $14/m |
| 10 | **Plugin / extensibility** | 🟢 Nice-to-have | Power user mới quan tâm |

Nguồn: ([Heptabase vs Tana — Paperless Movement](https://paperlessmovement.com/videos/heptabase-vs-tana-which-is-the-best-note-taking-and-pkm-app-of-2025/), [10 Best PKM Apps — Focusbox](https://focusbox.io/blog/comparisons/pkm-apps/), [Readless — Best Read-Later 2026](https://www.readless.app/blog/best-read-later-apps-comparison))

### Customer Journey Mapping (cho persona "Multi-format Learner" như Thuat)

- **Awareness**: Bắt đầu khi cần học/đọc đa định dạng & nhận ra Notion/Obsidian không kham nổi PDF + video + PPTX trong cùng UX.
- **Consideration**: Thử Readwise Reader (đắt, không upload video), BookFusion (chỉ ebook), Notion + drive (PDF không annotate), Obsidian + plugin (config mệt, sync khổ). Nhận ra **không có sản phẩm phổ thông nào fit**.
- **Decision** (Thuat đang ở đây): Chuyển sang **build-it-yourself** — đặc biệt khả thi từ 2025 nhờ AI coding (Claude Code, Cursor). **44% sản phẩm SaaS có lợi nhuận hiện do 1 founder vận hành — gấp đôi từ 2018**, và **1/3 indie SaaS founders dùng AI cho >70% workflow dev/marketing**. ([Indie Hackers — 30 days SaaS](https://www.indiehackers.com/post/i-shipped-a-productivity-saas-in-30-days-as-a-solo-dev-heres-what-ai-actually-changed-and-what-it-didn-t-15c8876106), [The Successful Projects — Indie Hackers no-code 2026](https://www.thesuccessfulprojects.com/indie-hackers-build-saas-with-no-code-and-ai/))
- **"Purchase"** (deploy): Setup stack, deploy lên Vercel/Cloudflare Pages, kết nối Supabase/Pocketbase/Convex.
- **Post-purchase**: Iterate feature theo nhu cầu thực — đây là lợi thế lớn nhất của tự build.

### Touchpoint Analysis

- **Digital**: Reddit (r/PKMS, r/ObsidianMD, r/selfhosted), YouTube (Joe Buhlig, Theo James, August Bradley), Medium, Substack PKM Weekly, Hacker News, Product Hunt, Twitter/X.
- **Trusted reviewers**: TheSweetSetup, Paperless Movement, Readless blog, MPU, ItsFOSS.
- **Influence channels**: GitHub stars (Karakeep tăng vọt **24.300+ stars** sau Pocket/Omnivore shutdown — chỉ dấu social-proof cực mạnh). ([Gleamr — Pocket & Omnivore alternatives](https://gleamr.io/blog/pocket-shutting-down-alternatives))

### Information Gathering Patterns

- **Research methods**: Đọc 3–5 bài so sánh + 2–3 video review + thread Reddit; trial cùng lúc 2–3 tool 1–2 tuần.
- **Trusted sources**: Blog độc lập > website chính chủ; cộng đồng OSS > marketing SaaS.
- **Duration**: 2–6 tuần cho quyết định lớn (chọn vault chính); 1–3 ngày cho tool phụ trợ.
- **Evaluation**: Import data thật, test sync 3 thiết bị, đánh giá UX trên iOS — đây là khâu mà nhiều app fail.

### Decision Influencers

- **Peer**: Đồng nghiệp dev/researcher giới thiệu — ảnh hưởng cao nhất.
- **Expert**: Reviewer độc lập (TheSweetSetup, Paperless Movement) > influencer Twitter.
- **Media**: Hacker News front page có thể đẩy 1 OSS lên 5k stars/tuần.
- **Social proof**: GitHub stars, số contributor, recency commit, Discord community size.

### Purchase Decision Factors

- **Immediate trigger**: Tool đang dùng shutdown (Pocket, Omnivore) hoặc tăng giá đột ngột.
- **Delayed**: Migration cost (data + workflow + muscle memory) — user thường ở lại lâu hơn lý tính cho phép.
- **Loyalty drivers**: File local Markdown, không lock-in, community lớn, dev active.
- **Price sensitivity**: Casual reader rất nhạy ($5/m là ngưỡng); power user chấp nhận $10–15/m nếu đáng.

### Customer Decision Optimizations (cho web app của Thuat)

- **Friction reduction**: 1 lần đăng nhập → mở lại đúng tab + đúng vị trí đọc trên mọi thiết bị (USP cốt lõi).
- **Trust building**: Vì là app cá nhân, không cần build trust cho người khác — nhưng nên: (a) export Markdown/JSON full data bất kỳ lúc nào, (b) dùng OSS license, (c) backup tự động lên Google Drive/Dropbox.
- **Conversion optimization**: Không applicable (cá nhân) — thay vào đó focus "time-to-value": setup ban đầu < 30 phút, upload tài liệu đầu tiên trong 3 click.
- **Loyalty building**: Iterate feature đúng nhu cầu thực; tránh feature creep; dữ liệu mở để chính bạn không bị chính-mình-lock-in (nghe lạ nhưng quan trọng — nếu sau này muốn chuyển sang Obsidian, dữ liệu vẫn cứu được).

### Build vs Buy vs Hybrid — Quyết định cho Thuat

| Phương án | Ưu | Nhược | Phù hợp Thuat? |
|---|---|---|---|
| **Buy 100%** (Readwise + BookFusion + Notion) | Nhanh | $20+/tháng, vẫn không 1-app, không control sync | ❌ |
| **Build 100%** (Claude code from zero) | Đúng ý 100%, $0/m | Tốn thời gian, phải maintain | ⚠️ Khả thi với AI 2026 |
| **Hybrid (recommended)** | Build core (upload + viewer + position-sync + note); cắm OSS sẵn có (PDF.js, Plyr, Wavesurfer, mammoth, react-pptx) | Cần học tích hợp OSS | ✅ **Ưu tiên** |

**Quyết định đề xuất**: **Hybrid** — Claude code phần khung, ráp OSS viewer để không reinvent wheel.

**Confidence**: Cao cho phần build-vs-buy (số liệu Indie Hackers + xu hướng rõ); medium cho phần tỉ lệ tiêu chí (dựa quan sát cộng đồng, không có khảo sát định lượng tổng hợp).

---

## Competitive Landscape

### Key Market Players

Mình phân thành 5 nhóm cạnh tranh trực tiếp/gián tiếp với ý tưởng web app của Thuat:

| Nhóm | Tool tiêu biểu | Định vị | Mô hình |
|---|---|---|---|
| **A. Read-it-Later cao cấp** | Readwise Reader | Power-reader, highlight + spaced-repetition, ecosystem | SaaS $9.99–13.99/m |
| **B. AI-native reader** | Recall, Heptabase, Mymind, NotebookLM | "Đọc + chat với tài liệu", knowledge graph AI | SaaS $0–38/m |
| **C. Self-host bookmark/PKM** | Karakeep (Hoarder), Linkwarden, Wallabag, Trilium | Data ownership, OSS, AI tagging tự host | Free + chi phí VPS/AI API |
| **D. Self-host eBook server** | Calibre-Web, Kavita, Komga | Library cá nhân, OPDS, ebook-focused | Free OSS |
| **E. Multi-format reader** | BookFusion, Polar, Zotero | PDF/EPUB/DOCX, sync vị trí đọc | Freemium |
| **F. PKM-Note (cạnh tranh ở mảng note)** | Obsidian, Logseq, Notion, AnyType | Note + link, không mạnh đa định dạng | Free → Premium |

### Market Share Analysis

- **Notion**: ~100M user (số liệu chính thức 2024–2025 tổng users), thống trị mảng team-knowledge.
- **Obsidian**: Cộng đồng PKM dev/researcher dẫn đầu; không công bố user count chính thức.
- **Readwise (+Reader)**: Power-reader segment dẫn đầu, định giá $9.99–13.99/m. ([Readwise Pricing](https://readwise.io/pricing/reader))
- **Karakeep**: **24.300+ GitHub stars** (tăng vọt sau Pocket/Omnivore shutdown) → leader nhóm self-host bookmark. ([Karakeep GitHub](https://github.com/karakeep-app/karakeep))
- **BookFusion**: Niche "multi-format ebook reader có sync vị trí chính xác qua CFI" — ít competitor trực tiếp. ([BookFusion 2025 Wrap-Up](https://www.blog.bookfusion.com/bookfusion-web-2025-wrap-up-faster-pdfs-better-highlights-and-a-big-2026-roadmap/))
- **Heptabase / Recall / Mymind**: Niche AI-native, đang lên nhanh nhưng cao giá ($10–38/m).
- **Pocket (đã chết)** từng có 35M user — đây là "chỗ trống" thị trường lớn.

_Confidence: medium — số liệu user thực tế hiếm khi công bố đầy đủ; mình ưu tiên chỉ số GitHub stars + pricing chính thức._

### Competitive Positioning (Feature Matrix chi tiết)

Đánh giá 8 tool đại diện trên 12 tiêu chí quan trọng cho persona Thuat:

| Tool | PDF | EPUB | DOCX | PPTX | Audio | Video | Ảnh | Web/MD | Note inline | Resume cross-device | Multi-tab | Giá/m |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Readwise Reader** | ✅ | ✅ | ⚠️ | ❌ | 🟡 (TTS) | ❌ | ❌ | ✅ | ✅ | ✅ | 🟡 split | $9.99 |
| **BookFusion** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅✅ (CFI) | ❌ | $1–7 |
| **Notion** | 🟡 (embed) | ❌ | 🟡 | ❌ | ❌ | 🟡 | ✅ | ✅ | ❌ (no PDF annotate) | ❌ | ✅ (page) | $0–10 |
| **Obsidian + Sync** | ✅ (plugin) | 🟡 | 🟡 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 🟡 (sync issue) | ✅ | $0–10 |
| **Logseq** | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 🟡 (manual) | ✅ | $0 |
| **Karakeep** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | 🟡 | 🟡 | 🟡 | $0 self-host |
| **Heptabase** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (whiteboard) | $9–18 |
| **Recall** | ✅ | ❌ | ❌ | ❌ | ✅ (podcast) | ✅ (YT) | 🟡 | ✅ | ✅ | ✅ | 🟡 | $0–38 |
| **Calibre-Web** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | $0 self-host |
| **Kavita** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 🟡 (CBZ) | ❌ | ❌ | ✅ | ❌ | $0 self-host |

Legend: ✅ tốt · 🟡 hạn chế · ❌ không có

**Phát hiện then chốt**: **Không có tool nào tích đủ cả 12 cột**. Đây chính là **khoảng trống thị trường** mà web app cá nhân của Thuat sẽ lấp.

### Strengths and Weaknesses (SWOT của các đối thủ chính)

**Readwise Reader** — _S_: ecosystem highlight → spaced repetition → integration Obsidian/Notion; offline tốt; cross-device sync ổn. _W_: đắt, không upload video/PPTX/audio dài, không retain Kindle highlights khi import EPUB. ([Readwise Docs](https://docs.readwise.io/reader/docs/faqs))

**BookFusion** — _S_: hỗ trợ ~25 định dạng ebook, CFI sync vị trí cực chính xác. _W_: chỉ ebook, không web/audio/video/note workspace.

**Karakeep** — _S_: OSS, AI tagging, full-text search, mobile app, community boom. _W_: tập trung bookmark/PDF/note ngắn, không đọc EPUB/PPTX/audio/video.

**Heptabase** — _S_: whiteboard visual + AI multi-model (OpenAI/Gemini/Anthropic). _W_: $9–18/m, chỉ PDF + note, không multi-format thực sự.

**Recall** — _S_: AI summarize PDF/YouTube/podcast/Google Docs, knowledge graph. _W_: $10–38/m, focus đọc-tóm tắt hơn là đọc-sâu, không native PPTX/DOCX.

**Notion** — _S_: workspace tổng, link share dễ. _W_: PDF không annotate, không index nội dung PDF, không là reading-app.

**Obsidian + Sync** — _S_: local-first, plugin ecosystem khổng lồ, MD chuẩn mở. _W_: sync hay lỗi, setup nặng, không native multi-format reader, mobile yếu.

**Calibre-Web / Kavita** — _S_: free, self-host nhẹ, EPUB/PDF tốt. _W_: chỉ ebook, không có note workspace, không web clipping, không audio/video.

### Market Differentiation — Khoảng trống cho web app của Thuat

3 chỗ trống thị trường rõ rệt:

1. **"All-format reader có sync vị trí cross-device"** — kết hợp BookFusion + Readwise Reader + Plyr/Wavesurfer (audio/video) + react-pptx (slides). Chưa có ai làm đầy đủ.
2. **"Multi-tab thực sự + workspace cá nhân"** — kiểu trình duyệt: mở 5 tài liệu cùng lúc, tab bar giống Chrome, switch tức thì, đồng bộ tab giữa thiết bị. Heptabase có whiteboard nhưng không phải tab-based.
3. **"Note inline + Note free-form trong cùng 1 chỗ + mọi định dạng"** — hiện phải dùng Readwise + Obsidian (2 tool, 2 tài khoản, 2 sync).

→ Web app của Thuat có thể lấp **cả 3 chỗ trống** ngay từ MVP, vì chỉ phục vụ 1 user nên không phải lo về scale/onboarding/billing.

### Competitive Threats

- **AI-native players (Recall, Heptabase, NotebookLM)** đang nhanh chóng thêm "chat with documents" → có thể vượt feature cá nhân nếu họ thêm multi-format & video/audio. Mitigate: app cá nhân không cạnh tranh thị trường, chỉ cần "đủ dùng cho Thuat".
- **Cú shutdown của OSS phụ thuộc** — nếu PDF.js / Plyr / Wavesurfer dừng phát triển → hiếm khả năng vì đều là OSS lâu năm. Risk: low.
- **Supabase/Cloudflare/Vercel đổi free tier** — đã từng xảy ra (Netlify giảm build min từ 300 → 100 năm 2025). Mitigate: kiến trúc decoupled, dữ liệu Markdown/SQL standard để di chuyển dễ.

### Opportunities (cho web app của Thuat)

- ✅ **Khoảng trống "all-format + sync + multi-tab + note"** rõ rệt — không phải cạnh tranh thật, chỉ cần build cho mình.
- ✅ **AI 2026 + Claude Code đủ trưởng thành** để 1 người không-code (chỉ-prompt) ráp được trong 4–8 tuần.
- ✅ **OSS viewer libraries miễn phí**: PDF.js, mammoth.js (DOCX), pptxjs/react-pptx, Plyr (video), Wavesurfer (audio), react-image-gallery, Markdown renderer — ráp nhanh.
- ✅ **Free-tier hosting cực rộng năm 2026**: Cloudflare Pages (unlimited bandwidth), Vercel Hobby (100GB), Netlify Starter (100GB). ([Hosting Free Tier 2026](https://agentdeals.dev/hosting-free-tier-comparison-2026))
- ✅ **Stack đa dạng**: Supabase / Pocketbase / Convex / Appwrite / Firebase đều có free tier dùng được — sẽ so sánh ở Bước 6.
- ⚠️ **Vercel Hobby cấm "commercial use"** — cá nhân học tập thì OK, nhưng nếu sau này commercial, phải chuyển Cloudflare Pages (unlimited + cho phép commercial). ([Digital Applied — Vercel vs Netlify vs Cloudflare 2025](https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison))

### Lessons Learned (chắt lọc từ đối thủ)

| Lesson | Học từ ai | Áp dụng vào MVP |
|---|---|---|
| Sync vị trí dùng **CFI cho EPUB**, **page+offset cho PDF**, **timestamp cho audio/video**, **scroll % cho web/MD** | BookFusion | Schema `reading_progress(doc_id, position_type, position_value, device, ts)` |
| Highlight có ID ổn định, đồng bộ realtime | Readwise Reader | Bảng `highlights(id, doc_id, anchor, color, note, ts)` |
| **Data portability ngay từ ngày 1** (export Markdown/JSON/SQLite) | Bài học Omnivore/Pocket | Endpoint `/export/all` xuất ZIP MD + JSON + file gốc |
| AI tagging + full-text search lưu local | Karakeep | PostgreSQL `tsvector` hoặc SQLite FTS5 |
| Whiteboard/visual layout **không cần** ở MVP | Heptabase complexity | Để giai đoạn 2 |
| Multi-tab theo dạng trình duyệt | Trình duyệt + Obsidian tabs | State `open_tabs[]` đồng bộ realtime |
| Local-first + sync server | Obsidian + Logseq | IndexedDB cache + Supabase/Convex sync |

---

## Strategic Synthesis & Recommendations

### Executive Summary

Thị trường Personal Knowledge Base / Reading App năm 2026 đang ở giai đoạn **tái cấu trúc niềm tin** sau cú shutdown liên tiếp của Omnivore (11/2024) và Pocket-35M-user (07/2025). Người dùng power-reader chuyển sang ưu tiên **data portability**, **sync xuyên thiết bị tin cậy**, và **sustainable business model**. Đồng thời, không có một sản phẩm phổ thông nào (Readwise Reader, BookFusion, Notion, Obsidian, Heptabase, Recall, Karakeep, Calibre-Web…) đáp ứng đồng thời 12 tiêu chí mà persona "Multi-format Learner" như Thuat cần — đặc biệt là combo **PDF + EPUB + DOCX + PPTX + Audio + Video + Ảnh + Web/MD + Note inline + Resume cross-device + Multi-tab**. Đây là **khoảng trống thị trường rõ rệt**.

Bối cảnh AI-coding 2026 (44% SaaS có lợi nhuận do 1 founder vận hành; 1/3 indie founder dùng AI cho >70% workflow) cho phép Thuat — dù không code — vẫn build được web app cá nhân **chi phí $0/tháng** bằng Claude Code, ráp các thư viện OSS sẵn (PDF.js, mammoth, react-pptx, Plyr, Wavesurfer) trên stack BaaS free và CDN free. Khuyến nghị: **Hybrid Build** với 2 phương án stack đề xuất ở phần dưới, ưu tiên Phương án A (Convex + Cloudflare R2 + Cloudflare Pages) vì DX tốt nhất cho Claude Code và thoáng nhất về sync realtime + storage.

### 🎯 Khuyến nghị Stack — So sánh 4 phương án

| # | Stack | DB | Auth | Storage | Realtime | Hosting | $0 thực sự? | Phù hợp |
|---|---|---|---|---|---|---|---|---|
| **A ⭐** | **Convex + Cloudflare R2 + Clerk + Cloudflare Pages** | Convex (reactive) | Clerk free 10k MAU | R2 free 10GB, **0$ egress** | ✅✅ native | Cloudflare Pages (unlimited bandwidth) | ✅ | **Dễ nhất cho Claude Code, sync realtime mạnh nhất** |
| **B** | **Supabase + Cloudflare R2 + Cloudflare Pages** | Postgres 500MB | Supabase Auth | R2 free 10GB | ✅ | Cloudflare Pages | ✅ | Postgres chuẩn, dễ migrate |
| **C** | **Pocketbase trên Fly.io free + R2 + Cloudflare Pages** | SQLite (1GB volume free) | PB Auth | R2 free 10GB | ✅ | Fly.io free hobby + CF Pages | ✅ | Full ownership, OSS, single binary |
| **D** | **Appwrite Cloud free + Cloudflare Pages** | Document + SQL | Appwrite Auth | 2GB free | ✅ | Cloudflare Pages | ✅ | Tất-cả-trong-1, ít cấu hình |

**Lý do chọn A (Convex + R2)** ưu tiên:

- **Convex free tier rộng hơn Supabase** cho usecase này: 1M function calls/tháng, 20 GB-hours compute, không pause sau 7 ngày inactive như Supabase. Reactive query rất hợp cho multi-tab sync. ([Convex FAQ](https://www.convex.dev/faq), [UI Bakery — Supabase Pricing 2026](https://uibakery.io/blog/supabase-pricing))
- **Cloudflare R2 zero egress fee** — quan trọng vì user xem video/audio nhiều lần, R2 không tính tiền bandwidth khi đọc; Backblaze B2 chỉ free 3x storage/tháng. ([Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/), [AgentDeals — B2 vs R2](https://agentdeals.dev/backblaze-b2-vs-cloudflare-r2))
- **Clerk** miễn phí 10.000 MAU + email/password/OAuth/MFA sẵn; ít boilerplate hơn Supabase Auth khi gắn với non-Postgres backend.
- **Cloudflare Pages** unlimited bandwidth + cho commercial; tránh trap "Vercel Hobby cấm commercial".

**Khi nào chọn B (Supabase)**: bạn muốn Postgres chuẩn để dễ chuyển sang nơi khác (Neon, Railway, RDS) sau này; quen SQL; muốn vendor lock-in thấp hơn Convex.

**Khi nào chọn C (Pocketbase)**: muốn full ownership, single binary tự host trên Fly.io free hobby (1GB volume free). Backend là 1 file Go, dễ backup. ([Pocketbase trên Fly.io — Scott Spence](https://scottspence.com/posts/set-up-free-pocketbase-db))

**Khi nào chọn D (Appwrite)**: muốn ít cấu hình nhất, 1 nơi quản lý tất cả; 2GB storage free là điểm cộng nhưng vẫn ít hơn R2 10GB.

### Frontend & Viewer Libraries (chung cho mọi stack)

| Định dạng | Library OSS | Ghi chú |
|---|---|---|
| PDF | **PDF.js** (Mozilla) hoặc react-pdf | Highlight, search, page nav |
| EPUB | **epubjs** + **react-reader** | CFI cho sync vị trí chính xác |
| DOCX | **mammoth.js** | Convert → HTML, xem inline |
| PPTX | **react-pptx** hoặc **pptxjs** | Render slide |
| Markdown | **react-markdown** + **remark/rehype** | KaTeX, mermaid plugin |
| Ảnh | **react-image-gallery** | Pinch-zoom mobile |
| Audio | **Wavesurfer.js** | Waveform + timestamp note |
| Video | **Plyr** hoặc **video.js** | HLS adaptive nếu file lớn |
| Web clip | **Mozilla Readability** + DOMPurify | Clean reader view |
| Search | **Postgres tsvector / FTS5** + **Meilisearch** (optional) | Full-text |

Framework: **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui** — Claude Code thạo nhất ngăn xếp này.

### MVP Feature Scope (4–8 tuần do Claude code)

**Phase 1 — Core Reading (tuần 1–3)**
1. Đăng nhập (Clerk hoặc Supabase Auth, email + Google)
2. Upload đa định dạng → metadata vào DB, file vào R2
3. Viewer cho từng định dạng (PDF, EPUB, DOCX, MD, ảnh, video, audio)
4. Lưu `reading_progress` mỗi 5s + khi đóng tab/đổi tab
5. Resume cross-device khi mở lại

**Phase 2 — Multi-tab & Note (tuần 4–5)**
6. Tab bar dạng trình duyệt (open_tabs[] đồng bộ realtime)
7. Highlight inline cho PDF/EPUB/MD (anchor stable)
8. Note workspace (Markdown editor) liên kết tới highlight
9. Tag + folder, full-text search

**Phase 3 — Polish & Safety (tuần 6–8)**
10. Mobile responsive (PWA — install lên iPhone/iPad qua Safari "Add to Home")
11. Offline cache (Service Worker + IndexedDB)
12. Export `/export/all` → ZIP MD + JSON + file gốc (data portability)
13. Backup tự động lên Google Drive (cron Cloudflare Worker)

### Database Schema Sketch (cho Convex/Postgres)

```ts
users(id, email, created_at)
documents(id, user_id, title, format, storage_url, size, uploaded_at, tags[])
reading_progress(id, user_id, doc_id, position_type, position_value, device_id, updated_at)
  // position_type: 'pdf_page' | 'epub_cfi' | 'time_seconds' | 'scroll_pct'
highlights(id, user_id, doc_id, anchor, color, text, note, created_at)
notes(id, user_id, parent_doc_id?, parent_highlight_id?, body_md, updated_at)
tabs(id, user_id, doc_id, scroll_state, opened_at, order)
  // realtime sync — tab list per user across devices
tags(id, user_id, name, color)
document_tags(doc_id, tag_id)
```

### Risk Assessment & Mitigation

| Rủi ro | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free tier đổi (Vercel/Netlify đã cắt 2025) | Medium | High | Dùng Cloudflare Pages (unlimited, ổn định nhất); tránh Vercel Hobby vì cấm commercial |
| Convex vendor lock-in | Medium | Medium | Có sẵn export script; hoặc chọn Phương án B (Postgres chuẩn) |
| File 1GB+ video không upload nổi | High | Medium | R2 hỗ trợ tới 5TB/object; dùng multipart upload |
| Claude code sai bug khó debug | Medium | Medium | Test từng feature nhỏ; commit Git mỗi feature; dùng test-first prompt |
| Backup mất → mất data | Low | Critical | `/export/all` chạy cron weekly → Google Drive (cá nhân) |
| Hết quota Convex/Supabase free | Low (1 user) | Low | 1 user khó vượt; nâng pro $25/m vẫn rẻ hơn Readwise |

### Implementation Roadmap

| Tuần | Mốc | Thành quả demo |
|---|---|---|
| 1 | Auth + DB + Upload | Login, upload PDF, list tài liệu |
| 2 | PDF.js + reading_progress | Đọc PDF, đóng mở lại đúng vị trí |
| 3 | EPUB + audio + video viewer | Đọc EPUB, nghe MP3, xem MP4 |
| 4 | Multi-tab UI + sync | Mở 5 tài liệu cùng lúc, switch tab |
| 5 | Highlight + Note workspace | Highlight đoạn PDF → note Markdown |
| 6 | DOCX + PPTX + ảnh + MD | Hoàn thiện 8 định dạng |
| 7 | PWA + offline + responsive | Cài lên iPhone/iPad từ Safari |
| 8 | Export + Backup + polish | Export ZIP, backup Drive, fix bug |

### Success Metrics (cá nhân)

- ✅ Tải lên 10 tài liệu mỗi định dạng, đọc OK trên cả 3 thiết bị (laptop + iPad + iPhone)
- ✅ Đổi máy giữa chừng → mở lại đúng vị trí ≤ 2 giây
- ✅ Tab vừa mở trên laptop → xuất hiện trên iPad sau ≤ 3 giây
- ✅ Search 1 từ khoá → ra kết quả ở cả PDF/note/MD trong ≤ 1 giây
- ✅ Export toàn bộ → mở được trong Obsidian
- ✅ Chi phí **$0/tháng**

### Future Outlook (sau MVP)

- **AI tích hợp** (1–3 tháng sau MVP): "Chat with this document" qua Claude API; tóm tắt audio/video qua Whisper; spaced-repetition kiểu Readwise.
- **Collaboration** (nếu sau này muốn share): Convex/Supabase đều có ACL — chỉ cần thêm `shared_with[]`.
- **Mobile native app** (nếu PWA chưa đủ): Dùng Expo + same backend.

### Next Steps cho Thuat (concrete)

1. **Quyết stack**: chọn 1 trong 4 phương án (mình đề xuất **A — Convex + R2 + Clerk + Cloudflare Pages**)
2. **Đăng ký account** Convex / Cloudflare / Clerk (đều free, không cần thẻ)
3. **Mở Claude Code** trong VS Code → tạo repo Next.js 15
4. **Prompt đầu tiên cho Claude**: "Setup Next.js 15 app router + TypeScript + Tailwind + shadcn/ui + Convex client + Clerk auth. Create login page and protected dashboard."
5. **Iterate theo 8-tuần roadmap** ở trên — mỗi tuần 1 mốc demo

Mình có thể chuyển kết quả nghiên cứu này thành **PRD chi tiết** (qua skill `/bmad-create-prd`) hoặc thẳng **architecture solution design** (qua `/bmad-create-architecture`) để Claude Code có spec rõ ràng hơn — sẵn sàng nếu Thuat muốn.





