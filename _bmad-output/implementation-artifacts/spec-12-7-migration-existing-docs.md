---
title: 'Story 12.7 — Coexistence: tài liệu lẻ giữ nguyên hệ folder (KHÔNG migration)'
type: 'decision'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Quyết định của user (2026-06-11):** Handbook = nội dung có cấu trúc upload bằng ZIP (cây Domain > Handbook). Tài liệu lẻ bình thường **vẫn tổ chức bằng hệ folder hiện tại**, KHÔNG bắt buộc gom vào handbook.

**Hệ quả:** Story này **không còn là migration**. Không viết code di chuyển/patch document cũ. Document `handbookId=undefined` tiếp tục sống trong hệ `folders`/`document_folders` như hiện tại. Hai hệ (Handbook và Tài liệu lẻ) **coexist** trong cùng 1 sidebar chung (xử lý ở 12.5, phần B).

**Việc thực tế còn lại của story này:** chỉ là *xác nhận không có regression* — đảm bảo sau khi thêm tầng Handbook (12.1) + sidebar chung (12.5), tài liệu lẻ + folder cũ + highlight/note/tiến độ đọc vẫn hoạt động y nguyên.

## Boundaries & Constraints

**Always:**
- Document `handbookId=undefined` = tài liệu lẻ, dùng hệ `folders` hiện tại.
- Mọi query/UI library cũ tiếp tục hoạt động; không xóa/đổi `folders`/`document_folders`.

**Never:**
- KHÔNG viết mutation gom doc cũ vào handbook (đã loại bỏ so với plan gốc).
- KHÔNG tạo Domain/Handbook "mặc định" tự động.
- KHÔNG patch `handbookId`/`relPath` cho doc cũ.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Behavior |
|----------|--------------|----------|
| Doc lẻ cũ | `handbookId=undefined` | vẫn ở folder cũ, mở đọc bình thường |
| Sidebar chung | có handbook + doc lẻ | hiện cả 2 phần (xem 12.5) |
| Upload file lẻ mới | qua flow cũ | `handbookId=undefined` như trước |
| Filter library cũ | tag/folder/format | hoạt động không đổi |

</frozen-after-approval>

## Code Map

- Không có code mới riêng cho story này. Coverage thực tế nằm ở:
  - 12.1 (`handbookId` optional → không phá doc cũ).
  - 12.5 phần B (sidebar chung hiển thị tài liệu lẻ theo folder cũ).
- Việc của story = **regression test** trên `LibraryPageInner`, `folders`, reader cho doc lẻ.

## Tasks & Acceptance

**Execution:**
- [ ] Xác nhận sau 12.1 + 12.5: library cũ + folder + filter + reader doc lẻ chạy bình thường (smoke test).
- [ ] (Nếu phát sinh lỗi do `handbookId` optional) — vá tại chỗ.

**Acceptance Criteria:**
- Given tài liệu lẻ + folder cũ + highlight/note, when triển khai xong Epic 12, then mọi thứ hoạt động y nguyên (không mất dữ liệu, không gãy filter).
- Given không có migration nào chạy, when kiểm tra DB, then không có Domain/Handbook "mặc định" tự sinh.
