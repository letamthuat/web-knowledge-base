---
title: 'PDF Viewer Rebuild — Trang/Cuộn + PWA Optimization'
type: 'refactor'
created: '2026-05-05'
status: 'ready-for-dev'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PDF Viewer hiện tại có layout bugs khi switch giữa chế độ Trang và Cuộn (mất header, blank area, không scroll được), và scroll/render lag rõ rệt trên PWA do load toàn bộ trang cùng lúc.

**Approach:** Rebuild PDFViewer với một Document duy nhất + scroll container duy nhất; thêm virtualization cho scroll mode (chỉ render các trang gần viewport); đảm bảo layout chain flex đúng từ AppShell xuống đến scroll container.

## Boundaries & Constraints

**Always:**
- Giữ nguyên tất cả tính năng hiện tại: page nav (prev/next/input), zoom (0.5×–3×), mode toggle Trang/Cuộn, restore reading progress, registerJump từ history popover, IntersectionObserver tracking visible page trong scroll mode.
- Lưu tiến độ đọc đúng cho cả hai mode: page mode lưu page number, scroll mode lưu page number của trang visible nhất.
- Layout must not break: toolbar luôn hiển thị, scroll container fill remaining height, không overflow viewport.
- Một `<Document>` duy nhất — không render hai Document; pdfjs worker cache được tái dùng khi switch mode.
- `safePad` CSS (`max(12px, var(--safe-left/right))`) giữ nguyên cho notch safe area.

**Ask First:**
- Nếu cần thêm thư viện mới ngoài react-pdf (đã có) cho virtualization — hỏi trước.
- Nếu muốn thay đổi UX của toolbar (vị trí, icon) khác với spec — hỏi trước.

**Never:**
- Không dùng `display: none` hay `visibility: hidden` để ẩn mode — dùng conditional render.
- Không render hai `<Document>` song song.
- Không dùng `position: absolute` để sizing scroll container — dùng flex.
- Không thêm thư viện mới cho PDF rendering (giữ react-pdf).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Switch Trang → Cuộn | `readMode="page"`, `currentPage=5` | Cuộn mode mount, scroll tới page 5 (no flicker, header giữ nguyên) | Timeout fallback nếu ref chưa sẵn sàng |
| Switch Cuộn → Trang | `readMode="scroll"`, `currentPage=5` | Page mode render page 5, scroll container reset top | N/A |
| PDF load error | File URL lỗi / timeout | Error message centered, không crash layout | Hiện text "Không thể tải PDF..." |
| Zoom thay đổi | scale 0.5–3 | Page re-render tại scale mới, scroll position giữ nguyên | N/A |
| Jump từ history | `registerJump` callback với `{type:"pdf_page", page:N}` | Scroll/navigate tới page N trong mode hiện tại | N/A |
| Scroll mode cuộn | User scroll qua nhiều trang | IntersectionObserver cập nhật currentPage, lưu progress | Không lưu nếu numPages=0 |
| PDF lớn (>100 trang) | Scroll mode với scale cao | Chỉ render trang ±2 quanh visible page (virtualization) | N/A |
| Restore position | `progress.positionType === "pdf_page"` | Sau load, nhảy tới đúng page | Ignore nếu page out of range |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/viewers/pdf/PDFViewer.tsx` — file cần rebuild hoàn toàn
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx:350` — wrapper div của ViewerDispatcher cần `minHeight: 0`
- `apps/web/src/components/viewers/ZoomControls.tsx` — ZoomControls + useZoom (giữ nguyên, chỉ import)
- `apps/web/src/hooks/useReadingProgress.ts` — savePosition API: `{type:"pdf_page", page, offset:0}`
- `apps/web/src/components/viewers/ReaderProgressContext.tsx` — savePosition, registerJump

## Tasks & Acceptance

**Execution:**

- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` -- Thêm `style={{ minHeight: 0 }}` vào div wrapper của ViewerDispatcher (line ~350) nếu chưa có -- đảm bảo flex chain shrink đúng

- [ ] `apps/web/src/components/viewers/pdf/PDFViewer.tsx` -- Rebuild hoàn toàn với:
  1. **Layout:** Root div `flex flex-1 flex-col` + `minHeight:0; overflow:hidden`. Toolbar `shrink-0`. Scroll container `flex:1 1 0; minHeight:0; overflowY:auto; overflowX:auto; display:flex; flexDirection:column; alignItems:center`.
  2. **Một Document duy nhất** bên trong scroll container. Mode switch chỉ thay đổi children của Document.
  3. **Page mode:** Render `<Page pageNumber={currentPage} />` duy nhất. `goToPage` gọi `scrollRef.current.scrollTo({top:0})` để reset vị trí.
  4. **Scroll mode với virtualization:** Render `numPages` divs placeholder. Dùng `VirtualPage` component — dùng IntersectionObserver riêng per-page với `rootMargin:"200px"` để mount `<Page>` khi gần viewport, unmount khi xa (>600px khỏi viewport). Giữ `pageRefs` cho scroll navigation.
  5. **Mode switch:** Khi page→scroll: `setTimeout(100ms)` rồi `pageRefs[p-1].scrollIntoView({block:"start"})`. Không reload PDF.
  6. **Progress tracking scroll mode:** IntersectionObserver trên scroll container với `threshold:[0,0.25,0.5,0.75,1]` — khi page thay đổi gọi `savePosition({type:"pdf_page", page, offset:0}, numPages)`.
  7. **Restore position:** Effect chạy sau `numPages > 0` + `progress` available + `!restored.current`.
  8. **registerJump:** Đăng ký callback, xử lý `pos.type === "pdf_page"`.
  9. **Toolbar:** Giữ nguyên layout: [←][page/total][→] bên trái, [Trang|Cuộn toggle][ZoomControls] bên phải.
  10. **safePad:** `paddingLeft/Right: "max(12px, var(--safe-left/right, 0px))"` trên scroll container.
  11. **PWA scroll performance:** `WebkitOverflowScrolling:"touch"`, `willChange:"scroll-position"` trên scroll container.

**Acceptance Criteria:**

- Given PDF đang ở chế độ Trang, when bấm "Cuộn", then header toolbar không biến mất, scroll container hiển thị tất cả trang, trang hiện tại được scroll vào view.
- Given PDF đang ở chế độ Cuộn, when bấm "Trang", then hiển thị đúng trang đang xem, toolbar vẫn hiện.
- Given PDF có 100+ trang ở scroll mode, when scroll nhanh, then chỉ ~5 trang quanh viewport được render (không render 100 trang cùng lúc).
- Given user đọc đến trang 47 rồi đóng, when mở lại cùng tài liệu, then bắt đầu từ trang 47.
- Given scroll mode, when scroll qua trang, then page input field cập nhật đúng số trang đang xem.
- Given PDF load lỗi, when viewer mount, then hiển thị error message, không crash.
- Given zoom thay đổi, when ở scroll mode, then tất cả trang re-render đúng scale, scroll position không reset.

## Design Notes

**VirtualPage pattern** (virtualization không cần thư viện):
```tsx
function VirtualPage({ pageNum, scale, pageRef }) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: "300px", threshold: 0 }
    );
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={(el) => { wrapperRef.current = el; pageRef.current = el; }}
         style={{ minHeight: "800px" }}> {/* placeholder height */}
      {visible && <Page pageNumber={pageNum} scale={scale} ... />}
    </div>
  );
}
```
Placeholder `minHeight` cần xấp xỉ chiều cao trang để scrollbar không nhảy. Có thể tính từ `page.getViewport({scale})` sau onLoadSuccess.

**Flex layout chain đảm bảo:**
```
AppShell: position:fixed; inset:0; overflow:hidden
  TabPanel: position:absolute; inset:0  (height=viewport tự động)
    ReaderShell root: flex flex-col; overflow:hidden; (không cần flex-1)
      div ViewerDispatcher wrapper: flex flex-1 flex-col; overflow:hidden; minHeight:0
        PDFViewer: flex flex-1 flex-col; minHeight:0; overflow:hidden
          Toolbar: shrink-0
          ScrollContainer: flex:1 1 0; minHeight:0; overflow:auto
```

## Verification

**Commands:**
- `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep PDFViewer` -- expected: no errors

**Manual checks:**
- Mở PDF trên desktop: toolbar hiện, scroll container có scrollbar → OK
- Switch Trang↔Cuộn 5 lần: header không biến mất, không blank area → OK
- Mở PWA trên mobile: scroll mượt, không lag khi cuộn qua nhiều trang → OK
- PDF lớn (50+ trang) scroll mode: mở DevTools Elements, chỉ ~5 `canvas` element tồn tại tại một thời điểm → OK

## Spec Change Log
