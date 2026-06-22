-- Thùng rác có cấu trúc: cho phép xoá-mềm cả handbook/folder (giữ liên kết để khôi phục).
-- trashedAt = null → đang active; có giá trị → đang ở thùng rác.
alter table handbooks add column if not exists "trashedAt" bigint;
alter table folders   add column if not exists "trashedAt" bigint;

create index if not exists handbooks_trashed on handbooks ("userId", "trashedAt");
create index if not exists folders_trashed   on folders ("userId", "trashedAt");
