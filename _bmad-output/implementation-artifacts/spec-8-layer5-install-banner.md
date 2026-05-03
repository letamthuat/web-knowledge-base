---
title: 'Layer 5 — PWA Install Banner (Story 8.1)'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'edf9782'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** App đã đủ điều kiện PWA (manifest + icons + HTTPS) nhưng không có cơ chế prompt người dùng cài lên home screen. Trên Android Chrome, `beforeinstallprompt` event bị bỏ qua; trên iOS Safari không có native prompt nên cần hướng dẫn thủ công.

**Approach:** Tạo `InstallBanner` component: lắng nghe `beforeinstallprompt` (Android) → hiện banner bottom; trên iOS Safari (detect `navigator.standalone === false` + userAgent) → hiện banner hướng dẫn "Share → Add to Home Screen". Banner chỉ hiện 1 lần (localStorage flag). Mount trong root layout, chỉ render trên mobile.

## Boundaries & Constraints

**Always:**
- Banner chỉ render trên mobile (`md:hidden`)
- Dismiss → set `localStorage.setItem("pwa-install-dismissed", "1")` → không hiện lại
- Android: dùng `e.prompt()` từ `beforeinstallprompt` event
- iOS: hiện hướng dẫn text "Nhấn Share → 'Thêm vào màn hình chính'"
- Banner position: `fixed bottom-[72px]` (trên BottomNav 56px + 16px gap), `z-[45]`
- Banner style: `mx-4 rounded-xl bg-card border shadow-lg px-4 py-3`

**Ask First:**
- Nếu muốn hiện banner lại sau X ngày thay vì dismiss vĩnh viễn

**Never:**
- Không hiện trên desktop
- Không block content — banner overlay dạng toast, không modal
- Không dùng service worker trong story này (đó là 8.2)

</frozen-after-approval>

## Code Map

- `apps/web/src/components/pwa/InstallBanner.tsx` — NEW: install prompt component
- `apps/web/src/app/layout.tsx` — mount `<InstallBanner />` alongside BottomNav

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/components/pwa/InstallBanner.tsx` -- Tạo component: `useEffect` lắng nghe `beforeinstallprompt`, lưu event; detect iOS Safari (`/iphone|ipad|ipod/i.test(navigator.userAgent) && !('standalone' in window && (window.navigator as any).standalone)`); check localStorage dismissed flag; render banner với "Cài ứng dụng" title, mô tả ngắn, nút "Cài đặt" (Android) hoặc hướng dẫn icon (iOS), nút ✕ dismiss -- PWA install banner
- [x] `apps/web/src/app/layout.tsx` -- Import và mount `<InstallBanner />` sau `<BottomNav />` -- Global mount

**Acceptance Criteria:**
- Given Android Chrome, app chưa installed, chưa dismiss, when load trang, then banner xuất hiện phía trên BottomNav
- Given tap "Cài đặt" trên Android, when tap, then native install prompt mở
- Given iOS Safari, app chưa installed, when load trang, then banner hiện hướng dẫn Share → Add to Home Screen
- Given tap ✕ dismiss, when reload trang, then banner không còn hiện (localStorage flag)
- Given desktop (≥768px), when nhìn màn hình, then banner không hiện
- Given app đã được installed (standalone mode), when load, then banner không hiện

## Design Notes

**iOS detection:**
```tsx
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = (window.navigator as any).standalone === true;
const showIOSHint = isIOS && !isStandalone;
```

**Android beforeinstallprompt:**
```tsx
const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
useEffect(() => {
  function handler(e: Event) { e.preventDefault(); setDeferredPrompt(e); }
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}, []);
```

**Dismiss logic:**
```tsx
const DISMISSED_KEY = "pwa-install-dismissed";
// on mount: if localStorage.getItem(DISMISSED_KEY) → don't show
// on dismiss: localStorage.setItem(DISMISSED_KEY, "1")
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- Chrome DevTools → Application → Manifest: installability criteria met
- Simulate `beforeinstallprompt`: DevTools → Application → Service Workers → Add to Home Screen
- iOS: open in Safari, verify banner text visible
- Dismiss: verify localStorage `pwa-install-dismissed` = "1" after tap ✕
