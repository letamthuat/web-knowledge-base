---
title: 'Story 5.2 — Sticky Note đính kèm Highlight'
type: 'feature'
created: '2026-05-01'
status: 'in-progress'
baseline_commit: '0d3f36c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** User highlight text nhưng không thể ghi chú ngắn kèm theo — insight bị mất khi rời khỏi đoạn đó.

**Approach:** Trong HighlightMenu thêm nút "Thêm ghi chú"; mở inline popover nhỏ để gõ note ngắn (plain text, tối đa 500 ký tự); lưu vào field `note` của highlight trong Convex; khi hover/click vào highlight có note thì hiện bubble hiển thị note đó. Hỗ trợ Ctrl/Cmd+N để mở note cho highlight đang được chọn.

## Boundaries & Constraints

**Always:**
- Note lưu vào field `note: v.optional(v.string())` đã có trong schema `highlights` — không sửa schema
- Chỉ plain text, tối đa 500 ký tự (không cần Markdown trong story này)
- Auto-save khi blur hoặc sau 1s debounce — không cần nút Save riêng
- Note bubble hiện khi hover vào `<mark>` có note (desktop) hoặc tap (mobile)
- Popover edit đóng khi Escape hoặc click ngoài

**Ask First:**
- Nếu cần thêm mutation `updateNote` riêng hay dùng lại `create` để patch — hỏi trước

**Never:**
- Không implement Markdown editor cho note trong story này (defer sang 5B Note workspace)
- Không implement voice note (FR39 — defer)
- Không sửa HighlightLayer render logic đã có

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Thêm note mới | Click "+" trên highlight menu | Popover text input mở gần highlight | — |
| Auto-save | User gõ xong, blur | Note lưu vào Convex sau 1s | Nếu fail → toast lỗi nhẹ |
| Hover highlight có note | Mouse hover vào mark | Bubble nhỏ hiện text note | — |
| Note rỗng | User xoá hết text rồi blur | Xoá note (set undefined) | — |
| Ctrl+N khi không có highlight active | — | Không làm gì | — |

</frozen-after-approval>

## Code Map

- `convex/highlights/mutations.ts` -- Thêm mutation `updateNote(highlightId, note?)` — patch field `note` + `updatedAt`
- `apps/web/src/components/viewers/markdown/HighlightMenu.tsx` -- Thêm nút "+" mở note editor
- `apps/web/src/components/viewers/markdown/NotePopover.tsx` -- Tạo mới: inline popover textarea + auto-save debounce
- `apps/web/src/components/viewers/markdown/HighlightLayer.tsx` -- Thêm: note bubble khi hover mark có note
- `apps/web/src/hooks/useHighlights.ts` -- Thêm `updateNote` từ mutation mới
- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` -- Thêm Ctrl+N handler, render NotePopover

## Tasks & Acceptance

**Execution:**
- [ ] `convex/highlights/mutations.ts` -- Thêm `updateNote`: nhận `highlightId` + `note?: string`, verify userId, patch `{ note, updatedAt: now }`
- [ ] `apps/web/src/hooks/useHighlights.ts` -- Thêm `updateNote` callback từ `useMutation(api.highlights.mutations.updateNote)`
- [ ] `apps/web/src/components/viewers/markdown/NotePopover.tsx` -- Tạo: `<textarea>` maxLength=500, `useEffect` debounce 1s gọi `onSave(text)`, đóng khi Escape/blur ngoài; position fixed gần (x,y)
- [ ] `apps/web/src/components/viewers/markdown/HighlightMenu.tsx` -- Thêm nút "✏️" (PenLine icon); khi click → gọi `onOpenNote()`
- [ ] `apps/web/src/components/viewers/markdown/HighlightLayer.tsx` -- Sau khi wrap mark, nếu highlight có `note` thêm `title` attribute để hiện tooltip native; thêm visual indicator (chấm nhỏ góc mark)
- [ ] `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` -- Thêm state `notePopover {x,y,highlightId,initialNote}`; truyền `onOpenNote` vào HighlightMenu; render `<NotePopover>`; Ctrl/Cmd+N handler mở note cho highlight gần nhất đang active

**Acceptance Criteria:**
- Given highlight tồn tại, when click highlight → menu hiện → click ✏️, then NotePopover mở với text hiện tại (nếu có)
- Given NotePopover mở, when gõ text rồi click ra ngoài, then note auto-save sau ≤1s, không cần bấm Save
- Given highlight có note, when hover vào mark (desktop), then tooltip/bubble hiện nội dung note
- Given NotePopover đang mở, when nhấn Escape, then popover đóng không save thêm
- Given note field rỗng sau khi xoá, when blur, then `note` field set về undefined trong Convex

## Design Notes

**Note indicator trên mark:** thêm CSS class `hl-has-note` với `::after` pseudo element — chấm nhỏ màu tím góc trên phải.

```css
mark.hl-has-note { position: relative; }
mark.hl-has-note::after {
  content: '';
  position: absolute;
  top: -3px; right: -3px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #7c3aed;
}
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: 0 errors trên highlight/note files

**Manual checks:**
- Highlight text → click → ✏️ → gõ note → blur → reload → note vẫn còn
- Hover mark có note → tooltip hiện
- Note indicator (chấm tím) xuất hiện trên mark có note

## Spec Change Log
