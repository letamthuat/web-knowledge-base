---
title: PWA UX/UI Redesign Spec — Web Knowledge Base
date: 2026-05-03
status: ready-for-review
scope: Epic 8 + PWA UX layer
---

# PWA UX/UI Redesign Specification

## Mục tiêu

Mang **đầy đủ tính năng từ desktop sang PWA** nhưng được thiết kế lại UX/UI để tối ưu hiển thị và trải nghiệm trên mobile và tablet. Không cắt bớt tính năng — chỉ thay đổi cách trình bày và tương tác cho phù hợp với màn hình nhỏ, touch input, và ngữ cảnh di động.

**Nguyên tắc thiết kế:**
1. **Mobile-first layout** — thiết kế cho 375px trước, mở rộng lên tablet (768px) và desktop (1024px+)
2. **Touch-first interactions** — tap, swipe, long-press thay vì hover/right-click
3. **Thumb zone** — actions quan trọng ở bottom (dễ chạm), thông tin ở top (chỉ đọc)
4. **Progressive disclosure** — ẩn secondary actions trong bottom sheet / action sheet thay vì cramped toolbar
5. **Native-feel** — transitions, safe area, haptic feedback, overscroll behavior giống native app

---

## 1. Navigation Architecture

### 1.1 Bottom Navigation Bar (Mobile ≤ 767px)

**Thay thế:** Header nav links + hamburger drawer hiện tại

```
┌─────────────────────────────────────┐
│                                     │
│         [Content Area]              │
│                                     │
├────────┬────────┬────────┬──────────┤
│  📚    │  📝    │  🔍    │  ⚙️     │
│ Thư    │ Ghi    │ Tìm    │         │
│ viện   │ chú    │ kiếm   │ Cài đặt │
└────────┴────────┴────────┴──────────┘
   pb: env(safe-area-inset-bottom)
```

**Component:** `apps/web/src/components/nav/BottomNav.tsx` (NEW)
- 4 tabs: Thư viện, Ghi chú, Tìm kiếm, Cài đặt
- Active tab: primary color + filled icon
- Inactive: muted color + outline icon
- Height: 56px + `env(safe-area-inset-bottom)` padding
- Background: `bg-card border-t` — blur effect trên iOS Safari (`backdrop-blur-sm bg-card/80`)
- Tìm kiếm tab: mở `SearchModal` thay vì navigate
- Z-index: 40 (dưới modal/sheet)

**Ẩn BottomNav khi:**
- Đang ở Reader page (để maximize reading area)
- Đang trong reading mode (fullscreen)
- Keyboard đang open (detect via `visualViewport` resize)

### 1.2 Header Simplification (Mobile)

**Hiện tại:** Header h-12 chứa logo + full nav + search + email + logout

**Redesign mobile header:**
```
┌──────────────────────────────────────┐
│  [←Back]  [Title truncated]  [⋯]   │
│                              (more)  │
└──────────────────────────────────────┘
```
- Back button (nếu có previous page)
- Title của trang hiện tại (Library/Notes/Reader)
- `⋯` (More) button → bottom action sheet với: Search, Settings, Logout
- Logo chỉ hiện trên desktop

### 1.3 Desktop Navigation (≥ 768px)

Giữ nguyên sidebar/top-nav pattern hiện tại — đã hoạt động tốt.

---

## 2. Library Page — Mobile Redesign

### 2.1 Layout

**Mobile (< 768px):**
```
┌──────────────────────────────────────┐
│  Thư viện          [↑Upload] [⋯]    │ ← Header
│  📁 Tất cả > 📁 Sách               │ ← Breadcrumb
├──────────────────────────────────────┤
│  [🔍 Tìm trong thư viện...]         │ ← Search bar
│  [Tất cả ▾] [Sắp xếp ▾]            │ ← Filter chips
├──────────────────────────────────────┤
│  ┌────────┐  ┌────────┐             │
│  │  📄   │  │  📄   │             │ ← 2-col grid
│  │ Title  │  │ Title  │             │
│  │ 12/05  │  │ 12/05  │             │
│  └────────┘  └────────┘             │
│                                     │
│  [Recent] ──────────────────────   │ ← Section header
│  → Doc A  → Doc B  → Doc C  (scroll)│ ← Horizontal scroll
├──────────────────────────────────────┤
│  [📚 Thư viện] [📝 Ghi chú] ...    │ ← BottomNav
└──────────────────────────────────────┘
```

**Changes:**
- Grid: `grid-cols-2` (mobile) → `grid-cols-3` (tablet) → sidebar + grid (desktop)
- Sidebar ẩn hoàn toàn trên mobile (thay bằng breadcrumb + filter chips)
- Upload: FAB button `fixed bottom-20 right-4` (trên BottomNav)
- Long-press on card → show action sheet (Open, Move, Rename, Delete) — thay vì right-click context menu
- Swipe to delete (optional, phase 2)
- Recent docs: horizontal scroll strip thay vì list

### 2.2 Document Card (Mobile)

```
┌─────────────────────┐
│  [Icon 32px]        │
│                     │
│  Title (2 lines)    │
│  12/05 · PDF · 2MB  │
└─────────────────────┘
```
- Minimum touch target: 80px tall card
- Long-press (500ms): vibrate + show action sheet
- Tap: open in reader

### 2.3 Upload Flow (Mobile)

**Hiện tại:** Dialog với dropzone + file input

**Mobile:** Bottom Sheet với options:
- 📷 Chụp ảnh tài liệu
- 📁 Chọn file từ Files app
- 🌐 Import từ URL
- Drag-drop area (cho tablet/iPad)

---

## 3. Reader Page — Mobile Redesign

### 3.1 Layout — Toàn màn hình (immersive)

**Mobile:**
```
┌──────────────────────────────────────┐
│  [←] [Title truncated]  [⋯][📝][↓] │ ← Collapsible header (tap to show/hide)
├──────────────────────────────────────┤
│                                     │
│         [Document Content]          │ ← Full height
│                                     │
│                                     │
├──────────────────────────────────────┤
│  ══════════════════           45%   │ ← Progress bar (always visible)
│  pb: env(safe-area-inset-bottom)    │
└──────────────────────────────────────┘
```

**Key changes:**
- Header auto-hide sau 3s idle, tap content để toggle
- Không có BottomNav trong reader (full content area)
- Tab bar ẩn trên mobile reader (quá nhiều chrome)
- Progress bar luôn visible ở dưới cùng
- `[⋯]` More menu: Notes, TOC, Search, Download, Settings

### 3.2 Reader Controls — Bottom Sheet Pattern

**Thay vì sidebar/modal:**

Tap `[⋯]` → Bottom Sheet với sections:
```
┌──────────────────────────────────────┐
│  ────────── (drag handle)           │
│                                     │
│  📋 Mục lục                        │
│  ─────────────────────────────────  │
│    Chapter 1: Introduction      →  │
│    Chapter 2: Methods           →  │
│                                     │
│  📝 Ghi chú (3)                    │
│  ─────────────────────────────────  │
│    [+ Thêm ghi chú]                │
│                                     │
│  ↓ Tải về                          │
└──────────────────────────────────────┘
```

Bottom Sheet: dùng `@radix-ui/react-dialog` với custom CSS transform animation, hoặc Vaul library.

### 3.3 Text Selection → Highlight (iOS Fix)

**Problem:** Chỉ có `onMouseUp`, không có `onTouchEnd` → iOS không highlight được

**Solution:**
```tsx
// MarkdownViewer.tsx — unified pointer events
<div
  onPointerUp={handleSelectionEnd}  // covers both mouse and touch
  // Remove: onMouseUp
>
```
Hoặc:
```tsx
onMouseUp={handleSelectionEnd}
onTouchEnd={handleSelectionEnd}
```

### 3.4 PDF Viewer — Mobile Controls

**Hiện tại:** Toolbar trên top với page input, zoom controls

**Mobile:**
```
┌──────────────────────────────────────┐
│  [←] PDF Title                 [⋯] │ ← Minimal header
├──────────────────────────────────────┤
│                                     │
│         [PDF Page Content]          │
│                                     │
├──────────────────────────────────────┤
│  [◀ Prev]  5 / 120  [▶ Next]  45% │ ← Bottom controls
└──────────────────────────────────────┘
```
- Zoom: pinch-to-zoom native (không block)
- Page navigation: bottom bar thay vì top toolbar
- Double-tap: zoom in/out toggle

### 3.5 EPUB Viewer — Mobile Swipe (Critical Fix)

**Problem:** React `onTouchStart/End` không capture events trong epubjs iframe

**Solution:** Attach native listeners sau khi rendition ready:
```tsx
rendition.on("rendered", () => {
  const iframe = viewerRef.current?.querySelector("iframe");
  if (!iframe?.contentWindow) return;
  
  let startX = 0;
  iframe.contentWindow.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });
  
  iframe.contentWindow.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) dx < 0 ? rendition.next() : rendition.prev();
  }, { passive: true });
});
```

---

## 4. Notes Page — Mobile Redesign

### 4.1 Layout

**Mobile:**
```
┌──────────────────────────────────────┐
│  Ghi chú                    [+][⋯]  │ ← Header
├──────────────────────────────────────┤
│  [Tab 1 ×] [Tab 2 ×]  (scroll)     │ ← Tab bar (horizontal scroll)
├──────────────────────────────────────┤
│  [Note Title]                       │
│  ─────────────────────────────────  │
│                                     │
│         [BlockNote Editor]          │ ← Full height
│                                     │
│  pb: keyboard-inset or 200px        │
├──────────────────────────────────────┤
│  [💾 Đã lưu]  [↑ Import] [↓ Export]│ ← Floating toolbar (above keyboard)
└──────────────────────────────────────┘
```

**Key changes:**
- Notes list (sidebar): slide-in bottom sheet thay vì sidebar overlay
- `[+]` tạo note mới
- Floating toolbar `position: fixed, bottom: keyboard-height + 8px` (dùng `visualViewport`)
- Tab bar scroll horizontal với `overscroll-x-contain`

### 4.2 Note List — Bottom Sheet

Tap `☰` → Bottom Sheet trượt lên 60% màn hình:
```
┌──────────────────────────────────────┐
│  ──── (drag handle)                 │
│  Danh sách ghi chú      [+ Mới]     │
│  ────────────────────────────────   │
│  📝 Note Title 1             12/05  │
│  📝 Note Title 2             11/05  │
│  📝 Note Title 3             10/05  │
└──────────────────────────────────────┘
```

---

## 5. Settings Page — Mobile Redesign

**Mobile:** Full-page settings với list-style sections (giống iOS Settings)

```
┌──────────────────────────────────────┐
│  [←]  Cài đặt                       │
├──────────────────────────────────────┤
│  GIAO DIỆN ĐỌC                      │
│  ─────────────────────────────────  │
│  Màu nền                 Sáng  →   │
│  Phông chữ              Sans   →   │
│  Cỡ chữ                  16px  →   │
│                                     │
│  DỮ LIỆU                           │
│  ─────────────────────────────────  │
│  Sao lưu                       →   │
│  Lưu trữ             120MB / ∞  →   │
│                                     │
│  TÀI KHOẢN                         │
│  ─────────────────────────────────  │
│  user@email.com                     │
│  Đăng xuất                     →   │
│  Xoá tài khoản                 →   │
├──────────────────────────────────────┤
│  [📚] [📝] [🔍] [⚙️]               │ ← BottomNav (active: ⚙️)
└──────────────────────────────────────┘
```

AppSettingsPanel FAB vẫn giữ trên desktop. Trên mobile, settings panel integrate vào Settings page.

---

## 6. AppSettingsPanel — Mobile Adaptation

**Hiện tại:** FAB bottom-right, panel popup w-56

**Mobile:** Tap FAB → Bottom Sheet full-width:
```
┌──────────────────────────────────────┐
│  ──── (drag handle)                 │
│  Tùy chỉnh hiển thị                 │
│                                     │
│  Màu nền                           │
│  [○ Sáng] [○ Ngả vàng] [○ Tối]    │
│                                     │
│  Phông chữ                         │
│  [Sans] [Serif] [Mono]             │
│                                     │
│  Cỡ chữ ──────●────── 16px        │
│  Dãn dòng ────●─────── 1.6         │
│                                     │
│  Bố cục cột                        │
│  [Hẹp] [Vừa] [Rộng]               │
└──────────────────────────────────────┘
```
- Bottom Sheet với Radix Dialog + CSS slide-up animation
- Drag-to-dismiss (kéo xuống để đóng)

---

## 7. Search — Mobile Optimization

**Hiện tại:** Modal center-screen

**Mobile:** Bottom Sheet slide-up 90% screen height:
```
┌──────────────────────────────────────┐
│  ──── (drag handle)                 │
│  [🔍 Tìm kiếm...          ] [×]    │
│  ─────────────────────────────────  │
│  Kết quả:                           │
│  ─────────────────────────────────  │
│  📄 Title match 1...                │
│  📝 Note match 2...                 │
│  (scroll)                           │
└──────────────────────────────────────┘
```
- Keyboard mở ngay khi sheet open
- Results list: `overflow-y-auto overscroll-contain`
- Body scroll lock khi open

---

## 8. Global CSS & Layout Fixes

### 8.1 Safe Area

```css
/* globals.css */
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
```

```html
<!-- layout.tsx viewport -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

Header: `padding-top: var(--safe-top)`  
BottomNav: `padding-bottom: var(--safe-bottom)`

### 8.2 Dynamic Viewport Height

Thay `h-screen` / `min-h-screen` → `h-dvh` / `min-h-dvh` (Tailwind: `h-dvh`)  
Fallback: `height: 100svh` cho browser cũ

### 8.3 Typography Scale Mobile

```css
@media (max-width: 767px) {
  /* Minimum 12px for labels */
  .text-\[10px\], .text-\[11px\] {
    font-size: 12px !important;
  }
  /* Prevent iOS auto-zoom on input */
  input, textarea, select {
    font-size: max(16px, 1rem) !important;
  }
}
```

### 8.4 Touch Targets

```css
@media (max-width: 767px) {
  button, [role="button"], a {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### 8.5 Z-index System

```
/* Defined in globals.css as CSS vars */
--z-base: 1;
--z-dropdown: 10;
--z-sticky: 20;
--z-drawer: 30;
--z-bottomnav: 40;
--z-modal: 50;
--z-pills: 60;
--z-toast: 70;
```

---

## 9. Bottom Sheet Component

Tất cả overlays trên mobile sẽ dùng chung một `BottomSheet` component:

**File:** `apps/web/src/components/ui/BottomSheet.tsx` (NEW)

```tsx
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: string[]; // ["40%", "90%"]
  title?: string;
}
```

**Features:**
- Drag handle visible
- Drag-to-dismiss (swipe down 30% → close)
- Backdrop tap → close
- Body scroll lock when open
- `padding-bottom: env(safe-area-inset-bottom)`
- CSS: `transform: translateY(0)` animate from `translateY(100%)`
- `will-change: transform` for GPU acceleration

**Sử dụng cho:** AppSettingsPanel, Search, Notes list, Reader TOC/Notes, Upload options, Document actions

---

## 10. PWA Install & Manifest

### 10.1 Icons Required

```
apps/web/public/icons/
  icon-192.png          (192×192, standard)
  icon-512.png          (512×512, standard)
  icon-192-maskable.png (192×192, maskable — safe area padding)
  icon-512-maskable.png (512×512, maskable)
  apple-touch-icon.png  (180×180, iOS)
  favicon.ico           (32×32)
```

Design: Logo "WKB" text với background primary color (#2563eb), rounded corners.

### 10.2 manifest.webmanifest

```json
{
  "name": "Web Knowledge Base",
  "short_name": "WKB",
  "description": "Kho tri thức cá nhân — đọc, ghi chú, tra cứu mọi lúc mọi nơi",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "lang": "vi",
  "scope": "/",
  "categories": ["productivity", "education"],
  "shortcuts": [
    { "name": "Thư viện", "url": "/library", "icons": [{"src": "/icons/icon-192.png", "sizes": "192x192"}] },
    { "name": "Ghi chú mới", "url": "/notes?new=1", "icons": [{"src": "/icons/icon-192.png", "sizes": "192x192"}] }
  ],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## 11. Tablet Layout (768px – 1023px)

Tablet có màn hình đủ rộng để dùng 2-panel layout:

**Library:** Sidebar (w-56) + content grid `grid-cols-3`  
**Reader:** TOC sidebar collapsible (w-48) + full content  
**Notes:** Note list (w-48, visible) + editor  
**BottomNav:** Ẩn trên tablet, dùng left sidebar nav (w-14, icon-only)

---

## 12. Implementation Order (Sprint)

### Phase 1 — Foundation (unblocks everything)
1. **Safe area CSS vars** + `viewport-fit=cover` (globals.css, layout.tsx) — 30min
2. **`h-dvh` replace `h-screen`** across all pages — 30min
3. **Z-index CSS vars** + fix pills/modal/drawer hierarchy — 30min
4. **Font size minimum** CSS + input 16px — 30min
5. **Touch target CSS** (`min-h-[44px]`) — 45min
6. **PWA icons** + manifest.webmanifest — 1h

### Phase 2 — Navigation
7. **BottomSheet component** — 2h
8. **BottomNav component** — 1.5h
9. **Reader header auto-hide** + minimal chrome — 1h

### Phase 3 — Critical Bugs
10. **Text selection iOS fix** (`onPointerUp` in MarkdownViewer) — 30min
11. **EPUB swipe via iframe native listener** — 1h
12. **Modal body scroll lock** — 45min
13. **EPUB paginated `h-dvh`** — 15min

### Phase 4 — Page Redesigns
14. **Library mobile grid** + horizontal recent strip — 2h
15. **AppSettingsPanel → BottomSheet on mobile** — 1.5h
16. **Search → BottomSheet on mobile** — 1h
17. **Reader `⋯` more menu** + TOC/Notes bottom sheet — 2h
18. **Notes sidebar → BottomSheet** — 1h
19. **PDF bottom controls** on mobile — 1h

### Phase 5 — Epic 8 Stories
20. **Story 8.1:** PWA install banner, Lighthouse audit
21. **Story 8.2:** Service Worker + Workbox offline cache
22. **Story 8.3–8.6:** Dexie, Outbox, Sync badge, Conflict UI

---

## 13. Acceptance Criteria (PWA UX Layer)

- [ ] App có thể cài lên home screen (iOS Safari + Android Chrome)
- [ ] Không có content bị che bởi notch/Dynamic Island/home indicator
- [ ] Text selection và highlight hoạt động trên iOS Safari
- [ ] EPUB swipe prev/next hoạt động trên mobile
- [ ] PDF zoom bằng pinch-to-zoom không bị block
- [ ] Tất cả buttons có touch target ≥ 44×44px
- [ ] Font size input fields ≥ 16px (không trigger iOS auto-zoom)
- [ ] Search, Settings, Notes list mở bằng bottom sheet trên mobile
- [ ] Reader header tự ẩn sau 3s, tap để hiện lại
- [ ] BottomNav hiển thị trên Library/Notes/Settings, ẩn trong Reader
- [ ] Layout không bị vỡ khi keyboard mở (dvh)
- [ ] Lighthouse PWA score ≥ 90
- [ ] App load < 3s trên 4G (Lighthouse)
