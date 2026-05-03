---
title: 'Layer 1 — PWA Foundation: Safe Area, DVH, Z-index, Touch, Manifest'
type: 'chore'
created: '2026-05-03'
status: 'done'
baseline_commit: '154598c8143d678179e4f308d642712323afb7b2'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** App chưa sẵn sàng cho PWA: không xử lý notch/safe-area, layout vỡ khi keyboard mở (`h-screen` không tính keyboard), z-index không nhất quán, input font-size < 16px trigger iOS auto-zoom, manifest không có icons nên không cài được lên home screen.

**Approach:** Thêm CSS vars safe area + `viewport-fit=cover`, đổi `h-screen` → `h-dvh` toàn app, khai báo z-index system, fix input font-size, tạo PWA icons + manifest đầy đủ. Không thay đổi tính năng — chỉ fix layout/CSS/assets.

## Boundaries & Constraints

**Always:**
- `viewport-fit=cover` bắt buộc để safe area hoạt động trên iOS
- `h-dvh` (dynamic viewport height) thay `h-screen` — fallback `100svh` cho browser cũ
- Input fields phải có font-size ≥ 16px trên mobile để tránh iOS auto-zoom
- Manifest dùng tên file `manifest.webmanifest` (thay `manifest.json`); link trong layout cập nhật tương ứng
- Icons: 4 file PNG (192, 512, 192-maskable, 512-maskable) + apple-touch-icon 180px

**Ask First:**
- Nếu đổi `h-dvh` gây layout lạ ở trang nào cụ thể thì dừng hỏi trước

**Never:**
- Không thay đổi logic, routing, hay Convex queries
- Không thêm dependency mới ngoài script tạo icon (dùng Node canvas hoặc sharp đã có)
- Không sửa màu/branding hiện tại

</frozen-after-approval>

## Code Map

- `apps/web/src/app/layout.tsx` — viewport meta + manifest link + safe-area script
- `apps/web/src/styles/globals.css` — CSS vars safe-area, z-index system, dvh fallback, input font-size, touch target
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — `h-screen` → `h-dvh` + safe-area padding trên headers
- `apps/web/src/components/notes/NotesPageInner.tsx` — `h-screen` → `h-dvh` + safe-area padding trên header
- `apps/web/src/components/library/LibraryPageInner.tsx` — `h-screen` → `h-dvh` + safe-area padding trên header
- `apps/web/src/app/settings/page.tsx` — `min-h-screen` → `min-h-dvh`
- `apps/web/src/app/login/page.tsx` — `min-h-screen` → `min-h-dvh`
- `apps/web/src/app/signup/page.tsx` — `min-h-screen` → `min-h-dvh`
- `apps/web/src/app/library/trash/page.tsx` — `min-h-screen` → `min-h-dvh`
- `apps/web/src/app/notes/page.tsx` — `min-h-screen` → `min-h-dvh`
- `apps/web/public/manifest.webmanifest` — NEW: manifest đầy đủ với icons
- `apps/web/public/manifest.json` — XÓA (thay bằng .webmanifest)
- `apps/web/public/icons/` — NEW: 5 icon files (PNG)
- `apps/web/scripts/generate-icons.mjs` — NEW: script tạo icon PNG bằng canvas/sharp

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/layout.tsx` -- Thêm `viewport-fit=cover` vào viewport export; cập nhật `manifest` metadata link → `/manifest.webmanifest`; thêm icons metadata -- Safe area + manifest link
- [x] `apps/web/src/styles/globals.css` -- Thêm `:root` safe-area vars; z-index vars (một block duy nhất); `@media max-width:767px` input font-size nhưng exclude `text-2xl` selector; `100vh` fallback trước `100dvh` cho shell containers -- Foundation CSS
- [x] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` -- Replace `h-screen` → `h-dvh`; thêm `style={{ paddingTop: 'var(--safe-top)' }}` vào tất cả `<header>` elements -- Keyboard layout + notch fix
- [x] `apps/web/src/components/notes/NotesPageInner.tsx` -- Replace `h-screen` → `h-dvh`; thêm safe-area padding vào `<header>` -- Keyboard layout + notch fix
- [x] `apps/web/src/components/library/LibraryPageInner.tsx` -- Replace `h-screen`/`min-h-screen` → dvh equivalents; thêm safe-area padding vào header -- Keyboard layout + notch fix
- [x] Remaining pages (`settings`, `login`, `signup`, `trash`, `notes`, `library`) -- Replace `min-h-screen` → `min-h-dvh` -- Consistency
- [x] `apps/web/public/manifest.json` -- Xóa file cũ để tránh conflict với .webmanifest -- Cleanup
- [x] `apps/web/scripts/generate-icons.mjs` -- Script Node.js dùng sharp render SVG "WKB" → PNG 192/512 -- Icon generation
- [x] `apps/web/public/icons/` -- 5 PNG files: icon-192, icon-512, icon-192-maskable, icon-512-maskable, apple-touch-icon -- PWA installable
- [x] `apps/web/public/manifest.webmanifest` -- Manifest đầy đủ với icons array 4 entries -- PWA installable

**Acceptance Criteria:**
- Given mở app trên iPhone có notch, when header render, then header không bị che bởi notch (safe-area-inset-top applied)
- Given mở app trên iPhone, when soft keyboard mở, then layout không bị scroll/vỡ (dvh hoạt động)
- Given tap vào input field trên iOS Safari, when focus, then trang không bị zoom in (font-size ≥ 16px)
- Given Chrome Android, when vào app, then có thể "Add to Home Screen" (manifest có icons hợp lệ)
- Given Safari iOS, when Share → Add to Home Screen, then icon WKB xuất hiện trên home screen
- Given Lighthouse PWA audit, when chạy, then "Installable" pass (manifest + icons valid)

## Design Notes

**DVH vs SVH vs VH:**
- `dvh` = dynamic viewport height (tính lại khi browser chrome ẩn/hiện) — dùng cho main layout containers
- `svh` = small viewport height (worst case, browser chrome fully shown) — dùng cho modal/overlay minimum height
- Tailwind 3.3+ hỗ trợ `h-dvh`, `min-h-dvh` natively. Kiểm tra version trước; nếu chưa hỗ trợ dùng arbitrary `h-[100dvh]`.

**Icon maskable:** Maskable icons cần safe zone 20% padding (icon visible area là circle 80%). Design WKB text nhỏ hơn một chút để không bị crop trên Android adaptive icons.

**manifest.webmanifest vs manifest.json:** Spec PWA khuyến nghị `.webmanifest` extension với MIME type `application/manifest+json`. Next.js metadata API accept cả hai — chỉ cần đổi path string.

## Spec Change Log

**Loop 1 — 2026-05-03:**
- **Triggering finding (bad_spec):** `--safe-top` CSS var define trong `:root` nhưng không có task apply vào `<header>` → AC1 fail.
- **Amended:** Thêm sub-task apply `style={{ paddingTop: 'var(--safe-top)' }}` vào header elements trong Reader, Notes, Library.
- **Known-bad state avoided:** Header bị che bởi notch trên iPhone.
- **Patches bundled:** Merge 2 `:root` blocks thành 1; fix `--z-base:1`; exclude `text-2xl` inputs từ font-size `!important`; thêm `100vh` fallback trước `100dvh`; xóa `manifest.json` cũ.
- **KEEP:** `viewportFit: "cover"`, `h-dvh` replacement toàn app, icons + manifest structure đã đúng.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no type errors
- `node apps/web/scripts/generate-icons.mjs` -- expected: 5 PNG files xuất hiện trong `apps/web/public/icons/`

**Manual checks:**
- Mở DevTools → Application → Manifest: kiểm tra icons array không rỗng, installability criteria pass
- Mở app trên iOS simulator: header không bị notch che, keyboard không vỡ layout
- Inspect `<html>` element: `viewport-fit=cover` có trong meta viewport

## Suggested Review Order

**Safe Area Foundation**

- Entry point: CSS vars + z-index system + dvh fallback + font-size fix trong một `:root` block
  [`globals.css:62`](../../apps/web/src/styles/globals.css#L62)

- `viewport-fit=cover` enable safe area; manifest link + icons metadata
  [`layout.tsx:28`](../../apps/web/src/app/layout.tsx#L28)

**Notch Protection — Headers**

- Reader main header nhận `paddingTop: var(--safe-top)` — notch không che content
  [`ReaderPageInner.tsx:247`](../../apps/web/src/app/reader/%5BdocId%5D/ReaderPageInner.tsx#L247)

- Error/loading state headers cũng được protect
  [`ReaderPageInner.tsx:405`](../../apps/web/src/app/reader/%5BdocId%5D/ReaderPageInner.tsx#L405)

- Notes page header
  [`NotesPageInner.tsx:139`](../../apps/web/src/components/notes/NotesPageInner.tsx#L139)

- Library page header (sticky)
  [`LibraryPageInner.tsx:376`](../../apps/web/src/components/library/LibraryPageInner.tsx#L376)

**DVH — Keyboard Layout Fix**

- Reader shell: `h-dvh` với 100vh fallback qua CSS class override
  [`ReaderPageInner.tsx:208`](../../apps/web/src/app/reader/%5BdocId%5D/ReaderPageInner.tsx#L208)

- Notes shell
  [`NotesPageInner.tsx:111`](../../apps/web/src/components/notes/NotesPageInner.tsx#L111)

**PWA Install Assets**

- Manifest đầy đủ: standalone, icons 192+512+maskable, shortcuts
  [`manifest.webmanifest:1`](../../apps/web/public/manifest.webmanifest#L1)

- Icon generator script (sharp → PNG)
  [`generate-icons.mjs:1`](../../apps/web/scripts/generate-icons.mjs#L1)
