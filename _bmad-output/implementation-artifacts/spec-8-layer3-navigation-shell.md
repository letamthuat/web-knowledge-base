---
title: 'Layer 3 — Navigation Shell: BottomSheet, BottomNav, Reader Header Auto-hide'
type: 'feature'
created: '2026-05-03'
status: 'in-review'
baseline_commit: 'c65535afcba86f3f234ce9271bfae375a2ee05f8'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trên mobile, navigation chiếm quá nhiều screen space — header cố định + desktop nav links không phù hợp touch interface. Không có bottom navigation bar tiêu chuẩn mobile. Reader header luôn hiển thị, che mất content khi đọc. Không có shared bottom sheet component cho các overlays (settings, search, TOC).

**Approach:** (1) Tạo `BottomSheet` component dùng chung — slide-up, drag-to-dismiss, body scroll lock; (2) Tạo `BottomNav` component 4 tabs (Library/Notes/Search/Settings) chỉ hiện trên mobile ≤767px, ẩn trong Reader; (3) Reader header auto-hide sau 3s idle, tap content để toggle lại. BottomNav được mount trong root layout để persist across pages.

## Boundaries & Constraints

**Always:**
- BottomSheet: drag handle visible, swipe-down 40% height → close, backdrop tap → close, body scroll lock khi open
- BottomSheet: `padding-bottom: var(--safe-bottom)` để tránh home indicator
- BottomNav: chỉ render trên `max-width: 767px` (CSS media query hoặc Tailwind `md:hidden`)
- BottomNav: ẩn hoàn toàn trong `/reader/*` routes
- BottomNav height: 56px + safe-area-bottom — thêm `pb-14 md:pb-0` vào page containers để tránh content bị che
- Reader auto-hide: header ẩn sau 3s không có interaction; tap anywhere on content → toggle; `readingMode` (fullscreen) không ảnh hưởng (đã ẩn header rồi)
- Không refactor toàn bộ 3 page headers — chỉ thêm BottomNav + auto-hide logic vào Reader

**Ask First:**
- Nếu BottomNav cần hiển thị trên Settings page hay chỉ Library/Notes

**Never:**
- Không xóa mobile drawer hiện tại (vẫn giữ cho desktop compatibility)
- Không thay đổi TabBar component
- Không sửa routing hay Convex queries
- Không dùng Radix Dialog cho BottomSheet (tự implement để kiểm soát animation)

</frozen-after-approval>

## Code Map

- `apps/web/src/components/ui/BottomSheet.tsx` — NEW: shared bottom sheet component
- `apps/web/src/components/nav/BottomNav.tsx` — NEW: 4-tab bottom navigation bar
- `apps/web/src/app/layout.tsx` — mount BottomNav globally (ẩn trong reader via CSS/route check)
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm auto-hide logic cho header; thêm bottom padding body cho BottomNav
- `apps/web/src/components/notes/NotesPageInner.tsx` — thêm `pb-14 md:pb-0` cho main container
- `apps/web/src/components/library/LibraryPageInner.tsx` — thêm `pb-14 md:pb-0` cho main container
- `apps/web/src/app/settings/page.tsx` — thêm `pb-14 md:pb-0`

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/components/ui/BottomSheet.tsx` -- Tạo component: props `open`, `onClose`, `children`, `title?`; render fixed overlay + slide-up panel; drag handle; swipe-down gesture (touch delta > 40% panel height → close); backdrop click → close; `useEffect` body scroll lock; `padding-bottom: var(--safe-bottom)` -- Shared bottom sheet
- [x] `apps/web/src/components/nav/BottomNav.tsx` -- Tạo component 4 tabs: Thư viện (`/library`), Ghi chú (`/notes`), Tìm kiếm (trigger SearchModal), Cài đặt (`/settings`); dùng `usePathname()` để detect active tab; `className="fixed bottom-0 left-0 right-0 md:hidden z-[40]"`; height 56px + `padding-bottom: var(--safe-bottom)`; background `bg-card/90 backdrop-blur-sm border-t` -- Bottom navigation
- [x] `apps/web/src/app/layout.tsx` -- Import và mount `<BottomNav />` bên trong `RecordingProvider`; trước `<AppSettingsPanel />` -- Global mount
- [x] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` -- Thêm `headerVisible` state; useEffect auto-hide 3s; wrap header với opacity transition -- Reader auto-hide
- [x] `apps/web/src/components/notes/NotesPageInner.tsx` -- Thêm `pb-14 md:pb-0` vào main content area -- Notes bottom padding
- [x] `apps/web/src/components/library/LibraryPageInner.tsx` -- Thêm `pb-14 md:pb-0` vào main container -- Library bottom padding
- [x] `apps/web/src/app/settings/page.tsx` -- Thêm `pb-14 md:pb-0` -- Settings bottom padding

**Acceptance Criteria:**
- Given mobile (≤767px) ở Library page, when nhìn màn hình, then BottomNav hiện ở dưới cùng với 4 tabs
- Given BottomNav hiện, when tap "Ghi chú", then navigate sang `/notes`; tab Ghi chú active
- Given BottomNav hiện, when tap "Tìm kiếm", then SearchModal mở
- Given mobile ở `/reader/*`, when nhìn màn hình, then BottomNav không hiện
- Given desktop (≥768px), when nhìn màn hình, then BottomNav không hiện
- Given Reader mở trên mobile, when đọc 3 giây không chạm, then header tự ẩn
- Given header đã ẩn, when tap vào content, then header hiện lại
- Given BottomSheet open, when swipe-down > 40% height, then sheet đóng
- Given BottomSheet open, when tap backdrop, then sheet đóng
- Given BottomSheet open, when scroll trong sheet, then body không scroll

## Design Notes

**Auto-hide timer pattern:**
```tsx
const timerRef = useRef<ReturnType<typeof setTimeout>>();
function resetTimer() {
  setHeaderVisible(true);
  clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => setHeaderVisible(false), 3000);
}
useEffect(() => {
  resetTimer();
  document.addEventListener("pointermove", resetTimer, { passive: true });
  document.addEventListener("touchstart", resetTimer, { passive: true });
  return () => {
    clearTimeout(timerRef.current);
    document.removeEventListener("pointermove", resetTimer);
    document.removeEventListener("touchstart", resetTimer);
  };
}, []);
```

**BottomSheet drag-to-dismiss:**
Track `touchstart` Y on panel, `touchmove` delta, `touchend` — if delta > panelHeight * 0.4 → close with CSS translate animation.

**BottomNav active detection:**
`usePathname()` từ `next/navigation`: `/library` → Library active, `/notes` → Notes active, `/settings` → Settings active, `/reader/*` → ẩn toàn bộ BottomNav.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- Mobile viewport: BottomNav visible trên Library/Notes/Settings, ẩn trên Reader
- Reader: header tự ẩn sau 3s, tap → hiện lại
- BottomSheet: drag-to-dismiss + backdrop close hoạt động
- Content không bị BottomNav che (pb-14 applied)
