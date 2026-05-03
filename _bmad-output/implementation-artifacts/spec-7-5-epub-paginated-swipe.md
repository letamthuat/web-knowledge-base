---
title: 'Story 7.5 — EPUB Continuous/Paginated + Swipe Mobile'
type: 'feature'
created: '2026-05-03'
status: 'ready-for-dev'
---

## Intent

**Problem:** EPUB chỉ có continuous scroll, không có paginated mode — nhiều người thích lật trang. Mobile không có swipe để lật. Settings panel EPUB riêng trùng với global AppSettingsPanel.

**Approach:** Thêm toggle Continuous/Paginated vào toolbar EPUB. Paginated = `flow: "paginated"`, continuous = `flow: "scrolled-doc"`. Swipe left/right trên mobile → prev/next. Xóa settings panel cũ trong EPUBViewer, dùng theme/fontSize/lineHeight từ `useAppTypography()` global thay thế.

## Boundaries & Constraints

**Always:**
- Toggle lưu vào `localStorage("epub-flow")` để persist.
- Paginated mode: `flow: "paginated"`, height phải set cụ thể (100% của container).
- Swipe: threshold 50px horizontal, abort nếu vertical > 30px.
- Dùng `useAppTypography()` để lấy fontSize/lineHeight/theme thay vì local state.
- ←/→ keyboard đã có — giữ nguyên.

**Never:**
- Không sửa ViewerDispatcher hay ReaderPageInner.
- Không rerender/destroy book khi chỉ đổi theme (đã có applyTheme without reload).

## Tasks

- [ ] `apps/web/src/components/viewers/epub/EPUBViewer.tsx`:
  1. Import `useAppTypography` thay cho local theme/fontSize/lineHeight state
  2. Thêm `const [flow, setFlow] = useState<"scrolled-doc"|"paginated">(() => localStorage.getItem("epub-flow") === "paginated" ? "paginated" : "scrolled-doc")`
  3. Khi `flow` thay đổi: destroy và re-init rendition với flow mới (cần re-render)
  4. Thêm toggle button Cuộn/Trang vào toolbar
  5. Xóa settings panel cũ (theme/fontSize/lineHeight) — dùng global AppSettingsPanel
  6. Touch swipe: onTouchStart lưu startX, onTouchEnd nếu dx > 50 → prev/next

## Acceptance Criteria

- Given EPUB mở, when click "Trang", then chuyển sang paginated mode lật trang
- Given paginated mode, when bấm → hoặc swipe left, then sang trang tiếp
- Given chọn theme Sepia ở global settings, when EPUB render, then background sepia
- Given reload trang, when EPUB mở lại, then restore flow mode đã chọn
