-- ============================================================================
-- Web Knowledge Base — Supabase Postgres schema (Phase 1)
-- Dịch từ convex/schema.ts. Chạy trong Supabase SQL Editor (hoặc supabase db push).
-- Quy ước: PK "_id" text, "_creationTime" bigint(ms), camelCase cột, timestamp = epoch ms.
-- ============================================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ─── ENUM TYPES ─────────────────────────────────────────────────────────────
create type document_format as enum ('pdf','epub','docx','pptx','image','audio','video','markdown','web_clip');
create type storage_backend as enum ('convex','r2','b2');
create type document_status as enum ('processing','ready','error','trashed');
create type position_type   as enum ('pdf_page','epub_cfi','time_seconds','scroll_pct','slide_index');
create type highlight_color as enum ('yellow','green','blue','pink','purple','custom');
create type highlight_type  as enum ('text','bookmark','timestamp');
create type share_role      as enum ('owner','editor','commenter','viewer');
create type transcript_status as enum ('pending','processing','completed','error');
create type upload_status   as enum ('in_progress','completed','aborted');

-- Helper: epoch ms hiện tại
create or replace function now_ms() returns bigint
  language sql stable as $$ select (extract(epoch from now())*1000)::bigint $$;

-- ─── PROFILES (extend auth.users) ───────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  image text,
  "twoFactorEnabled" boolean not null default false,
  "twoFactorSecret" text,
  "backupCodes" text[],
  preferences jsonb,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);

-- Tự tạo profile khi user đăng ký (Supabase Auth)
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── DOMAINS ────────────────────────────────────────────────────────────────
create table domains (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  "order" double precision not null,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index domains_user_order on domains ("userId", "order");

-- ─── HANDBOOKS ──────────────────────────────────────────────────────────────
create table handbooks (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "domainId" text not null references domains("_id") on delete cascade,
  name text not null,
  color text,
  "order" double precision not null,
  "emptyFolders" text[],
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index handbooks_user on handbooks ("userId");
create index handbooks_domain on handbooks ("domainId");

-- ─── FOLDERS ────────────────────────────────────────────────────────────────
create table folders (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  name text not null,
  "parentFolderId" text references folders("_id") on delete cascade,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index folders_user_parent on folders ("userId", "parentFolderId");

-- ─── TAGS ───────────────────────────────────────────────────────────────────
create table tags (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  "createdAt" bigint not null default now_ms()
);
create index tags_user_name on tags ("userId", name);

-- ─── DOCUMENTS ──────────────────────────────────────────────────────────────
create table documents (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format document_format not null,
  "fileSizeBytes" double precision,
  "durationMs" double precision,
  "mimeType" text,
  "storageBackend" storage_backend not null,
  "storageKey" text not null,
  "handbookId" text references handbooks("_id") on delete set null,
  "relPath" text,
  "sourceUrl" text,
  "clippedContent" text,
  status document_status not null,
  "trashedAt" bigint,
  "restoredAt" bigint,
  "extractedText" text,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms(),
  "lastOpenedAt" bigint,
  -- FTS: title + extractedText. 'simple' = tokenize không stemming (hợp tiếng Việt).
  "searchVector" tsvector generated always as (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce("extractedText",''))
  ) stored
);
create index documents_user_status on documents ("userId", status);
create index documents_user_format on documents ("userId", format);
create index documents_user_created on documents ("userId", "createdAt");
create index documents_handbook on documents ("handbookId");
create index documents_handbook_path on documents ("handbookId", "relPath");
create index documents_search on documents using gin ("searchVector");

-- ─── DOCUMENT_TAGS (m2m) ────────────────────────────────────────────────────
create table document_tags (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  "tagId" text not null references tags("_id") on delete cascade,
  "createdAt" bigint not null default now_ms()
);
create index document_tags_doc on document_tags ("docId");
create index document_tags_tag on document_tags ("tagId");
create unique index document_tags_doc_tag on document_tags ("docId", "tagId");

-- ─── DOCUMENT_FOLDERS ───────────────────────────────────────────────────────
create table document_folders (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  "folderId" text not null references folders("_id") on delete cascade,
  "createdAt" bigint not null default now_ms()
);
create index document_folders_doc on document_folders ("docId");
create index document_folders_folder on document_folders ("folderId");

-- ─── READING_PROGRESS ───────────────────────────────────────────────────────
create table reading_progress (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  "positionType" position_type not null,
  "positionValue" text not null,
  "progressPct" double precision,
  "updatedAt" bigint not null default now_ms(),
  "clientMutationId" text
);
create unique index reading_progress_user_doc on reading_progress ("userId", "docId");
create index reading_progress_user_updated on reading_progress ("userId", "updatedAt");

-- ─── READING_HISTORY ────────────────────────────────────────────────────────
create table reading_history (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  "openedAt" bigint not null,
  "positionType" position_type,
  "positionValue" text
);
create index reading_history_user_opened on reading_history ("userId", "openedAt");
create index reading_history_user_doc_opened on reading_history ("userId", "docId", "openedAt");

-- ─── TABS ───────────────────────────────────────────────────────────────────
create table tabs (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  "order" double precision not null,
  "isActive" boolean not null,
  "scrollState" text,
  "updatedAt" bigint not null default now_ms(),
  "clientMutationId" text
);
create index tabs_user_order on tabs ("userId", "order");

-- ─── NOTE_TABS ──────────────────────────────────────────────────────────────
-- (FK noteId thêm sau khi tạo notes — xem cuối file)
create table note_tabs (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "noteId" text not null,
  title text not null,
  "order" double precision not null,
  "isActive" boolean not null,
  "updatedAt" bigint not null default now_ms()
);
create index note_tabs_user_note on note_tabs ("userId", "noteId");

-- ─── HIGHLIGHTS ─────────────────────────────────────────────────────────────
create table highlights (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text not null references documents("_id") on delete cascade,
  color highlight_color not null,
  type highlight_type not null,
  "positionType" position_type not null,
  "positionValue" text not null,
  "selectedText" text,
  note text,
  "customColor" text,
  "voiceNoteStorageId" text,
  "updatedAt" bigint not null default now_ms(),
  "createdAt" bigint not null default now_ms(),
  "clientMutationId" text
);
create index highlights_user_doc on highlights ("userId", "docId");
create index highlights_doc on highlights ("docId");

-- ─── NOTES ──────────────────────────────────────────────────────────────────
create table notes (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text references documents("_id") on delete set null,
  "highlightId" text references highlights("_id") on delete set null,
  title text,
  body text not null,
  "tagIds" text[],
  "updatedAt" bigint not null default now_ms(),
  "createdAt" bigint not null default now_ms(),
  "clientMutationId" text,
  "searchVector" tsvector generated always as (to_tsvector('simple', coalesce(body,''))) stored
);
create index notes_user_doc on notes ("userId", "docId");
create index notes_user_updated on notes ("userId", "updatedAt");
create index notes_search on notes using gin ("searchVector");

-- FK note_tabs.noteId → notes (giờ notes đã tồn tại)
alter table note_tabs
  add constraint note_tabs_note_fk foreign key ("noteId") references notes("_id") on delete cascade;

-- ─── DOCUMENT_SHARES ────────────────────────────────────────────────────────
create table document_shares (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "docId" text not null references documents("_id") on delete cascade,
  "ownerId" uuid not null references auth.users(id) on delete cascade,
  "sharedWithEmail" text not null,
  "sharedWithUserId" uuid references auth.users(id) on delete set null,
  role share_role not null,
  "createdAt" bigint not null default now_ms(),
  "revokedAt" bigint
);
create index document_shares_doc on document_shares ("docId");
create index document_shares_owner on document_shares ("ownerId");
create index document_shares_email on document_shares ("sharedWithEmail");

-- ─── TELEMETRY_EVENTS ───────────────────────────────────────────────────────
create table telemetry_events (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  event text not null,
  "latencyMs" double precision,
  "deviceId" text,
  meta jsonb,
  "createdAt" bigint not null default now_ms()
);
create index telemetry_user_event on telemetry_events ("userId", event);
create index telemetry_event_ts on telemetry_events (event, "createdAt");

-- ─── ERROR_LOGS ─────────────────────────────────────────────────────────────
create table error_logs (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid references auth.users(id) on delete set null,
  code text not null,
  message text not null,
  stack text,
  source text,
  meta jsonb,
  "createdAt" bigint not null default now_ms()
);
create index error_logs_created on error_logs ("createdAt");

-- ─── SYNC_CONFLICTS ─────────────────────────────────────────────────────────
create table sync_conflicts (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "entityType" text not null,
  "entityId" text not null,
  "fieldName" text not null,
  "versionA" text not null,
  "versionB" text not null,
  resolved boolean not null,
  "resolvedAt" bigint,
  "resolvedWith" text check ("resolvedWith" in ('a','b')),
  "createdAt" bigint not null default now_ms()
);
create index sync_conflicts_user_resolved on sync_conflicts ("userId", resolved);

-- ─── MUTATION_LOG (idempotency, TTL 7 ngày) ─────────────────────────────────
create table mutation_log (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "clientMutationId" text not null,
  "mutationName" text not null,
  result jsonb,
  "createdAt" bigint not null default now_ms(),
  "expiresAt" bigint not null
);
create index mutation_log_client on mutation_log ("clientMutationId");
create index mutation_log_expires on mutation_log ("expiresAt");

-- ─── UPLOAD_SESSIONS (R2 multipart, TTL 24h) ────────────────────────────────
create table upload_sessions (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "docId" text references documents("_id") on delete set null,
  "uploadId" text not null,
  "objectKey" text not null,
  "totalChunks" double precision not null,
  "uploadedChunks" jsonb not null default '[]'::jsonb,
  status upload_status not null,
  "createdAt" bigint not null default now_ms(),
  "expiresAt" bigint not null,
  "updatedAt" bigint not null default now_ms()
);
create index upload_sessions_upload_id on upload_sessions ("uploadId");
create index upload_sessions_expires on upload_sessions ("expiresAt");

-- ─── USER_AI_SETTINGS ───────────────────────────────────────────────────────
create table "userAiSettings" (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "userId" uuid not null unique references auth.users(id) on delete cascade,
  "geminiApiKey" text,
  "geminiModels" text[],
  "updatedAt" bigint not null default now_ms()
);

-- ─── TRANSCRIPTS ────────────────────────────────────────────────────────────
create table transcripts (
  "_id" text primary key default gen_random_uuid()::text,
  "_creationTime" bigint not null default now_ms(),
  "docId" text not null references documents("_id") on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  status transcript_status not null,
  segments jsonb,
  "translatedSegments" jsonb,
  language text,
  "translatedLanguage" text,
  "errorMessage" text,
  "createdAt" bigint not null default now_ms(),
  "updatedAt" bigint not null default now_ms()
);
create index transcripts_doc on transcripts ("docId");
create index transcripts_user on transcripts ("userId");

-- ============================================================================
-- ROW LEVEL SECURITY
-- Bật RLS toàn bộ + policy "chủ sở hữu" ("userId" = auth.uid()).
-- publishable key chạy ở browser → RLS là lớp bảo vệ chính.
-- ============================================================================
alter table profiles            enable row level security;
alter table domains             enable row level security;
alter table handbooks           enable row level security;
alter table folders             enable row level security;
alter table tags                enable row level security;
alter table documents           enable row level security;
alter table document_tags       enable row level security;
alter table document_folders    enable row level security;
alter table reading_progress    enable row level security;
alter table reading_history     enable row level security;
alter table tabs                enable row level security;
alter table note_tabs           enable row level security;
alter table highlights          enable row level security;
alter table notes               enable row level security;
alter table document_shares     enable row level security;
alter table telemetry_events    enable row level security;
alter table error_logs          enable row level security;
alter table sync_conflicts      enable row level security;
alter table mutation_log        enable row level security;
alter table upload_sessions     enable row level security;
alter table "userAiSettings"    enable row level security;
alter table transcripts         enable row level security;

-- profiles: tự đọc/sửa hồ sơ của mình
create policy profiles_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- Macro thủ công: mỗi bảng có "userId" → 1 policy "for all"
create policy domains_owner          on domains          for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy handbooks_owner        on handbooks        for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy folders_owner          on folders          for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy tags_owner             on tags             for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy documents_owner        on documents        for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy document_tags_owner    on document_tags    for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy document_folders_owner on document_folders for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy reading_progress_owner on reading_progress for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy reading_history_owner  on reading_history  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy tabs_owner             on tabs             for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy note_tabs_owner        on note_tabs        for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy highlights_owner       on highlights       for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy notes_owner            on notes            for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy telemetry_owner        on telemetry_events for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy sync_conflicts_owner   on sync_conflicts   for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy mutation_log_owner     on mutation_log     for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy upload_sessions_owner  on upload_sessions  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy ai_settings_owner      on "userAiSettings" for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy transcripts_owner      on transcripts      for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());

-- error_logs: user đọc log của mình; cho phép insert kể cả userId null (lỗi chưa auth)
create policy error_logs_select on error_logs for select using ("userId" = auth.uid());
create policy error_logs_insert on error_logs for insert with check ("userId" = auth.uid() or "userId" is null);

-- document_shares: chủ sở hữu hoặc người được chia sẻ
create policy document_shares_rw on document_shares for all
  using ("ownerId" = auth.uid() or "sharedWithUserId" = auth.uid())
  with check ("ownerId" = auth.uid());
