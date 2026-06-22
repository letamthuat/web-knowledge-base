-- Realtime + RLS: sự kiện UPDATE/DELETE chỉ được gửi khi bảng có REPLICA IDENTITY FULL
-- (để Realtime kiểm RLS trên bản ghi cũ). Mặc định chỉ có PK → UPDATE/DELETE bị nuốt,
-- chỉ INSERT về được. Đặt FULL cho mọi bảng đang ở publication supabase_realtime.
alter table documents          replica identity full;
alter table domains            replica identity full;
alter table handbooks          replica identity full;
alter table folders            replica identity full;
alter table tags               replica identity full;
alter table document_tags      replica identity full;
alter table document_folders   replica identity full;
alter table reading_progress   replica identity full;
alter table reading_history    replica identity full;
alter table tabs               replica identity full;
alter table note_tabs          replica identity full;
alter table highlights         replica identity full;
alter table notes              replica identity full;
alter table transcripts        replica identity full;
alter table "userAiSettings"   replica identity full;

-- profiles cũng cần realtime (useMe) — thêm vào publication + FULL.
alter publication supabase_realtime add table profiles;
alter table profiles           replica identity full;
