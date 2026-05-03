---
title: 'Layer 4 — Page Redesigns: Library Mobile Grid, Reader Mobile Toolbar, SearchModal Full-screen'
type: 'feature'
created: '2026-05-03'
status: 'in-review'
baseline_commit: '5a6ef91'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Library document grid trên mobile dùng layout desktop — card nhỏ, text bị cắt, không tối ưu touch. Reader mobile header bị chật với quá nhiều icon nhỏ. SearchModal trên mobile hiển thị như desktop popup thay vì full-screen.

**Approach:** (1) Library grid mobile 2-column compact với tên file truncate 2 dòng; (2) Reader mobile header gọn lại — chỉ giữ back + title + 3-dot menu, các actions phụ vào BottomSheet; (3) SearchModal trên mobile `sm:` breakpoint → full-screen `inset-0` thay vì center popup.

## Boundaries & Constraints

**Always:**
- Library grid: `grid-cols-2` trên mobile (`< 640px`), `sm:grid-cols-3`, `lg:grid-cols-4 xl:grid-cols-5` giữ nguyên
- Library card mobile: title truncate 2 dòng (`line-clamp-2`), thumbnail giữ aspect-ratio
- Reader mobile 3-dot menu: BottomSheet chứa Download, Search, Notes actions
- SearchModal mobile: `fixed inset-0 pt-0` trên `< 640px`, bỏ `pt-[15vh]`; input full-width; kết quả chiếm toàn màn hình
- Không phá vỡ desktop layout của bất kỳ trang nào

**Ask First:**
- Nếu Reader 3-dot menu cần thêm actions ngoài Download/Search/Notes

**Never:**
- Không xóa desktop nav header trong Reader
- Không thay đổi DocumentCard component core — chỉ tweak grid container + CSS
- Không dùng Radix Dialog cho SearchModal mobile

</frozen-after-approval>

## Code Map

- `apps/web/src/components/library/LibraryPageInner.tsx` — grid container classes (line ~580-603)
- `apps/web/src/components/search/SearchModal.tsx` — modal wrapper (line ~106-112), card (line ~111)
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — mobile header toolbar (line ~267-311), mobile drawer (line ~241-266)
- `apps/web/src/components/ui/BottomSheet.tsx` — reuse for Reader mobile actions menu

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/components/library/LibraryPageInner.tsx` -- Tìm DocumentGrid container, đổi grid classes thành `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`; thêm `[&_.doc-card-title]:line-clamp-2` hoặc đảm bảo DocumentCard title dùng `line-clamp-2` trên mobile -- Library 2-column mobile grid (already satisfied — DocumentGrid.tsx + DocumentCard.tsx đã có sẵn)
- [x] `apps/web/src/components/search/SearchModal.tsx` -- Đổi wrapper từ `fixed inset-0 flex items-start justify-center pt-[15vh]` sang `fixed inset-0 flex flex-col sm:items-start sm:justify-center sm:pt-[15vh]`; đổi card từ `w-full max-w-lg mx-4` sang `w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl`; đổi results max-height sang `flex-1 sm:max-h-[50vh] overflow-y-auto` -- SearchModal full-screen on mobile
- [x] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` -- Thêm `moreMenuOpen` state + BottomSheet; trên mobile header: ẩn Download/Search icon buttons (`hidden sm:flex`); thêm `<button className="sm:hidden ...">⋯</button>` mở BottomSheet với Download + Search actions -- Reader mobile 3-dot menu

**Acceptance Criteria:**
- Given mobile (< 640px) ở Library, when nhìn document grid, then hiển thị 2 cột; title truncate sau 2 dòng
- Given tablet (640px-1023px) ở Library, when nhìn grid, then 3 cột
- Given mobile, when mở SearchModal (tap search tab BottomNav), then modal full-screen không có top padding
- Given desktop, when mở SearchModal (Cmd+K), then modal center popup giữ nguyên như cũ
- Given mobile Reader, when nhìn header, then chỉ thấy back button + title; icon Download/Search ẩn
- Given mobile Reader, when tap ⋯ button, then BottomSheet mở với Download + Search actions

## Design Notes

**SearchModal full-screen pattern:**
```tsx
// wrapper — thêm flex-col cho mobile stack
className="fixed inset-0 z-50 flex flex-col sm:items-start sm:justify-center bg-black/50 sm:pt-[15vh]"

// card — no border-radius on mobile, no margin
className="w-full flex flex-col sm:max-w-lg sm:mx-4 sm:rounded-2xl border bg-card shadow-2xl overflow-hidden"

// results — flex-1 chiếm phần còn lại của màn hình mobile
className="flex-1 sm:max-h-[50vh] overflow-y-auto"
```

**Reader 3-dot BottomSheet:**
```tsx
const [moreMenuOpen, setMoreMenuOpen] = useState(false);
// Trong header (mobile-only):
<button className="sm:hidden p-2" onClick={() => setMoreMenuOpen(true)}>
  <MoreHorizontal className="h-5 w-5" />
</button>
// Ẩn icon riêng lẻ trên mobile:
<button className="hidden sm:flex ...">Download</button>
// BottomSheet:
<BottomSheet open={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} title="Thêm">
  {/* Download + Search buttons */}
</BottomSheet>
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- Mobile (375px): Library grid = 2 columns, SearchModal full-screen, Reader header only shows back+title+⋯
- Desktop (1280px): Library grid = 4-5 columns, SearchModal center popup, Reader header full as before
