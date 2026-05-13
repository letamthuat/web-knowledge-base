---
title: PWA & Mobile Audit — Web Knowledge Base
date: 2026-05-03
status: ready-for-epic-8
---

# PWA & Mobile Audit

Kiểm tra toàn diện trước Epic 8. Tổng **25 vấn đề** được phân loại theo mức độ ưu tiên.

---

## 🔴 CRITICAL (6 issues)

### C1 — Manifest icons rỗng → PWA không cài được
- **File:** `apps/web/public/manifest.json`
- **Root cause:** `"icons": []` — mảng rỗng. Browser từ chối "Add to Home Screen" nếu không có icon 192px + 512px.
- **Fix:** Tạo icon PNG 192×192 và 512×512 (có maskable variant), thêm vào `public/`, cập nhật manifest.
- **Impact:** Người dùng không thể cài PWA lên home screen.

### C2 — Safe area / notch không được xử lý
- **File:** `apps/web/src/styles/globals.css`, `apps/web/src/app/layout.tsx`
- **Root cause:** Không có `viewport-fit=cover` trong meta viewport; không dùng `env(safe-area-inset-*)`. Trên iPhone notch/Dynamic Island, content bị che.
- **Fix:** Thêm `viewport-fit=cover` vào viewport meta; padding header/footer với `env(safe-area-inset-top/bottom)`.

### C3 — Text selection bị hỏng trên iOS Safari (Markdown viewer)
- **File:** `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` line 515
- **Root cause:** Chỉ có handler `onMouseUp` để bắt selection highlight. Trên iOS Safari, touch không trigger `mouseup` → không thể chọn text để tạo highlight.
- **Fix:** Thêm `onTouchEnd` handler song song với `onMouseUp`, hoặc dùng `onPointerUp` (unified).

### C4 — Pinch-to-zoom bị block
- **File:** `apps/web/src/app/layout.tsx` (viewport meta)
- **Root cause:** Nếu `user-scalable=no` hoặc `maximum-scale=1` tồn tại trong meta viewport → vi phạm accessibility, iOS 10+ bỏ qua nhưng Android WebView vẫn block.
- **Fix:** Xóa `user-scalable=no` / `maximum-scale` khỏi viewport meta.

### C5 — Back gesture (Android/iOS) conflict với reader navigation
- **File:** `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx`
- **Root cause:** Swipe từ edge trái trigger browser back → thoát khỏi reader thay vì về trang trước trong document. Không có `history.pushState` guard hay swipe disambiguation.
- **Fix:** Với EPUB paginated: intercept edge swipe, ưu tiên `rendition.prev()` trước. Với PDF/Markdown: cân nhắc NavigationGuard khi swipe từ edge < 20px.

### C6 — Modal scroll trap trên iOS
- **File:** `apps/web/src/components/search/SearchModal.tsx`, các modal khác
- **Root cause:** Khi modal mở, body scroll vẫn hoạt động bên dưới trên iOS Safari (không có `overflow: hidden` lock đúng cách). Dùng `-webkit-overflow-scrolling: touch` trong modal container có thể fix.
- **Fix:** Khi modal open: `document.body.style.overflow = 'hidden'`; cleanup khi close. Hoặc dùng thư viện `body-scroll-lock`.

---

## 🟠 HIGH (7 issues)

### H1 — EPUB swipe dùng React synthetic event (passive listener conflict)
- **File:** `apps/web/src/components/viewers/epub/EPUBViewer.tsx`
- **Root cause:** epubjs mount iframe bên trong `viewerRef.current`. React's `onTouchStart`/`onTouchEnd` trên div wrapper không capture event bên trong iframe. Swipe sẽ không hoạt động.
- **Fix:** Sau khi rendition ready, attach native `addEventListener('touchstart/touchend', handler, { passive: true })` trực tiếp lên `renditionRef.current.getContents()[0].window` hoặc iframe element.

### H2 — Keyboard layout shift đẩy fixed header (PDF + reader trên mobile)
- **File:** `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx`, PDF viewer
- **Root cause:** Khi soft keyboard bật lên, `100vh` không tính keyboard height trên mobile. Header/footer bị che hoặc layout bị vỡ.
- **Fix:** Dùng `dvh` (dynamic viewport height) thay `vh`: `h-screen` → `h-[100dvh]`. Tailwind 3.3+ hỗ trợ `h-dvh`.

### H3 — Note title input không focus được sau khi tạo note mới trên mobile
- **File:** `apps/web/src/components/notes/NotesPageInner.tsx`, `NoteEditor.tsx`
- **Root cause:** `autoFocusTitle` dùng `element.focus()` — trên iOS Safari, `focus()` không mở keyboard trừ khi được gọi từ trong user gesture handler trực tiếp.
- **Fix:** Không thể workaround hoàn toàn; tốt nhất là thêm placeholder rõ ràng và để người dùng tap để focus.

### H4 — Tab bar không scroll được trên mobile khi nhiều tab mở
- **File:** `apps/web/src/components/tabs/TabBar.tsx`
- **Root cause:** Nếu tab bar dùng `overflow-x: auto` nhưng không có `-webkit-overflow-scrolling: touch`, scroll sẽ không có momentum trên iOS. Cũng cần `touch-action: pan-x` để không conflict với vertical scroll.
- **Fix:** Thêm CSS class `overflow-x-auto overscroll-x-contain` và inline style `touchAction: 'pan-x'` trên tab container.

### H5 — PDF viewer: keyboard phủ content khi chú thích
- **File:** `apps/web/src/components/viewers/pdf/` (nếu có annotation input)
- **Root cause:** Input fields trong PDF overlay không scroll into view khi keyboard open.
- **Fix:** `element.scrollIntoView({ behavior: 'smooth', block: 'center' })` sau khi keyboard open (detect via `visualViewport` resize event).

### H6 — Touch target nhỏ hơn 44×44px ở nhiều chỗ
- **Files:** `AppSettingsPanel.tsx`, `NoteList.tsx`, `SearchModal.tsx`, `MarkdownViewer.tsx` (30+ instances của `text-[10px]`/`text-[11px]`)
- **Root cause:** Buttons với `h-6 w-6` (24px), icon buttons, close buttons không đạt chuẩn Apple HIG 44pt / Material 48dp.
- **Fix:** Minimum `min-h-[44px] min-w-[44px]` hoặc `p-3` padding cho tất cả interactive elements trên mobile. Dùng media query hoặc Tailwind `touch:` variant.

### H7 — Z-index conflict: floating pills vs modals vs drawer
- **File:** `AudioRecordingPill.tsx`, `ScreenRecordingPill.tsx`, mobile nav drawer
- **Root cause:** Pills dùng `z-50`, drawer dùng `z-50`, modal dùng `z-50` → overlap không nhất quán. Trên mobile, pills có thể che nút close của modal.
- **Fix:** Thiết lập z-index hierarchy rõ ràng: drawer=40, modal=50, pills=60, toast=70.

---

## 🟡 MEDIUM (8 issues)

### M1 — Font size < 12px vi phạm readability
- **Files:** `AppSettingsPanel.tsx`, `NoteList.tsx`, `SearchModal.tsx`, `MarkdownViewer.tsx`, nhiều component khác
- **Root cause:** `text-[10px]`, `text-[11px]` dùng rộng rãi. iOS Safari auto-zoom input nếu font-size < 16px. Gây layout shift khi focus input.
- **Fix:** Minimum 12px cho label/meta text. Input fields: minimum 16px font-size để tránh auto-zoom.

### M2 — BlockNote editor padding không đủ trên mobile
- **File:** `apps/web/src/components/notes/NoteEditor.tsx`
- **Root cause:** BlockNote default padding quá nhỏ trên mobile. Cần thêm `padding-bottom` lớn khi keyboard mở để content không bị che.
- **Fix:** CSS override `.bn-editor { padding-bottom: env(keyboard-inset-height, 200px); }` + `visualViewport` resize detection.

### M3 — Library grid không tối ưu trên mobile
- **File:** `apps/web/src/app/library/` components
- **Root cause:** Grid có thể dùng số cột cố định thay vì responsive. Card title/actions bị cắt trên màn nhỏ.
- **Fix:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, đảm bảo card action buttons đủ touch target.

### M4 — Search modal không scroll được nội dung kết quả trên iOS
- **File:** `apps/web/src/components/search/SearchModal.tsx`
- **Root cause:** Modal có height cố định, results list dùng `overflow-y-auto` nhưng thiếu `overscroll-behavior: contain` → scroll leak ra body.
- **Fix:** `overscroll-contain` class trên results container; đảm bảo `-webkit-overflow-scrolling: touch`.

### M5 — Resize observer không debounce → jank khi rotate
- **File:** Viewer components dùng resize detection
- **Root cause:** Không debounce resize event → nhiều re-render trong 1 frame khi rotate device.
- **Fix:** Debounce resize handler 150ms.

### M6 — Haptic feedback thiếu cho actions quan trọng
- **Root cause:** Không có `navigator.vibrate()` hay `window.HapticFeedback` (iOS) cho actions như: tạo note, xóa, lưu thành công.
- **Fix:** Wrapper `hapticFeedback(type)` function check `navigator.vibrate` trước khi gọi. Low priority nhưng cải thiện UX mobile đáng kể.

### M7 — Popover/dropdown positioning sai trên mobile
- **File:** Components dùng Radix UI popover/dropdown
- **Root cause:** Radix UI collision detection có thể không đủ cho màn hình nhỏ — popover bị cắt ở edge màn hình.
- **Fix:** Kiểm tra và set `collisionPadding={16}` trên tất cả `<Popover.Content>` / `<DropdownMenu.Content>`.

### M8 — AppSettingsPanel không đóng khi tap outside trên mobile
- **File:** `apps/web/src/components/AppSettingsPanel.tsx`
- **Root cause:** Nếu panel dùng conditional render thay vì Radix Sheet/Dialog, tap-outside detection có thể không hoạt động đúng trên touch devices.
- **Fix:** Thêm overlay div bắt `onTouchStart` để close panel, hoặc migrate sang Radix `<Sheet>`.

---

## 🟢 LOW (4 issues)

### L1 — Service Worker không cache offline
- **File:** `apps/web/public/` (không có `sw.js`)
- **Root cause:** Không có service worker → app không hoạt động offline. Next.js cần `next-pwa` hoặc Workbox config.
- **Fix:** Tích hợp `@ducanh2912/next-pwa` hoặc `next-pwa`. Cache: static assets, last-viewed documents.

### L2 — EPUB flow mode không sync giữa tabs
- **File:** `apps/web/src/components/viewers/epub/EPUBViewer.tsx`
- **Root cause:** `localStorage` không broadcast sang tabs khác mà không có `storage` event listener.
- **Note:** Minor UX issue, không critical.

### L3 — Skeleton/loading state thiếu trên mobile (slow 4G)
- **Root cause:** Một số list/content area không có skeleton placeholder → blank screen trên slow connection.
- **Fix:** Thêm `<Skeleton>` component cho NoteList, LibraryGrid khi loading.

### L4 — Recording pills bị che trên Android dark mode
- **File:** `apps/web/src/components/recording/AudioRecordingPill.tsx`
- **Root cause:** Pills có thể dùng màu cứng không respect dark mode của OS.
- **Fix:** Dùng Tailwind dark: variants hoặc CSS variables.

---

## Tóm tắt theo category

| Category | Count | Priority |
|----------|-------|----------|
| PWA Install (manifest, SW) | 2 | C1, L1 |
| iOS Safari specific | 4 | C3, C6, M1, H3 |
| Layout/Safe area | 3 | C2, H2, C4 |
| Touch/Gesture | 4 | C5, H1, C3, H4 |
| Touch targets | 2 | H6, M1 |
| Z-index/Overlay | 2 | H7, M8 |
| Performance | 2 | M5, L3 |
| UX Polish | 6 | H5, M2–M4, M6–M7, L2, L4 |

## Recommended Epic 8 Sprint Order

1. **C1** — Manifest icons (30 min, unblocks PWA install)
2. **C2** — Safe area CSS (1h, affects all pages)
3. **C3** — Text selection touchend fix (30 min, critical bug)
4. **H2** — dvh for viewer height (30 min, affects all viewers)
5. **H1** — EPUB swipe via iframe native listener (1h)
6. **H6** — Touch target audit pass (2h, many files)
7. **H7** — Z-index system (1h)
8. **C6** — Modal scroll lock (1h)
9. **M1** — Font size minimum (1h)
10. **L1** — Service worker / offline (2-3h, needs next-pwa)
11. Remaining M/L items
