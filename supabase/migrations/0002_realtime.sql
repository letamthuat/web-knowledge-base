-- Bật Supabase Realtime cho các bảng cần live-update (thay reactive của Convex).
-- Realtime tôn trọng RLS: user chỉ nhận thay đổi của row họ được phép SELECT.
alter publication supabase_realtime add table documents;
alter publication supabase_realtime add table domains;
alter publication supabase_realtime add table handbooks;
alter publication supabase_realtime add table folders;
alter publication supabase_realtime add table tags;
alter publication supabase_realtime add table document_tags;
alter publication supabase_realtime add table document_folders;
alter publication supabase_realtime add table reading_progress;
alter publication supabase_realtime add table reading_history;
alter publication supabase_realtime add table tabs;
alter publication supabase_realtime add table note_tabs;
alter publication supabase_realtime add table highlights;
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table transcripts;
alter publication supabase_realtime add table "userAiSettings";
