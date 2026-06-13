---
title: 'Story 13.1 — Split-screen 2 document'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** User cần mở đồng thời 2 file cạnh nhau (trái–phải) để đối chiếu, kèm thanh kéo điều chỉnh độ rộng từng nửa.

**Approach:** Thêm pane phụ (secondary) vào `AppShell`. Khi bật split, layout chia 2 cột với divider kéo được (`useResizable`); mỗi cột render 1 `ReaderDocLoader` độc lập (scroll/tab/progress riêng vì mỗi loader tự fetch URL + ReaderProgressContext riêng). Chọn doc cho pane phải qua nút "mở sang phải" trong cây/library hoặc menu tab.

## Boundaries & Constraints

**Always:**
- Tái dùng `ReaderDocLoader` (đã keep-alive, có URL cache module-level) cho cả 2 pane → không phải viết viewer mới.
- Divider dùng `useResizable`; lưu tỉ lệ rộng vào localStorage.
- State split (bật/tắt + secondaryDocId) giữ ở `ActiveTabContext` hoặc state cục bộ AppShell.
- Desktop-only mặc định (màn <768px → tắt split, mở full). 
- Mỗi pane progress/scroll lưu độc lập (reading_progress theo docId — đã đúng sẵn).

**Ask First:**
- Nếu muốn split áp cho cả Library/Notes (không chỉ reader) → xác nhận (mặc định: chỉ 2 document reader).

**Never:**
- Không tạo cơ chế đồng bộ scroll giữa 2 pane (ngoài phạm vi).
- Không phá keep-alive tab hiện có.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Behavior |
|----------|--------------|----------|
| Bật split | đang đọc doc A, "mở B sang phải" | 2 cột: A trái, B phải, divider giữa |
| Kéo divider | drag | đổi tỉ lệ rộng, lưu localStorage |
| Đóng pane phải | nút X | về full 1 cột (doc A) |
| Mobile | width<768 | split disabled, mở B full thay thế |
| Cùng doc 2 bên | A=B | cho phép (2 vị trí đọc khác nhau) |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/AppShell.tsx` — thêm layout split: khi `secondaryDocId` set, bọc vùng reader thành 2 cột flex + divider; render `ReaderDocLoader` thứ 2.
- `apps/web/src/contexts/ActiveTabContext.tsx` — thêm `secondaryDocId` + `openSecondary(docId)` + `closeSecondary()`.
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — `ReaderDocLoader` đã dùng được; thêm prop optional `compact`/`onCloseSplit` cho pane phải (ẩn vài nút header).
- Tái dùng: `useResizable`, `getCachedUrl/setCachedUrl` (URL cache đã có).
- Điểm gọi "mở sang phải": `HandbookTree.tsx` (12.5) + TabBar menu.

## Tasks & Acceptance

**Execution:**
- [ ] `ActiveTabContext` — thêm secondaryDocId + actions.
- [ ] `AppShell` — render 2 cột + divider (`useResizable`) khi có secondary; nút đóng.
- [ ] `ReaderDocLoader` — hỗ trợ chế độ pane phải (header gọn + nút đóng split).
- [ ] Thêm action "Mở sang phải" ở cây handbook + tab menu.
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given đang đọc A, when "mở B sang phải", then thấy A|B cạnh nhau.
- Given kéo divider, when kéo, then 2 nửa đổi rộng mượt; reload giữ tỉ lệ.
- Given cuộn pane A, when cuộn, then pane B không bị ảnh hưởng (độc lập).
- Given màn hình mobile, when mở B, then thay thế full (không split).
