---
title: 'Story 13.2 — Icon trạng thái đọc trên cây thư mục'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trên cây thư mục cần icon cho biết file đã đọc xong / đang đọc dở / chưa đọc, để theo dõi tiến độ học.

**Approach:** Suy ra trạng thái từ `reading_progress.progressPct` của từng doc (đã có sẵn). `listHandbookFiles` (12.1) đã trả `progressPct` → ánh xạ: chưa có/0 = chưa đọc; >0 và <0.95 = đang đọc; ≥0.95 = xong. Render icon/màu ở node file trong `HandbookTree`.

## Boundaries & Constraints

**Always:**
- Lấy trạng thái từ `progressPct` trả về bởi `listHandbookFiles`; không thêm bảng mới.
- Ngưỡng "xong" = 0.95 (đồng nhất với cách reader tính %).
- Icon nhẹ (chấm màu / check), không chiếm chỗ; có tooltip text.
- Cập nhật reactive khi progress đổi (Convex query realtime — tự động).

**Ask First:**
- Nếu muốn cho phép user thủ công đánh dấu "đã đọc" (override) → đây là tính năng thêm; xác nhận (mặc định: chỉ suy ra tự động).

**Never:**
- Không tính lại progress ở client (dùng giá trị đã lưu).

## I/O & Edge-Case Matrix

| progressPct | Trạng thái | Icon |
|-------------|-----------|------|
| undefined / 0 | Chưa đọc | chấm rỗng / không icon |
| 0 < pct < 0.95 | Đang đọc dở | chấm nửa / màu vàng |
| ≥ 0.95 | Đã xong | check xanh |
| File không đọc được (ảnh) | — | không icon trạng thái |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/handbook/HandbookTree.tsx` — render icon theo `progressPct` của node file.
- `convex/handbooks/queries.ts` (`listHandbookFiles`) — đảm bảo trả `progressPct` (đã định nghĩa ở 12.1).
- Tái dùng: ngưỡng % giống `ReaderPageInner` progress bar.

## Tasks & Acceptance

**Execution:**
- [ ] `HandbookTree.tsx` — map progressPct → trạng thái + render icon + tooltip.
- [ ] (Nếu cần) bổ sung progressPct vào `listHandbookFiles`.
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given đọc xong 1 file (≥95%), when xem cây, then file đó có icon "xong".
- Given đọc dở 1 file, when xem cây, then icon "đang đọc".
- Given cập nhật tiến độ, when progress đổi, then icon đổi realtime không cần reload.
