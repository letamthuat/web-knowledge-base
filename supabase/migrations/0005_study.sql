-- ============================================================================
-- Web Knowledge Base — Module "Học tập" (Study) — schema (Phase Study)
-- Theo 01-specs/study/SPEC.md §2. Chạy sau 0001-0004.
-- Quy ước (khớp 0001_init.sql): PK "_id" text, "_creationTime" bigint(ms),
-- "userId" uuid → auth.users, timestamp = epoch ms, cột camelCase có quote.
-- Rule-first: mọi lịch/ước lượng deterministic (0 Gemini); AI chỉ sinh quiz/card/chấm.
-- ============================================================================

-- ─── STUDY_SPACES ────────────────────────────────────────────────────────────
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

-- ─── STUDY_SPACE_SOURCES (nguồn học liệu gắn vào space) ───────────────────────
-- Kể cả handbook: ghi các docId ĐƯỢC CHỌN học (loại 00-*/_glossary) để reconcile biết tập chủ đích.
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

-- ─── STUDY_UNITS (cây lộ trình materialize, eager lúc tạo space) ──────────────
create table study_units (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "parentUnitId" text references study_units("_id") on delete cascade,  -- null = module root
  "docId" text references documents("_id") on delete set null,
  "unitKey" text not null,                 -- "2.1.3" (leaf) hoặc "M2" (module)
  "moduleKey" text not null,               -- "M2" — index gom nhóm
  title text not null,
  "headingAnchor" text,                    -- slug rehype scroll đúng heading trong reader
  "orderIndex" double precision not null,  -- thứ tự trong cây (thứ tự lộ trình mặc định)
  depth smallint not null,                 -- 0=module, 1=mục x.y, 2=tiểu mục x.y.z
  "isLeaf" boolean not null,               -- true = tiểu mục (đơn vị scope)
  chars integer,                           -- độ dài extractedText scope (drives time estimate)
  "contentHash" text,                      -- phát hiện tài liệu đổi khi reconcile
  coarse boolean not null default false,   -- true = chưa bung heading (ước lượng)
  orphaned boolean not null default false, -- true = unitKey đã biến mất khỏi handbook (giữ tra cứu)
  "contentChanged" boolean not null default false, -- nội dung đổi sau materialize (đề/card có thể lệch)
  status text not null default 'new' check (status in ('new','reading','read','mastered','decayed')),
  "readPct" smallint not null default 0,
  "masteredAt" bigint,                     -- mốc đạt 🟢 (tính decay)
  "lastActiveAt" bigint,                   -- lần cuối có hành động chủ động trên unit
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index study_units_space_order on study_units ("spaceId", "orderIndex");
create index study_units_space_module on study_units ("spaceId", "moduleKey");
create index study_units_parent on study_units ("parentUnitId");
create unique index study_units_space_key on study_units ("spaceId", "unitKey");

-- ─── STUDY_CHECKPOINTS (mốc "đã đọc/ôn tới đâu") ──────────────────────────────
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

-- ─── FLASHCARDS ───────────────────────────────────────────────────────────────
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
  "quoteAnchor" text,            -- slug heading nhảy về tài liệu
  "intervalDays" integer not null default 1,
  "dueAt" bigint not null,       -- mốc đến hạn ôn tiếp (epoch ms)
  "lastReviewedAt" bigint,
  "forgetCount30d" smallint not null default 0,  -- đếm "Quên"/30 ngày (rule CẦN HỌC LẠI)
  "aiGenerated" boolean not null default true,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index flashcards_space_unit on flashcards ("spaceId", "unitKey");
create index flashcards_space_due on flashcards ("spaceId", "dueAt");

-- ─── REVIEW_LOGS (append-only, SRS interval*2 / reset về mai) ─────────────────
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

-- ─── SECTION_QUESTIONS (cache đề quiz 3+2 / pre-questions, sinh 1 lần/tiểu mục) ─
create table section_questions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "unitKey" text not null,
  kind text not null check (kind in ('quiz','pre')),
  questions jsonb not null,      -- QuizQuestion[] (mcq|open) hoặc string[] cho pre
  "generatedAt" bigint not null default now_ms()
);
create unique index section_questions_key on section_questions ("spaceId", "unitKey", kind);

-- ─── QUIZ_ATTEMPTS (append-only; lưu answers JSON để render lại bài) ──────────
create table quiz_attempts (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "unitKey" text not null,
  score smallint not null,         -- 0-100
  "mcqCorrect" smallint not null,  -- số MCQ đúng /3
  "essayScore" double precision,   -- điểm tự luận AI chấm /2
  answers jsonb not null,          -- AttemptAnswer[] positional
  "aiFeedback" jsonb,              -- nhận xét AI từng câu open
  "attemptedAt" bigint not null default now_ms()
);
create index quiz_attempts_space_unit on quiz_attempts ("spaceId", "unitKey", "attemptedAt");

-- ─── FEYNMAN_SESSIONS ─────────────────────────────────────────────────────────
create table feynman_sessions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "scopeKeys" text[] not null,       -- tiểu mục đã giảng (1-4)
  "isLinked" boolean not null default false,  -- ≥2 mục/cross-module → chấm thêm "connection"
  "durationSec" integer not null,
  transcript text,                   -- text chuyển từ audio
  rubric jsonb not null,             -- FeynmanRubric (correct/missing/wrong/hasExample/hasEdgeCase/followUp/connection?)
  "attemptedAt" bigint not null default now_ms()
);
create index feynman_sessions_space on feynman_sessions ("spaceId", "attemptedAt");

-- ─── STUDY_SESSIONS (nhật ký hoạt động → heatmap/streak) ──────────────────────
create table study_sessions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  "activityType" text not null check ("activityType" in ('read','quiz','cards','feynman','review','station')),
  "unitKey" text,
  "activeMinutes" double precision not null default 0,  -- phút HỌC CHỦ ĐỘNG
  "isActiveRecall" boolean not null,   -- true: quiz/cards/feynman/review (tính streak); false: read
  "occurredAt" bigint not null default now_ms()
);
create index study_sessions_space_time on study_sessions ("spaceId", "occurredAt");
create index study_sessions_user_time on study_sessions ("userId", "occurredAt");

-- ─── STUDY_PLANS (snapshot; xếp lại = plan mới active, cũ archived) ───────────
create table study_plans (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "spaceId" text not null references study_spaces("_id") on delete cascade,
  status text not null default 'active' check (status in ('active','archived')),
  "scheduleMode" text not null default 'sequential' check ("scheduleMode" in ('sequential','tracks')),
  "selectedModuleKeys" text[] not null,    -- module tick chọn (subset học đợt này)
  "moduleOrder" text[] not null,           -- thứ tự học (ưu tiên khi ngày chung nhiều module)
  weekdays boolean[] not null,             -- MODE sequential: [T2..CN] chung cho mọi module
  "trackAssignments" jsonb,                -- MODE tracks: { "M2":[t2..cn bool], "M3":[...], ... }
  "targetDailyMin" integer not null,
  "totalMin" integer not null,
  "startDate" bigint not null,
  "projectedEndDate" bigint not null,
  "createdAt" bigint not null default now_ms(),
  "archivedAt" bigint
);
create index study_plans_space_status on study_plans ("spaceId", status);

-- ─── STUDY_PLAN_TASKS (snapshot từng việc; done-state suy từ hành động thật) ──
-- Task 'review' (ôn card đến hạn) KHÔNG snapshot cứng — sinh động lúc render.
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
  label text not null                      -- nhãn tự-giải-thích
);
create index study_plan_tasks_plan_day on study_plan_tasks ("planId", "dayDate", seq);

-- ─── NOTIFICATION_SETTINGS (push PWA — nhắc học, 0 Gemini) ────────────────────
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

-- ─── PUSH_SUBSCRIPTIONS (Web Push VAPID, mỗi thiết bị 1 dòng) ─────────────────
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

-- ============================================================================
-- ROW LEVEL SECURITY — owner ("userId" = auth.uid()), giống 0001_init.sql
-- ============================================================================
alter table study_spaces          enable row level security;
alter table study_space_sources   enable row level security;
alter table study_units           enable row level security;
alter table study_checkpoints     enable row level security;
alter table flashcards            enable row level security;
alter table review_logs           enable row level security;
alter table section_questions     enable row level security;
alter table quiz_attempts         enable row level security;
alter table feynman_sessions      enable row level security;
alter table study_sessions        enable row level security;
alter table study_plans           enable row level security;
alter table study_plan_tasks      enable row level security;
alter table notification_settings enable row level security;
alter table push_subscriptions    enable row level security;

create policy study_spaces_owner          on study_spaces          for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy study_space_sources_owner   on study_space_sources   for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy study_units_owner           on study_units           for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy study_checkpoints_owner     on study_checkpoints     for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy flashcards_owner            on flashcards            for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy review_logs_owner           on review_logs           for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy section_questions_owner     on section_questions     for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy quiz_attempts_owner         on quiz_attempts         for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy feynman_sessions_owner      on feynman_sessions      for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy study_sessions_owner        on study_sessions        for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy study_plans_owner           on study_plans           for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy study_plan_tasks_owner      on study_plan_tasks      for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy notification_settings_owner on notification_settings for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy push_subscriptions_owner    on push_subscriptions    for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());

-- ============================================================================
-- REALTIME — đồng bộ đa thiết bị (PWA + laptop). RLS được tôn trọng.
-- REPLICA IDENTITY FULL để UPDATE/DELETE về được (giống 0003).
-- notification_settings/push_subscriptions/section_questions KHÔNG cần realtime.
-- ============================================================================
alter publication supabase_realtime add table study_spaces;
alter publication supabase_realtime add table study_units;
alter publication supabase_realtime add table study_checkpoints;
alter publication supabase_realtime add table flashcards;
alter publication supabase_realtime add table review_logs;
alter publication supabase_realtime add table quiz_attempts;
alter publication supabase_realtime add table feynman_sessions;
alter publication supabase_realtime add table study_sessions;
alter publication supabase_realtime add table study_plans;
alter publication supabase_realtime add table study_plan_tasks;

alter table study_spaces      replica identity full;
alter table study_units       replica identity full;
alter table study_checkpoints replica identity full;
alter table flashcards        replica identity full;
alter table review_logs       replica identity full;
alter table quiz_attempts     replica identity full;
alter table feynman_sessions  replica identity full;
alter table study_sessions    replica identity full;
alter table study_plans       replica identity full;
alter table study_plan_tasks  replica identity full;
