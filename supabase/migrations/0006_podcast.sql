-- ============================================================================
-- Web Knowledge Base — Module "Podcast" — schema
-- Series sinh từ 1 handbook (nhiều file) hoặc 1 tài liệu lẻ; chia tập theo lượng kiến thức
-- (~9k ký tự nguồn/tập, KHÔNG nén cho vừa thời lượng). Kịch bản 2 giọng do Gemini viết
-- on-demand, Azure đọc (MP3 cache R2 ở route /api/tts — không lưu DB).
-- Quy ước như 0001/0005: PK "_id" text, epoch ms, cột camelCase có quote.
-- ============================================================================

-- ─── PODCAST_SERIES ──────────────────────────────────────────────────────────
create table podcast_series (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  title text not null,
  emoji text,
  "sourceType" text not null check ("sourceType" in ('handbook','doc')),
  "handbookId" text references handbooks("_id") on delete set null,
  "docIds" text[] not null,                -- nguồn theo thứ tự nghe
  "targetChars" integer not null default 9000,
  "archivedAt" bigint,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index podcast_series_user on podcast_series ("userId");

-- ─── PODCAST_EPISODES (nhẹ — được realtime; KHÔNG chứa kịch bản) ─────────────
-- sections: [{ docId, title, headingText?, anchor?, unitKey?, partFrom?, partTo?, partLabel?,
--              lastPart?, pageFrom?, pageTo?, chars }]
create table podcast_episodes (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "seriesId" text not null references podcast_series("_id") on delete cascade,
  "orderIndex" double precision not null,
  title text not null,
  sections jsonb not null,
  "sourceChars" integer not null default 0,
  status text not null default 'draft' check (status in ('draft','generating','ready','error')),
  "keyPointCount" integer,
  "coveredCount" integer,                  -- số ý bắt buộc được lượt thoại phủ
  "turnCount" integer,
  "scriptChars" integer,                   -- ước lượng thời lượng (~1000 ký tự/phút)
  "progressIndex" integer not null default 0,  -- lượt thoại đang nghe
  "completedAt" bigint,
  "recallDoneAt" bigint,
  error text,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index podcast_episodes_series on podcast_episodes ("seriesId", "orderIndex");

-- ─── PODCAST_SCRIPTS (nặng — tách bảng, KHÔNG realtime; bài học I/O Convex) ───
-- script: { keyPoints: string[], turns: [{ s: 'host'|'expert', t: string, c: number[] }],
--           recall: [{ q, a }] }
create table podcast_scripts (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "episodeId" text not null unique references podcast_episodes("_id") on delete cascade,
  script jsonb not null,
  model text,
  "createdAt" bigint not null default now_ms()
);

-- ─── RLS (owner-only) ─────────────────────────────────────────────────────────
alter table podcast_series   enable row level security;
alter table podcast_episodes enable row level security;
alter table podcast_scripts  enable row level security;

create policy podcast_series_owner   on podcast_series   for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy podcast_episodes_owner on podcast_episodes for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy podcast_scripts_owner  on podcast_scripts  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());

-- ─── REALTIME (series + episodes; scripts không cần) ─────────────────────────
alter publication supabase_realtime add table podcast_series;
alter publication supabase_realtime add table podcast_episodes;
alter table podcast_series   replica identity full;
alter table podcast_episodes replica identity full;
