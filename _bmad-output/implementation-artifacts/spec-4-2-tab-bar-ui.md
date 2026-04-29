---
title: 'Story 4.2 — Tab bar UI (open/close/switch + 10-tab limit)'
type: 'feature'
created: '2026-04-29'
status: 'in-progress'
baseline_commit: 'a9c7a112db25ea0b83d5a0960f8240e90deec5fa'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Không có UI nào để mở, đóng, hoặc chuyển giữa nhiều tài liệu — mỗi lần mở doc phải quay lại thư viện.

**Approach:** Thêm tab bar nằm giữa header và viewer trong reader layout; thêm nút "Mở trong tab" vào DocumentCard menu; mobile (< 768px) hiển thị TabDropdown thay TabBar khi ≥ 4 tabs.

## Boundaries & Constraints

**Always:**
- Tab bar nằm ở reader layout (`ReaderPageInner.tsx`), phía dưới header h-12, trên viewer
- Mỗi tab hiển thị: format icon + title truncated + nút × close
- Click tab → `setActive(tabId)` + `router.push(/reader/[docId])`
- Nút "Mở trong tab" trong DocumentCard dropdown menu → `openTab(docId)` + navigate
- 10-tab limit: catch ConvexError VALIDATION từ `openTab`, toast VI "Tối đa 10 tab cùng lúc"
- Mobile < 768px VÀ ≥ 4 tabs: dùng `TabDropdown` (select-style) thay `TabBar` (horizontal)
- Tab đang active highlighted rõ ràng (border-b-2 border-primary hoặc tương đương)
- `isLoading` từ `useTabSync` → không render tab bar khi đang load (tránh flash)
- Tất cả UI text tiếng Việt; tap target ≥ 44×44px trên mobile

**Ask First:**
- Nếu cần thêm tab bar vào các trang ngoài reader (vd: library page)

**Never:**
- Không implement drag-drop (Story 4.3)
- Không implement close-all / reopen last (Story 4.5)
- Không thêm tab state vào Zustand (chỉ dùng `useTabSync` reactive)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở tab từ library | Click "Mở trong tab" trên card | `openTab(docId)` → navigate `/reader/[docId]`, tab bar hiện tab mới active | — |
| Mở tab thứ 11 | User đã có 10 tabs, click "Mở trong tab" | Toast "Tối đa 10 tab cùng lúc", không navigate | Catch ConvexError VALIDATION |
| Click tab khác | Click tab không active | `setActive` + `router.push(/reader/[docId])` | — |
| Đóng tab active | Click × trên tab đang active | `closeTab` → tab kế được active, navigate sang docId đó | Nếu không còn tab nào → về `/library` |
| Đóng tab không active | Click × trên tab khác | `closeTab`, tab bar cập nhật, không navigate | — |
| 0 tabs | User chưa mở tab nào | Tab bar ẩn hoàn toàn (không render) | — |
| 1–3 tabs trên mobile | < 768px, ≤ 3 tabs | Hiển thị TabBar horizontal | — |
| ≥ 4 tabs trên mobile | < 768px, ≥ 4 tabs | Hiển thị TabDropdown | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — reader layout, nơi insert tab bar
- `apps/web/src/hooks/useTabSync.ts` — reactive tabs data + mutations (Story 4.1)
- `apps/web/src/components/tabs/TabBar.tsx` — cần tạo mới, desktop horizontal tab bar
- `apps/web/src/components/tabs/TabDropdown.tsx` — cần tạo mới, mobile select-style
- `apps/web/src/components/library/DocumentCard.tsx` — thêm "Mở trong tab" vào dropdown
- `apps/web/src/components/library/DocumentCard.tsx:27` — FORMAT_ICONS map để reuse trong tab

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/components/tabs/TabBar.tsx` -- tạo mới: horizontal tab list, format icon + truncated title + × button, active tab highlighted -- desktop tab UI
- [ ] `apps/web/src/components/tabs/TabDropdown.tsx` -- tạo mới: select-style dropdown listing open tabs, hiển thị khi mobile < 768px VÀ ≥ 4 tabs -- mobile tab UI
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` -- insert tab bar giữa header và viewer; dùng `useTabSync`; navigate khi switch/close tab -- wire UI vào layout
- [ ] `apps/web/src/components/library/DocumentCard.tsx` -- thêm DropdownMenuItem "Mở trong tab" vào menu 3-dot; gọi `openTab` + navigate -- entry point mở tab từ library

**Acceptance Criteria:**
- Given user ở `/library`, when click "Mở trong tab" trên card, then tab mới xuất hiện trong tab bar và navigate đến `/reader/[docId]`
- Given user đang đọc, when click tab khác trong tab bar, then navigate sang doc đó và tab đó active
- Given user click × trên tab active, then tab bị đóng; nếu còn tab khác thì navigate sang tab kế; nếu không còn tab nào thì về `/library`
- Given user có 10 tabs, when click "Mở trong tab", then toast "Tối đa 10 tab cùng lúc" và không navigate
- Given mobile < 768px và ≥ 4 tabs, then TabDropdown hiển thị thay TabBar
- Given 0 tabs, then tab bar không render (không có khoảng trống trống)

## Design Notes

**Tab item layout (TabBar):**
```tsx
<div className="flex h-9 items-center gap-1.5 px-3 border-r cursor-pointer shrink-0 max-w-[180px]
  border-b-2 border-transparent [&.active]:border-primary [&.active]:bg-muted/50">
  <FormatIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  <span className="truncate text-xs">{title}</span>
  <button onClick={onClose} className="ml-auto h-4 w-4 shrink-0 ...">×</button>
</div>
```

**Đóng tab và navigate:**
```tsx
async function handleClose(tab) {
  await closeTab(tab._id);
  if (tab.isActive) {
    const next = tabs.find(t => t._id !== tab._id);
    if (next) router.push(`/reader/${next.docId}`);
    else router.push('/library');
  }
}
```

**Catch 10-tab limit:**
```tsx
try {
  await openTab(docId);
  router.push(`/reader/${docId}`);
} catch (e) {
  if (e?.data?.code === 'VALIDATION') toast.error(e.data.messageVi);
}
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: không có lỗi mới từ files đã thay đổi

**Manual checks:**
- Mở library → click "Mở trong tab" → tab xuất hiện, navigate đúng
- Mở 10 tabs → thử mở tab thứ 11 → toast tiếng Việt
- Click × trên tab đang active → navigate sang tab kế hoặc về library
- Thu hẹp browser < 768px + mở ≥ 4 tabs → TabDropdown xuất hiện
