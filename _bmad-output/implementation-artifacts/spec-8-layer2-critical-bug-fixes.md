---
title: 'Layer 2 — Critical Bug Fixes: iOS Text Selection, EPUB Swipe, Modal Scroll Lock'
type: 'bugfix'
created: '2026-05-03'
status: 'done'
baseline_commit: '57aeb373a58f0aba3872061580590d49b4092f7d'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ba bug critical trên mobile PWA: (1) Text selection + highlight không hoạt động trên iOS Safari vì chỉ có `onMouseUp` — touch không trigger mouseup; (2) EPUB swipe prev/next không hoạt động vì epubjs render vào iframe, React synthetic touch events trên wrapper div không capture events bên trong iframe; (3) SearchModal không lock body scroll khi mở — background content vẫn scroll được trên iOS, gây UX lộn xộn.

**Approach:** (1) Đổi `onMouseUp` → thêm `onPointerUp` (unified mouse+touch) trong MarkdownViewer; (2) Attach native `addEventListener` trực tiếp vào iframe content window sau khi rendition ready; (3) Thêm body scroll lock (`overflow:hidden`) khi SearchModal mở, cleanup khi đóng.

## Boundaries & Constraints

**Always:**
- MarkdownViewer: dùng `onPointerUp` thay `onMouseUp` — giữ nguyên toàn bộ handler logic, chỉ thay event binding
- EPUB swipe: attach vào `iframe.contentWindow` với `{ passive: true }` — không block scrolling
- EPUB swipe: threshold giữ nguyên (dx > 50px, dy < 30px abort)
- Body scroll lock: dùng `document.body.style.overflow = 'hidden'` khi open, restore khi close + cleanup on unmount
- Không thay đổi highlight logic, EPUB render logic, hay search logic

**Ask First:**
- Nếu `onPointerUp` gây double-fire trên desktop (pointer + mouse event cùng lúc) thì hỏi trước

**Never:**
- Không thay đổi highlight data model hay Convex mutations
- Không thêm thư viện scroll lock mới (tự implement đủ đơn giản)
- Không sửa EPUBViewer flow toggle hay typography logic

</frozen-after-approval>

## Code Map

- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — line ~515: `onMouseUp` handler → đổi sang `onPointerUp`
- `apps/web/src/components/viewers/epub/EPUBViewer.tsx` — line ~94: rendition init; line ~203: wrapper div touch events → thêm native iframe listener
- `apps/web/src/components/search/SearchModal.tsx` — line ~49: open/close state; line ~97: container — thêm body scroll lock useEffect

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` -- Thay `onMouseUp={handleMouseUp}` → `onPointerUp={handleMouseUp}` trên content wrapper div (line ~515) -- iOS touch trigger fix
- [x] `apps/web/src/components/viewers/epub/EPUBViewer.tsx` -- Sau khi `rendition.display()` resolve, attach native touch listeners vào iframe content window: `rendition.on("rendered", ...)` → query `viewerRef.current?.querySelector("iframe")` → attach `touchstart`/`touchend` với `{ passive: true }`; xóa listeners trong cleanup -- EPUB swipe iframe fix
- [x] `apps/web/src/components/search/SearchModal.tsx` -- Thêm `useEffect` theo dõi `open` prop: khi `open=true` set `document.body.style.overflow = 'hidden'`, khi `open=false` hoặc unmount restore `document.body.style.overflow = ''` -- Body scroll lock

**Acceptance Criteria:**
- Given MarkdownViewer mở trên iOS Safari, when user long-press và drag để select text, then highlight menu xuất hiện
- Given MarkdownViewer mở trên desktop Chrome, when user mouseup sau khi select text, then highlight menu vẫn xuất hiện (không regression)
- Given EPUB viewer paginated mode trên mobile, when swipe left 60px, then sang trang tiếp theo
- Given EPUB viewer paginated mode trên mobile, when swipe right 60px, then về trang trước
- Given EPUB viewer continuous mode trên mobile, when swipe left, then next() được gọi (dù có thể không visible change)
- Given SearchModal đang mở trên iOS, when scroll finger trên backdrop, then background content không scroll
- Given SearchModal đóng, when scroll trang, then body scroll hoạt động bình thường trở lại

## Design Notes

**onPointerUp vs onMouseUp vs onTouchEnd:**
- `onPointerUp` là unified event: fire cho cả mouse, touch, stylus — 1 handler thay 2. Không cần thêm `onTouchEnd` riêng.
- Trên desktop: `pointerup` fire thay `mouseup`, behavior identical cho selection detection.
- Rủi ro double-fire: chỉ xảy ra nếu browser fire cả `pointerup` lẫn `mouseup` — modern browsers không làm vậy khi `onPointerUp` được set.

**EPUB iframe native listener:**
- React synthetic events không bubble qua iframe boundary — đây là browser security model, không phải bug.
- `rendition.on("rendered", cb)` fire mỗi lần section/chapter render, cần re-attach sau mỗi lần destroy/re-init.
- Cleanup: store listener refs trong useRef để `removeEventListener` đúng khi destroy.

**Body scroll lock pattern:**
```tsx
useEffect(() => {
  if (open) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
  return () => { document.body.style.overflow = ''; };
}, [open]);
```

## Spec Change Log

**Loop 1 — 2026-05-03 (patches from review):**
- Duplicate iframe listeners: thêm `attachedWin` guard — chỉ attach khi `win !== attachedWin`.
- Stale iframe ref in cleanup: cleanup dùng `attachedWin` (captured at attach time) thay vì query DOM lại.
- `renditionRef.current` as dep: thay bằng `renditionKey` state (incremented khi rendition re-created).
- `setRenditionKey((k) => k + 1)` sau `renderTo()` để trigger re-attach effect.
- **KEEP:** `onPointerUp`, body scroll lock pattern, passive listener options đều đúng.

**Deferred:**
- SearchModal multi-modal overflow race: nếu sau này có multiple modals cùng lúc, cần ref-counting cho body scroll lock.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- iOS Safari: select text trong MarkdownViewer → highlight menu hiện ra
- Mobile Chrome: swipe EPUB paginated → trang thay đổi
- Mobile: mở Search → scroll finger trên backdrop → body không scroll

## Suggested Review Order

**iOS Text Selection Fix**

- `onPointerUp` replaces `onMouseUp` — unified mouse+touch, one-line change
  [`MarkdownViewer.tsx:515`](../../apps/web/src/components/viewers/markdown/MarkdownViewer.tsx#L515)

**EPUB Swipe via Iframe Native Listeners**

- `renditionKey` state incremented on every rendition re-create to trigger effect re-run
  [`EPUBViewer.tsx:95`](../../apps/web/src/components/viewers/epub/EPUBViewer.tsx#L95)

- Native touch listener effect: `attachedWin` guard prevents duplicates, cleanup uses captured ref
  [`EPUBViewer.tsx:173`](../../apps/web/src/components/viewers/epub/EPUBViewer.tsx#L173)

**Search Modal Scroll Lock**

- `useEffect` on `open` prop: sets/clears `document.body.style.overflow`
  [`SearchModal.tsx:80`](../../apps/web/src/components/search/SearchModal.tsx#L80)
