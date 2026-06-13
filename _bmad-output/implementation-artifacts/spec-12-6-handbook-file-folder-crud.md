---
title: 'Story 12.6 — File/Folder CRUD trong Handbook'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sau khi import, user cần thêm/xóa file lẻ và tạo/xóa folder trực tiếp trong handbook trên giao diện cây.

**Approach:** Thêm file = upload lẻ (presigned PUT) rồi `finalizeImport` 1 phần tử với `relPath` tại folder đang chọn. Xóa file = `deletePermanent` (đã có cascade). Folder suy ra từ path nên: tạo folder = thêm 1 placeholder doc rỗng (`.gitkeep`-style, format markdown, ẩn khỏi tree) hoặc lưu folder rỗng ở `handbooks.emptyFolders[]`; xóa folder = xóa mọi doc có `relPath` bắt đầu bằng prefix đó.

## Boundaries & Constraints

**Always:**
- Thêm file: chọn folder đích trong cây → relPath = `<folderPrefix>/<filename>`; chống trùng relPath (nếu trùng → thêm hậu tố `-1`).
- Xóa file: tái dùng `deletePermanent({docId})`.
- Tạo folder rỗng: lưu vào `handbooks.emptyFolders: string[]` (mảng prefix) để tree hiển thị folder chưa có file; khi có file đầu tiên thì prefix tự nhiên xuất hiện.
- Xóa folder: xóa tất cả docs `by_handbook` có `relPath` prefix-match + bỏ prefix khỏi `emptyFolders`; cascade qua `deleteDocumentCascade`.
- Mọi thao tác auth + kiểm sở hữu handbook.

**Ask First:**
- Nếu user muốn folder rỗng dùng placeholder doc thay vì field `emptyFolders` → xác nhận (mặc định: `emptyFolders`).

**Never:**
- Không cho di chuyển/đổi tên file hàng loạt trong story này (phạm vi sau nếu cần).

## I/O & Edge-Case Matrix

| Scenario | Input | Behavior | Error |
|----------|-------|----------|-------|
| Thêm file | file + folder đích | upload R2 + insert doc relPath đúng | trùng relPath → thêm hậu tố |
| Xóa file | docId | deletePermanent cascade | không sở hữu → NOT_FOUND |
| Tạo folder | prefix mới | thêm vào `emptyFolders`, tree hiện folder rỗng | prefix trùng → no-op |
| Xóa folder | prefix | xóa mọi doc prefix-match + emptyFolders | prefix rỗng → VALIDATION |

</frozen-after-approval>

## Code Map

- `convex/schema.ts` — thêm `handbooks.emptyFolders: v.optional(v.array(v.string()))`.
- `convex/handbooks/mutations.ts` — `addEmptyFolder({handbookId, prefix})`, `removeFolder({handbookId, prefix})` (xóa docs prefix-match + cascade), tái dùng `finalizeImport` cho thêm file lẻ.
- `apps/web/src/components/handbook/HandbookTree.tsx` — context menu / nút: thêm file, xóa file, tạo folder, xóa folder (gọi mutation + confirm dialog).
- Tái dùng: `requestUploadUrl`, `deletePermanent`, `deleteDocumentCascade` (từ 12.2), `extToFormat` (từ 12.3).

## Tasks & Acceptance

**Execution:**
- [ ] `convex/schema.ts` — `handbooks.emptyFolders` optional array.
- [ ] `convex/handbooks/mutations.ts` — `addEmptyFolder`, `removeFolder`; mở rộng `listHandbookFiles`/tree để gộp `emptyFolders`.
- [ ] `HandbookTree.tsx` — menu thao tác trên node (file: xóa; folder: thêm file/tạo folder con/xóa folder).
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given chọn folder + upload 1 pdf, when xong, then file xuất hiện trong cây tại đúng folder, mở đọc được.
- Given xóa 1 file, when xác nhận, then file biến mất + R2 schedule xóa.
- Given tạo folder rỗng rồi reload, when render, then folder vẫn hiện.
- Given xóa folder có 3 file, when xác nhận, then cả 3 file biến mất khỏi cây.
