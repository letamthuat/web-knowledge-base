---
title: 'Layer 5 — Service Worker + Offline Shell Cache (Story 8.2)'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: '265b76b'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** App không có Service Worker nên không installable offline và Lighthouse PWA score thấp. Khi mất mạng, blank screen thay vì offline fallback.

**Approach:** Tạo `public/sw.js` thủ công (không dùng next-pwa/Workbox plugin để tránh build complexity). SW dùng **Cache-First cho static assets** (JS/CSS/fonts) và **Network-First với offline fallback cho HTML navigation**. Register SW trong `layout.tsx` qua inline script. Offline fallback page là `/offline` — một Next.js static page đơn giản.

## Boundaries & Constraints

**Always:**
- SW file tại `apps/web/public/sw.js` — scope `/`
- Cache static assets (`.js`, `.css`, `.woff2`, `/icons/*`) với Cache-First strategy
- HTML navigation requests: Network-First, fallback về `/offline` nếu offline
- Register SW trong layout qua `<script>` tag (không dùng npm package)
- `/offline` page: static Next.js page, hiện thông báo offline đơn giản
- SW version constant `CACHE_VERSION = "v1"` — tăng khi cần bust cache

**Ask First:**
- Nếu muốn cache API responses (Convex WebSocket không cacheable — chỉ cache HTTP assets)

**Never:**
- Không cache Convex API calls hay WebSocket traffic
- Không dùng `next-pwa`, `workbox-webpack-plugin`, hay bất kỳ build plugin nào
- Không implement background sync trong story này (đó là 8.4)
- Không cache document files (PDF/EPUB) trong SW — quá lớn, dùng Dexie (8.3)

</frozen-after-approval>

## Code Map

- `apps/web/public/sw.js` — NEW: service worker file
- `apps/web/src/app/offline/page.tsx` — NEW: offline fallback page
- `apps/web/src/app/layout.tsx` — thêm SW registration script

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/public/sw.js` -- Tạo SW với `CACHE_VERSION = "v1"`; `install` event: cache shell assets (`/`, `/offline`, `/manifest.webmanifest`, `/_next/static/**`); `activate` event: xóa caches cũ; `fetch` event: static assets → Cache-First; HTML navigation (`Accept: text/html`) → Network-First với fallback `/offline` -- Service worker
- [x] `apps/web/src/app/offline/page.tsx` -- Tạo static page đơn giản: icon mất kết nối, tiêu đề "Không có kết nối", mô tả "Vui lòng kiểm tra mạng và thử lại", nút "Thử lại" (`window.location.reload()`) -- Offline fallback page
- [x] `apps/web/src/app/layout.tsx` -- Thêm SW registration vào `<head>`: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')` -- SW registration

**Acceptance Criteria:**
- Given Chrome DevTools → Application → Service Workers, when tải app, then SW registered với scope `/`
- Given network offline (DevTools → Network → Offline), when navigate to `/library`, then `/offline` page hiện thay vì blank screen
- Given static assets đã cached, when reload khi offline, then page load từ cache (không blank)
- Given SW version tăng (CACHE_VERSION mới), when SW activate, then caches cũ bị xóa

## Design Notes

**SW fetch strategy:**
```js
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Static assets: Cache-First
  if (request.destination === "script" || request.destination === "style"
      || request.destination === "font" || request.url.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // HTML navigation: Network-First with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request, "/offline"));
    return;
  }
  // Default: network only
});
```

**Cache-First helper:**
```js
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- Chrome DevTools → Application → Service Workers: status "activated and running"
- DevTools → Application → Cache Storage: cache entries visible
- DevTools → Network tab → set Offline → refresh: `/offline` page renders
- Lighthouse → PWA audit: "Registers a service worker" passes
