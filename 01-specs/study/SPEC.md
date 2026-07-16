# SPEC chi tiết — Module "Học tập" (Study)

**Ngày:** 2026-07-16 · **Trạng thái:** Spec v1 — chốt sau prototype, chờ vào backend
**Nguồn:** [PRD.md](./PRD.md) + [LOCALHOST_NOTES.md](./LOCALHOST_NOTES.md) + prototype thật (`apps/web/src/components/study/*`)
**Nhánh triển khai:** `supabase`

> **Quy ước provenance** — mỗi mục đánh dấu nguồn để phân biệt "đã có" vs "phải xây":
> - `[CODE]` = đã dựng trong prototype (mock), lấy đúng behavior làm chuẩn UI
> - `[PM]` = quyết định PM/BA trong LOCALHOST_NOTES (ràng buộc nghiệp vụ)
> - `[BE]` = phần backend phải xây mới (chưa có trong prototype)
> - `[MOCK→BE]` = prototype đang mock, backend thay bằng logic thật

Spec chia làm nhiều file:
- **SPEC.md** (file này) — tổng quan, data model, rule engine, AI, routing (phần nền tảng backend)
- [SPEC-FEATURES.md](./SPEC-FEATURES.md) — spec chi tiết 5 tính năng + Plan + Notifications (I/O matrix, acceptance)

---

## 1. Tổng quan & phạm vi

Module **"Học tập"** là module thứ 2 của app (ngang hàng Thư viện / Ghi chú), biến hành vi "upload handbook rồi chỉ đọc" thành vòng lặp **active recall + spaced repetition + Feynman**. Tổ chức quanh **Không gian học (Study Space)**.

### 1.1. Kiến trúc dữ liệu 3 tầng `[PM]`

```
Study Space  (1 "lớp học", gắn nguồn = handbook cả cây HOẶC tài liệu lẻ)
 └─ Module      (m2 — 1 file handbook, heading H1/tên doc)
     └─ Mục x.y      (2.1 — heading ##)
         └─ Tiểu mục x.y.z   (2.1.3 — heading ###)  ← ĐƠN VỊ SCOPE cho quiz/card/Feynman
             └─ (tầng #### x.y.z.w — 4-tier, KHÔNG phải đơn vị ôn; parser dừng ở ###)
```

- **Đơn vị học/ôn/kiểm tra = tiểu mục cấp `x.y.z`** (heading `###`). Cấp `x.y` quá dài cho 1 lần ôn `[PM]`.
- Handbook lớn được **materialize** thành cây `study_units` theo đúng cây thư mục/heading; thứ tự học = thứ tự cây.
- Module chưa bung chi tiết (coarse) → ước lượng số tiểu mục = `dungLượng ÷ 43.000 ký tự`, gắn nhãn "(ước lượng)". Khi nạp markdown thật → thay bằng heading `[MOCK→BE]`.

### 1.2. Khóa định danh unit (unit key) `[CODE]`

Một tiểu mục có 3 dạng biểu diễn, phải map 1-1 xuyên suốt hệ thống:

| Dạng | Ví dụ | Dùng ở |
|---|---|---|
| **unit id** (DB) | `m2-1-3` | `study_units._id`-logic / khóa cây |
| **unit key** (dotted) | `2.1.3` | scope quiz/card/Feynman, addressing cross-tab |
| **quiz section id** | `q-2-1-3` | `quiz_sections`, deep-link tab Kiểm tra |
| **module key** | `M2` | gom nhóm hiển thị |

Hàm chuyển đổi (giữ nguyên từ prototype):
- `unitKeyFor("m2-1-3")` → `"2.1.3"` (bỏ tiền tố `m`, thay `-` bằng `.`)
- `quizSectionIdFor` → `"q-" + id`
- `moduleKeyOf("2.1.3")` → `"M2"` (`"M" + key.split(".")[0]`)
- `firstUnitKey(label)` — regex `/\d+\.\d+\.\d+/` trích key đầu từ label ghép (vd `"2.1.1 ↔ 2.1.3"` → `"2.1.1"`)

> **BE lưu ý:** unit id nên là cột `unitKey` chuẩn hóa (vd `"2.1.3"`) + `moduleKey` để index nhanh, KHÔNG suy từ string ở mọi query.

### 1.3. Trạng thái unit (5 mức) `[CODE][PM]`

| Enum | Nhãn | Màu chấm | Ý nghĩa |
|---|---|---|---|
| `new` | Chưa học | `muted-foreground/30` | chưa bắt đầu |
| `reading` | Đang học | `blue-500` | đang đọc (readPct 1–99) |
| `read` | Đã đọc — chưa vững | `amber-500` | đọc xong nhưng chưa đủ 4 việc |
| `mastered` | Vững | `emerald-500` | đủ 4 việc checklist |
| `decayed` | Cần học lại | `red-500` | từng 🟢 nhưng lâu không ôn |

**Triết lý `[PM]`:** không khóa đọc, không trừng phạt — chỉ làm hậu quả *nhìn thấy được* (unit vàng/đỏ, streak không nhảy). "Chế độ nghiêm" (khóa unit kế) là flag để sau.

### 1.4. Ràng buộc cứng `[PRD][PM]`

- **$0/tháng vĩnh viễn** — Supabase free tier + Gemini free tier (key user tự cấp trong `userAiSettings`). Không paid, không trial-tính-phí.
- **Rule-first:** mọi thứ làm được thành rule PHẢI là rule deterministic (0 gọi Gemini) — vì free tier không đảm bảo quota. Gemini CHỈ dùng sinh nội dung học (quiz/card/chấm Feynman), on-demand, cache sau lần đầu.
- **Quota mục tiêu:** ≤ ~10 call Gemini / ngày học nặng (trần ~250/ngày). Hết quota → mọi tính năng không-AI vẫn chạy.
- **Responsive 3 tầng** `[PM]`: mobile PWA (1 cột, hit-target lớn) → laptop ~1366px (1 cột) → desktop ≥xl (2 cột: nội dung chính + side rail sticky ~340px). Không thiết kế desktop rồi vá mobile.

---

## 2. Data model (Supabase Postgres) `[BE]`

Migration mới: `supabase/migrations/0005_study.sql`. **Khớp convention hiện có:**
- PK `"_id" text primary key default gen_random_uuid()::text`
- `"_creationTime" bigint not null default now_ms()`
- `"userId" uuid not null references auth.users(id) on delete cascade`
- Mọi timestamp = **epoch ms** (`bigint`), cột camelCase có quote
- RLS bật toàn bộ + policy owner `("userId" = auth.uid())`

### 2.1. `study_spaces` — không gian học

```sql
create table study_spaces (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  "sourceType" text not null check ("sourceType" in ('handbook','docs')),
  "handbookId" text references handbooks("_id") on delete set null,  -- khi sourceType='handbook'
  "archivedAt" bigint,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index study_spaces_user on study_spaces ("userId");
```

- `sourceLabel`, `streak`, `dueCards`, `unitsTotal`, `unitsMastered`, `minutesToday` trong prototype là **giá trị dẫn xuất** — KHÔNG lưu cột, tính từ tracking tables theo NGÀY hiện tại `[MOCK→BE]`.
- Nguồn tài liệu lẻ (cherry-pick, `sourceType='docs'`) → dùng bảng nối `study_space_sources`.
- **Chọn file học lúc tạo space `[PM][BE]`:** KHÔNG phải file nào trong handbook cũng là học liệu. Wizard tạo space hiện danh sách file (theo `handbookId` + `relPath`) có checkbox; **tự bỏ tick sẵn file phụ trợ** — quy tắc: `relPath`/tên khớp `/^\d*[-_]?(muc[-_]?luc|ke[-_]?hoach|glossary|index|toc)/i` hoặc tiền tố `00-`, `_`. Chỉ file được tick mới materialize thành module. **Kể cả handbook**, ghi các docId được chọn vào `study_space_sources` (để reconcile §2.3.1 biết tập chủ đích).

### 2.2. `study_space_sources` — nguồn học liệu gắn vào space

```sql
create table study_space_sources (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  "order" double precision not null,
  "createdAt" bigint not null default now_ms()
);
create index study_space_sources_space on study_space_sources ("spaceId", "order");
```

> Handbook (cả cây) → không cần liệt kê từng doc ở đây; materialize trực tiếp từ `documents` theo `handbookId` + `relPath`. Bảng này cho `sourceType='docs'`.

### 2.3. `study_units` — cây lộ trình materialize

```sql
create table study_units (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "parentUnitId" text references study_units("_id") on delete cascade,  -- null = module root
  "docId" text references documents("_id") on delete set null,          -- tài liệu chứa unit này
  "unitKey" text not null,           -- "2.1.3" (leaf) hoặc "M2" (module)
  "moduleKey" text not null,         -- "M2" — index gom nhóm
  title text not null,               -- "2.1.3. Phân loại khả năng dự báo: ADI–CV²"
  "headingAnchor" text,              -- slug rehype để scroll đúng heading trong reader
  "orderIndex" double precision not null,  -- thứ tự trong cây (thứ tự học)
  depth smallint not null,           -- 0=module, 1=mục x.y, 2=tiểu mục x.y.z
  "isLeaf" boolean not null,         -- true = tiểu mục (đơn vị scope)
  chars integer,                     -- độ dài extractedText của scope (drives time estimate)
  "contentHash" text,                -- hash nội dung scope — phát hiện tài liệu đổi khi re-sync
  coarse boolean not null default false,  -- true = module chưa bung heading (ước lượng)
  orphaned boolean not null default false, -- true = unitKey đã biến mất khỏi handbook (giữ để tra cứu)
  "contentChanged" boolean not null default false, -- true = nội dung đổi sau lần materialize (đề/card có thể lệch)
  status text not null default 'new' check (status in ('new','reading','read','mastered','decayed')),
  "readPct" smallint not null default 0,
  "masteredAt" bigint,               -- mốc đạt 🟢 (để tính decay)
  "lastActiveAt" bigint,             -- lần cuối có hành động chủ động trên unit
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index study_units_space_order on study_units ("spaceId", "orderIndex");
create index study_units_space_module on study_units ("spaceId", "moduleKey");
create index study_units_parent on study_units ("parentUnitId");
create unique index study_units_space_key on study_units ("spaceId", "unitKey");
```

- `status`, `readPct` là **snapshot dẫn xuất** — cập nhật bởi trigger/logic khi có hành động (đọc, quiz, card, Feynman). `masteredAt`/`lastActiveAt` dùng cho rule decay (§3.3).
- `quizBest`, `feynmanCount`, `cardsMade` trong prototype = dẫn xuất từ tracking tables, KHÔNG lưu ở đây (join khi cần) `[MOCK→BE]`.
- **`study_units` là bản chụp (snapshot) cây handbook lúc materialize** — handbook đổi KHÔNG tự động xô lộ trình. Đồng bộ qua reconcile chủ động (§2.3.1).

#### 2.3.1. Đồng bộ khi handbook thay đổi (reconcile) `[BE]`

**Nguyên tắc `[PM]`:** snapshot ổn định — sửa/thêm/xóa tài liệu KHÔNG tự nhảy lộ trình (tránh lịch tự phình, mất cam kết). Đồng bộ là hành động chủ động của user.

**Khóa join tiến độ = `unitKey` ổn định** (vd `"2.1.3"`), KHÔNG phải `_id`. Nên `quiz_attempts`/`flashcards`/`feynman_sessions`/`study_sessions` (đều mang `unitKey`) sống qua mọi lần re-sync miễn số hiệu tiểu mục còn.

**Thao tác reconcile** (mở space hoặc nút "Đồng bộ lộ trình"): so cây handbook hiện tại vs `study_units`:

| Diff | unitKey | Xử lý | Tiến độ |
|---|---|---|---|
| Thêm mới | có ở handbook, thiếu ở units | insert `status='new'`, badge "N tiểu mục mới" | — |
| Nội dung đổi | trùng, `contentHash` khác | set `contentChanged=true`; cờ "đề/card cũ có thể lệch" + nút "Sinh lại" (attempts cũ giữ làm lịch sử) | **giữ** |
| Xóa/đổi tên | có ở units, thiếu ở handbook | set `orphaned=true` (KHÔNG hard-delete), làm mờ "(đã gỡ khỏi tài liệu)" | **giữ để tra cứu**, không tính tiến độ mới |
| Đảo thứ tự | trùng | cập nhật `orderIndex` | — |

**UX:** phát hiện lệch → banner *"Tài liệu đã thay đổi: +3 tiểu mục mới, 1 mục nội dung đổi. Cập nhật lộ trình?"* → xem diff → Áp dụng. **Không auto-apply.**

**Ảnh hưởng Plan active:** plan là snapshot riêng (§2.10) → unit mới KHÔNG tự vào lịch. Học phần mới → "Xếp lại lịch" (§3.5) gom việc chưa xong + unit mới, xếp lại từ mai. Ăn khớp Epic 12-13 (ZIP re-import handbook).

### 2.4. `study_checkpoints` — mốc "đã đọc tới đâu" `[BE]`

Prototype hardcode `CHECKPOINT_SCOPE = ["2.2.2"]`. Bản thật:

```sql
create table study_checkpoints (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "lastReviewedUnitKey" text,   -- tiểu mục cuối đã ôn (quiz/Feynman)
  "lastReadUnitKey" text,       -- tiểu mục cuối đang đọc
  "updatedAt" bigint not null default now_ms()
);
create unique index study_checkpoints_space on study_checkpoints ("spaceId");
```

- **Scope checkpoint** = các tiểu mục có `orderIndex` trong `(unit(lastReviewedUnitKey).orderIndex, unit(lastReadUnitKey).orderIndex]` và `readPct > 0`. Đây là mặc định scope Feynman "từ lần ôn trước → chỗ đang đọc". Cap 3 tiểu mục (§ Feynman).

### 2.5. `flashcards` + `review_logs`

```sql
create table flashcards (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "unitKey" text not null,       -- "2.1.3" hoặc "2.1.1 ↔ 2.1.3" cho card liên kết
  "moduleKey" text not null,
  type text not null check (type in ('concept','apply','link')),
  front text not null,
  back text not null,
  quote text,                    -- trích đoạn gốc + ref "§2.1.3.2"
  "quoteAnchor" text,            -- slug heading để nhảy về tài liệu
  "intervalDays" integer not null default 1,
  "dueAt" bigint not null,       -- mốc đến hạn ôn tiếp (epoch ms)
  "lastReviewedAt" bigint,
  "forgetCount30d" smallint not null default 0,  -- đếm "Quên" trong 30 ngày (rule CẦN HỌC LẠI)
  "aiGenerated" boolean not null default true,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index flashcards_space_unit on flashcards ("spaceId", "unitKey");
create index flashcards_space_due on flashcards ("spaceId", "dueAt");

create table review_logs (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "cardId" text not null references flashcards("_id") on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  rating text not null check (rating in ('forgot','remembered')),
  "intervalBefore" integer not null,
  "intervalAfter" integer not null,
  "reviewedAt" bigint not null default now_ms()
);
create index review_logs_card on review_logs ("cardId", "reviewedAt");
create index review_logs_space on review_logs ("spaceId", "reviewedAt");
```

- **SRS `[CODE][PM]`:** "Nhớ" → `intervalAfter = intervalBefore * 2`; "Quên" → `intervalAfter = 1` (ôn lại ngày mai). `dueAt = now + intervalAfter*86400_000`. Chưa dùng SM-2/FSRS nhưng ghi `review_logs` đầy đủ từ đầu để nâng cấp.
- `due` (đến hạn hôm nay) = `dueAt <= endOfToday`. Queue "ôn hôm nay" = tất cả card `due` toàn space, trộn thứ tự tiểu mục.

### 2.6. `section_questions` — cache đề quiz + pre-questions `[BE]`

Prototype dùng 1 bộ 5 câu global. Bản thật: cache **per tiểu mục**, sinh 1 lần.

```sql
create table section_questions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "unitKey" text not null,
  kind text not null check (kind in ('quiz','pre')),   -- quiz 3+2 | pre-questions định hướng
  questions jsonb not null,   -- QuizQuestion[] (xem §2.6.1) hoặc string[] cho pre
  "generatedAt" bigint not null default now_ms()
);
create unique index section_questions_key on section_questions ("spaceId", "unitKey", kind);
```

**§2.6.1 — shape `questions` (kind='quiz')** `[CODE]` — union 3 mcq + 2 open:
```ts
type QuizQuestion =
  | { kind: "mcq"; q: string; options: string[]; correct: number;
      explainWrong: string[]; quote: string; quoteAnchor?: string }
  | { kind: "open"; q: string; feedbackGood: string[];
      feedbackMissing: string[]; quote: string; quoteAnchor?: string };
```
`explainWrong` song song `options`, phần tử của đáp án đúng = `""`.

### 2.7. `quiz_attempts` — lịch sử làm quiz (append-only)

```sql
create table quiz_attempts (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "unitKey" text not null,
  score smallint not null,         -- 0-100
  "mcqCorrect" smallint not null,  -- số MCQ đúng /3
  "essayScore" double precision,   -- điểm tự luận thật do AI chấm /2
  answers jsonb not null,          -- AttemptAnswer[] positional (render lại bài)
  "aiFeedback" jsonb,              -- nhận xét AI cho từng câu open
  "attemptedAt" bigint not null default now_ms()
);
create index quiz_attempts_space_unit on quiz_attempts ("spaceId", "unitKey", "attemptedAt");
```

- `AttemptAnswer = { mcqPick?: number; openText?: string }` `[CODE]`.
- **Append-only `[PM]`:** làm lại KHÔNG xóa lần cũ. `quizBest` (checklist/mastery) = `max(score)`. Chip điểm cũ click được → render lại bài từ `answers` + `aiFeedback`.

### 2.8. `feynman_sessions`

```sql
create table feynman_sessions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "scopeKeys" text[] not null,       -- tiểu mục đã giảng (1-4)
  "isLinked" boolean not null default false,  -- ≥2 mục / cross-module → chấm thêm "kết nối"
  "durationSec" integer not null,
  transcript text,                   -- text đã chuyển từ audio
  rubric jsonb not null,             -- FeynmanRubric (§2.8.1)
  "attemptedAt" bigint not null default now_ms()
);
create index feynman_sessions_space on feynman_sessions ("spaceId", "attemptedAt");
```

**§2.8.1 — `rubric` shape** `[CODE]`:
```ts
type FeynmanRubric = {
  correct: string[];      // nắm đúng
  missing: string[];      // bỏ sót
  wrong: string[];        // hiểu chưa đúng
  hasExample: boolean;    // có ví dụ riêng?
  hasEdgeCase: boolean;   // có nêu giới hạn/edge case?
  followUp: string;       // câu hỏi đào sâu (AI, luôn có)
  connection?: string;    // CHỈ khi isLinked — nhận xét kết nối kiến thức giữa các mục
};
```

### 2.9. `study_sessions` — nhật ký hoạt động (→ heatmap/streak)

```sql
create table study_sessions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "activityType" text not null check ("activityType" in ('read','quiz','cards','feynman','review','station')),
  "unitKey" text,
  "activeMinutes" double precision not null default 0,  -- phút HỌC CHỦ ĐỘNG
  "isActiveRecall" boolean not null,   -- true cho quiz/cards/feynman/review (tính streak); false cho read
  "occurredAt" bigint not null default now_ms()
);
create index study_sessions_space_time on study_sessions ("spaceId", "occurredAt");
create index study_sessions_user_time on study_sessions ("userId", "occurredAt");
```

- **Streak `[PM]`** chỉ tính ngày có ≥1 session `isActiveRecall=true` (mở-ra-đọc KHÔNG tính). Khi space có plan active → streak chỉ tính trên **ngày-học-theo-lịch**; ngày ngoài weekday đã chọn là trung tính (nghỉ đúng kế hoạch không đứt chuỗi). Chưa có plan → tính mọi ngày.
- **Heatmap 12 tuần (84 ô)** `[MOCK→BE]`: mức 0–4 theo phút học chủ động/ngày: `0` · `1–10′` · `11–25′` · `26–45′` · `>45′`.

### 2.10. `study_plans` + `study_plan_tasks` — kế hoạch (snapshot) `[PM]`

**Nguyên tắc chốt `[PM]`:** bấm "Tạo kế hoạch chi tiết" = **LƯU SNAPSHOT**, KHÔNG regenerate mỗi lần mở (regenerate làm lịch tự trôi, mất cam kết; PWA + laptop phải thấy cùng 1 lịch). "Xếp lại lịch" = plan mới active, bản cũ `archived` (append-only). Tạo/xếp lại = **0 call Gemini**.

```sql
create table study_plans (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  status text not null default 'active' check (status in ('active','archived')),
  "scheduleMode" text not null default 'sequential' check ("scheduleMode" in ('sequential','tracks')),
  "selectedModuleKeys" text[] not null,    -- module tick chọn ở wizard (subset học đợt này)
  "moduleOrder" text[] not null,           -- thứ tự học (ưu tiên khi ngày chung nhiều module)
  weekdays boolean[] not null,             -- MODE sequential: [T2..CN] chung cho mọi module
  "trackAssignments" jsonb,                -- MODE tracks: { "M2":[t2..cn bool], "M3":[...], ... }
  "targetDailyMin" integer not null,
  "totalMin" integer not null,
  "startDate" bigint not null,             -- ngày bắt đầu (thường = mai)
  "projectedEndDate" bigint not null,
  "createdAt" bigint not null default now_ms(),
  "archivedAt" bigint
);
create index study_plans_space_status on study_plans ("spaceId", status);
```

**2 mô hình lịch (`scheduleMode`) `[PM]`:**
- **`sequential`** (mặc định) — 1 bộ `weekdays` chung; học hết module này sang module kế theo `moduleOrder`. Đây là mô hình prototype hiện có.
- **`tracks`** — mỗi module gán riêng các thứ trong tuần (`trackAssignments`), các module chạy **song song**. Ví dụ user: `{"M2":[T2,T4,T6], "M3":[T3,T5,T7], "M6":[CN]}`. **Cho phép 1 thứ gán nhiều module** — nhưng KHÔNG chia đôi buổi: học **tuần tự theo `moduleOrder`**, module trước học hết sạch unit rồi mới sang module sau. VD thứ 2 gán M5+M6 (M5 trước): mọi thứ 2 học M5 tới khi hết M5, các thứ 2 sau đó mới sang M6. Buổi giao nhau (M5 hết giữa buổi) → phần giờ dư học tiếp M6, không bỏ phí.

```sql

create table study_plan_tasks (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "planId" text not null references study_plans("_id") on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "dayDate" bigint not null,               -- ngày của buổi (epoch ms, 00:00)
  seq smallint not null,                   -- thứ tự trong buổi
  type text not null check (type in ('read','quiz','cards','feynman','review','station')),
  "unitKey" text,
  "docId" text references documents("_id") on delete set null,
  minutes integer not null,
  label text not null                      -- nhãn tự-giải-thích (vd "Quiz lại 2.2.3 (🔴 lâu không ôn)")
);
create index study_plan_tasks_plan_day on study_plan_tasks ("planId", "dayDate", seq);
```

- **Done-state KHÔNG lưu tay `[PM]`** — suy từ hành động học thật (readPct, quiz_attempts, review_logs, feynman_sessions) qua join theo `unitKey`+`type`. Tick tay trong prototype chỉ là mock.
- Task `review` (ôn card đến hạn) KHÔNG lưu snapshot cứng — sinh động lúc render buổi (vì phụ thuộc `dueAt` đổi theo tiến độ). Chỉ snapshot read/quiz/cards/feynman/station.

### 2.11. `notification_settings` + `push_subscriptions` `[BE]`

```sql
create table notification_settings (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null unique references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  times text[] not null default array['08:45','21:15'],  -- tối đa 4, giờ local
  timezone text not null default 'Asia/Ho_Chi_Minh',      -- UTC+7
  types jsonb not null default '{"morning":true,"evening":true}'::jsonb,
  "updatedAt" bigint not null default now_ms()
);

create table push_subscriptions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  "p256dh" text not null,
  auth text not null,
  "userAgent" text,
  "createdAt" bigint not null default now_ms()
);
create unique index push_subscriptions_endpoint on push_subscriptions (endpoint);
create index push_subscriptions_user on push_subscriptions ("userId");
```

### 2.12. RLS `[BE]`

Bật RLS + policy owner cho tất cả bảng `study_*`, `flashcards`, `review_logs`, `section_questions`, `quiz_attempts`, `feynman_sessions`, `notification_settings`, `push_subscriptions`:
```sql
alter table study_spaces enable row level security;
create policy study_spaces_owner on study_spaces for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());
-- ... lặp cho từng bảng (macro owner như 0001_init.sql dòng 419-437)
```
Realtime: thêm các bảng cần đồng bộ đa thiết bị (`flashcards`, `study_units`, `study_plan_tasks`, `study_sessions`) vào publication như `0002_realtime.sql` — **debounce + gộp subscription** theo bài học ở commit `2e9cae3` (tránh giật lag).

---

## 3. Rule engine deterministic (0 gọi AI) `[CODE][PM]`

Port nguyên `apps/web/src/components/study/plan.ts` sang lib dùng chung (client + Edge Function cho notification). **Header nguyên tắc: 100% deterministic, chạy local, KHÔNG gọi Gemini.**

### 3.1. Hằng số (giữ đúng prototype)

```ts
READ_CHARS_PER_MIN = 600           // ký tự/phút đọc tiếng Việt kỹ thuật
ACT_MIN = { quiz: 10, cards: 12, feynman: 8, review: 10, station: 15 }  // phút/hoạt động
DEFAULT_UNIT_CHARS = 43000         // độ dài tiểu mục fallback
MIN_READ_SPLIT = 15                // phút tối thiểu 1 lát "đọc" khi tách phiên
WEEKDAY_LABELS = ["T2","T3","T4","T5","T6","T7","CN"]
mondayIndex(d) = (d.getDay() + 6) % 7   // 0=T2 … 6=CN
```
> Định mức prototype — user xem UI rồi chốt. Nếu đổi, đổi hằng số ở 1 chỗ.

### 3.2. Ước lượng khối lượng & khuyến nghị nhịp

- `leafTasks(unit)` — task còn thiếu của 1 tiểu mục, thứ tự cố định:
  1. `readMin = round(chars*(1-readPct/100) / 600)`; push `read` nếu `readMin ≥ 3`. Nhãn `+ " (phần còn lại)"` nếu `readPct > 0`.
  2. nếu `quizBest < 80`: push `quiz` (10′). Nhãn tự-giải-thích: `"Quiz lại X (🔴 lâu không ôn)"` (decayed) / `"Quiz lại X (mới N%, cần ≥80%)"` (đã làm) / `"Quiz X"` (lần đầu).
  3. nếu `status ≠ decayed`: `!cardsMade` → push `cards` (12′); `feynmanCount==0` → push `feynman` (8′).
  → **Unit decayed chỉ xếp lại quiz** (đúng banner "làm lại quiz để xanh trở lại").
- `coarseTasks(unit)` — module chưa bung: `est = max(1, round(charsCònLại / 43000))` lát; mỗi lát push read+quiz+cards+feynman. **`[MOCK→BE]` thay bằng heading khi nạp markdown.**
- `treeTasks(unit)` — duyệt mục x.y → tiểu mục; sau mỗi mục có việc → push `station` (15′) "Trạm tổng kết X".
- `buildModuleLoads(space)` — bỏ module `mastered`; `defaultOn = status ≠ 'new'` (module đang học dở/decayed tick sẵn ở wizard).
- `recommendDays(totalMin, target=60) = ceil(totalMin / (target - 10))` = `ceil(totalMin/50)` (chừa 10′ ôn/ngày).
- `dailyMinutesFor(totalMin, days) = ceil(totalMin/days) + 10`. Live 2 chiều: đổi days ↔ perDay.
- Cảnh báo: `perDay > 150` → "Nặng"; `0 < perDay < 25` → "Nhẹ".
- `projectedEndDate(days, weekdays, from)` — đếm tới từ mai, chỉ ngày weekday chọn.

### 3.3. Mastery & Decay `[PM]`

- **Mastery (🟢):** đủ 4 việc — `readPct ≥ 100` AND `quizBest ≥ 80` AND `cardsMade` AND `feynmanCount ≥ 1`. Đạt → `status='mastered'`, set `masteredAt`.
- **Decay (🔴) `[BE]`:** unit `mastered` mà `now - lastActiveAt > 21 ngày` (hành động chủ động cuối) → `status='decayed'`. **Prototype chưa có hàm này — BE phải xây** (job định kỳ hoặc tính lazy khi render). Thoát decay: quiz lại ≥ 80% → về `mastered`.
- **Ngưỡng đã chốt (2026-07-16):** quiz **≥ 80%** = "Vững"; phai **21 ngày**. Có thể tinh chỉnh sau khi dùng thật (gom vào file hằng số).

### 3.4. Bin-packing lịch — `buildSchedule(tasks, dailyMin, weekdays, from)`

Giữ **đúng thuật toán prototype**:
1. Guard: `[]` nếu không chọn weekday nào / không task.
2. `queue` = copy tasks **giữ nguyên thứ tự cây** (không re-sort ưu tiên).
3. Bắt đầu từ mai; bỏ ngày không phải weekday chọn (`while !weekdays[mondayIndex(d)] d++`).
4. Mỗi ngày **từ ngày 2 trở đi** tự chèn task `review` "Ôn flashcard đến hạn" (10′), trừ vào `cap`. Ngày 1 không có (chưa có gì để ôn).
5. Nạp `while queue.length && cap >= 5`:
   - `next.minutes <= cap` → lấy nguyên.
   - else nếu `next.type=='read'` && `cap >= 15` && `next.minutes - cap >= 15` → **tách**: đẩy lát `minutes: cap` vào hôm nay, phần dư requeue nhãn `+ " (tiếp)"` (guard chống double-suffix).
   - else nếu ngày chưa có task non-review nào → **nhét nguyên task quá khổ** vào ngày trống này, cho vượt budget (`cap=0`) — chống 1 task lớn không tách được (quiz/cards/feynman/station **không bao giờ tách**, chỉ `read` tách được) làm treo lịch.
   - else `break` → sang ngày kế.
6. Guard cứng `guard++ < 1500` chống vòng lặp vô hạn.

### 3.4b. Bin-packing mode `tracks` — `buildScheduleTracks(loads, assignments, moduleOrder, dailyMin, from)` `[PM][BE]`

Mô hình song song (mới — chưa có trong prototype). Mỗi module có **1 hàng đợi FIFO task còn lại** (thứ tự cây unit). Với mỗi ngày lịch (từ mai):
1. Tìm các module **sở hữu** thứ đó CÒN task: `owners = moduleOrder.filter(m => assignments[m][mondayIndex(d)] && queue[m].length)`.
2. Bỏ ngày nếu `owners` rỗng.
3. **Nạp TUẦN TỰ theo `moduleOrder`, KHÔNG chia đôi buổi:** rút hết `queue[owners[0]]` trước; chỉ khi cạn mới rút `queue[owners[1]]`, v.v. → module ưu tiên độc chiếm các buổi của thứ đó tới khi hết sạch unit; module sau chỉ xuất hiện từ buổi module trước cạn (buổi giao nhau nạp tiếp để không phí `cap`).
4. Chèn `review` (10′) từ ngày 2 như §3.4; pack theo `dailyMin` với cùng luật tách `read` / nhét-quá-khổ / break.
5. Mọi owner của ngày đã hết → ngày đó chỉ còn `review` (nghỉ học phần mới). **KHÔNG auto-chuyển module KHÔNG-sở-hữu-thứ-đó** — theo quyết định "hỏi khi xếp lịch" (§3.5). (Lưu ý phân biệt: trong CÙNG một thứ, chuyển sang module kế trong `owners` là tự động ở bước 3; còn chuyển sang module thuộc thứ KHÁC thì không.)
6. Dừng khi mọi module hết task (hoặc guard). `projectedEndDate` = ngày cuối có task.

- **Ước lượng nhịp mode tracks:** không có `recommendDays` dạng đóng — rule **mô phỏng** (chạy `buildScheduleTracks`) rồi báo ngày xong dự kiến + tải trung bình/ngày; cảnh báo ngày nào vượt ngưỡng nặng. UI hiện "với cách gán này, dự kiến xong {ngày}, ~{phút}/buổi".

### 3.5. Xếp lại lịch (reschedule), đổi thứ tự & carry-over `[PM]`

- **Việc dở KHÔNG auto-trượt** sang ngày sau — lịch giữ nguyên; buổi trễ viền vàng + đếm "N buổi chưa hoàn thành". Lý do: auto-trượt làm ngày kết thúc trôi vô hình, trái nguyên tắc "hậu quả nhìn thấy được".
- **"Xếp lại lịch"** = hành động chủ động: `buildSchedule`/`buildScheduleTracks(remaining, ..., from=today)` — dồn task chưa `done`, xếp lại từ mai, plan cũ archived. Bỏ task `review` khỏi `remaining` (regenerate).
- **Đổi thứ tự / gán lại thứ giữa chừng `[PM]`:** kéo-thả `moduleOrder` hoặc sửa `trackAssignments` → bấm "Xếp lại lịch" → rule áp cấu hình mới cho task **chưa xong**, plan mới active. Việc đã xong không đụng (join `unitKey`). Đây là cách duy nhất đổi thứ tự (plan là snapshot, không mutate tại chỗ).
- **Module xong sớm (mode tracks) `[PM]`:** các thứ của module đã xong để trống (chỉ còn `review`) — KHÔNG auto-nạp module kế. Panel tiến độ hiện gợi ý "M2 đã xong — còn {N} buổi T2/4/6 trống, Xếp lại lịch để dồn phần còn lại?" → user tự quyết.
- **Carry-over hiển thị `[BE]`:** khối "HÔM NAY" phải tự gom việc dở của buổi đã qua (vd "còn nợ Quiz 2.2.3 từ hôm qua") dù lịch không đổi. Prototype chưa mô phỏng (todayMenu seed tĩnh).
- **"Behind" detection:** ngày `date < today` mà còn task chưa done.

---

## 4. Tích hợp AI (Gemini on-demand) `[PM][BE]`

**Nguyên tắc bất di `[PM]`:** AI sinh **on-demand tại thời điểm user bấm hành động lần đầu** cho tiểu mục đó (1 call đúng scope) → cache DB. **TUYỆT ĐỐI không pre-generate** hàng loạt cho cả handbook (23+ call vỡ quota). Làm lại dùng đề cache (0 call).

Dùng key Gemini của user trong `userAiSettings.geminiApiKey` + `geminiModels` (map task→model). Pattern route giống `api/transcribe-audio-gemini/route.ts` hiện có. Structured output (JSON schema) cho mọi call.

### 4.1. Các call AI (đúng 3 loại tốn call)

| Hành động | Khi nào | Input | Output (cache vào) | Call |
|---|---|---|---|---|
| **Sinh quiz 3+2** | lần đầu bấm Quiz 1 tiểu mục | extractedText scope tiểu mục | `section_questions(kind='quiz')` | 1 |
| **Sinh flashcard** | lần đầu bấm Tạo card | extractedText scope tiểu mục | `flashcards` (user duyệt trước khi lưu) | 1 |
| **Chấm Feynman** | bấm dừng thu | audio + extractedText N tiểu mục | `feynman_sessions.rubric` (không cache tái dùng) | 1 (gộp transcribe+chấm) |
| **Sinh pre-questions** | mở section chưa đọc (optional v1) | extractedText scope | `section_questions(kind='pre')` | 1 |
| **Chấm 2 câu tự luận quiz** | nộp quiz | 2 answer + đáp án mẫu | `quiz_attempts.essayScore/aiFeedback` | gộp trong nộp quiz |

> Prototype: essay hardcode 1.5/2, mic mock. **BE thay bằng chấm thật.** Feynman = 1 call gộp audio→text + đối chiếu tài liệu + rubric.

### 4.2. Yêu cầu prompt (few-shot từ seed) `[PM]`

- **Mật độ card chốt `[PM]`:** tiểu mục handbook này rất dày (4 tầng, ~43k ký tự) → sinh **8–12 card/tiểu mục**, phủ đủ 4 tầng (trực giác → công thức → giải số → giới hạn/nhân quả) × 3 loại (concept/apply/link). 1–2 card là KHÔNG đủ. **Seed few-shot chuẩn:** tiểu mục 2.1.3 có bộ 10 card đầy đủ (trong mock.ts) → dùng làm ví dụ trong prompt.
- **Quiz:** 3 MCQ tầng vận dụng (mỗi đáp án sai có `explainWrong`) + 2 tự luận ngắn; **mọi câu kèm `quote` trích đoạn gốc** (chống hallucinate + click nhảy về tài liệu). Prompt yêu cầu trả `quoteAnchor` khớp heading.
- **Feynman linked (≥2 mục):** đưa text N tiểu mục + yêu cầu rubric thêm mục `connection` (kết nối kiến thức, kể cả cross-module).
- **Chống hallucinate (bug đã biết):** Gemini hay wrap JSON trong text field / bịa "Đúng không?" — prompt + parser phải strip, validate schema, retry nếu mismatch (theo `project_transcript_bugs`).

### 4.3. Quota guard `[BE]`

- Map task → model (task nhẹ dùng model rẻ). Bắt lỗi 429 → toast "Hết quota Gemini hôm nay — mọi tính năng ôn (không AI) vẫn chạy; thử lại mai". Không chặn ôn card/xem lại.
- Đếm call/ngày để cảnh báo sớm khi gần trần.

---

## 5. Routing & điều phối ngữ cảnh `[CODE]`

### 5.1. URL scheme (deep-link được, bookmark/hard-reload OK)

```
/study                        → danh sách space
/study/:spaceId               → tab Tổng quan (overview)
/study/:spaceId/:tab          → tab ∈ {plan, review, quiz, feynman}
```
- Route Next: optional catch-all `app/study/[[...slug]]/page.tsx` (return null — render bởi AppShell keep-alive).
- `StudyPageInner` sync 2 chiều: điều hướng nội bộ = `history.pushState` (không full route change, giữ panel mounted); URL đổi từ ngoài (back/forward, sidebar, deep-link) → `useEffect` trên `usePathname` parse lại state. Guard `if (!pathname.startsWith("/study")) return` (giữ state khi sang /reader).
- **Invalid coercion:** spaceId không khớp → về danh sách; tab lạ → về overview. Không 404.
- `focusCtx` (highlight tiểu mục) là **state tạm KHÔNG lên URL** — chủ đích, chỉ có nghĩa trong luồng điều phối. `[BE]`: spaceId là id thật từ DB.

### 5.2. `GoTab(tab, ctx)` — điều phối có ngữ cảnh `[PM]`

`type GoTab = (tab, ctx?: { sectionId?: string; unitKey?: string }) => void`. **Mọi hành động trong checklist/plan khi nhảy tab PHẢI mang ngữ cảnh** (không nhảy chung chung):

| Từ | Tới | ctx | Hành vi tab đích |
|---|---|---|---|
| Checklist "Quiz" | `quiz` | `{sectionId}` | scroll + ring section, nhãn "quiz của tiểu mục bạn vừa chọn", hiện cả section chưa có lịch sử |
| Checklist "Tạo card" | `review` | `{unitKey}` | mở bộ card đúng tiểu mục (ring + "← tiểu mục bạn vừa chọn"), về library (không giữa phiên) |
| Checklist "Giảng" | `feynman` | `{unitKey}` | checklist mode: khóa scope = [unitKey], phiên cũ highlight/mở sẵn |
| Checklist "Đọc" | reader | `docId` + `headingAnchor` | mở reader, **scroll đúng heading** (rehype-slug) `[MOCK→BE]` |
| Task trong Plan | tab tương ứng | như trên | click nhãn = điều hướng; tick done = chấm tròn riêng đầu dòng |

- Cả dòng checklist là nút (hit-target lớn), không chỉ nút nhỏ bên phải.
- Task thuộc module coarse (chưa nạp) → toast "chưa nạp".

---

## 6. Provenance & phần phải xây (tóm tắt cho dev)

| Hạng mục | Trạng thái |
|---|---|
| UI 5 tab + Plan + danh sách space | ✅ `[CODE]` — lấy làm chuẩn |
| Rule engine `plan.ts` (build schedule, ước lượng) | ✅ `[CODE]` — port sang lib dùng chung |
| Routing/deep-link + GoTab | ✅ `[CODE]` |
| Toàn bộ schema `study_*` + RLS + realtime | 🔨 `[BE]` §2 |
| Decay-over-time, streak, heatmap tính thật | 🔨 `[MOCK→BE]` §3.3, §2.9 |
| study_checkpoints tính scope thật | 🔨 `[BE]` §2.4 |
| Gemini: sinh quiz/card, chấm Feynman, chấm tự luận | 🔨 `[MOCK→BE]` §4 |
| Scroll đúng heading trong reader | 🔨 `[MOCK→BE]` §5.2 |
| Push PWA (VAPID + Edge Function + pg_cron) | 🔨 `[BE]` → xem SPEC-FEATURES §7 |
| Nút chết: "Tạo flashcard từ câu sai", "gõ thay vì nói" | 🔨 wire BE |

→ **Chi tiết I/O matrix + acceptance từng tính năng:** [SPEC-FEATURES.md](./SPEC-FEATURES.md)
