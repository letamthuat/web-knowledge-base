---
title: 'Story 5.6 — Sticky Note Inline Near Highlight'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'c1f5b95'
---

## Intent

Người dùng highlight text nhưng không thể ghi chú ngắn kèm theo. Thêm inline popover nhỏ để gõ note ngắn (plain text, tối đa 500 ký tự) vào field `note` của highlight.

## Code Map

- `apps/web/src/components/viewers/markdown/NotePopover.tsx` — Inline popover textarea + auto-save debounce
- `apps/web/src/components/viewers/markdown/HighlightMenu.tsx` — Nút ✏️ mở NotePopover
- `apps/web/src/components/viewers/markdown/HighlightLayer.tsx` — CSS class `hl-has-note` với dashed underline
- `convex/highlights/mutations.ts` — `updateNote` mutation
- `apps/web/src/hooks/useHighlights.ts` — `updateNote` callback

## Tasks & Acceptance

- [x] `NotePopover.tsx` — textarea maxLength=500, debounce 1s → onSave, đóng khi Escape/blur ngoài
- [x] `HighlightMenu.tsx` — nút PenLine → gọi `onOpenNote()`
- [x] `HighlightLayer.tsx` — `hl-has-note` class → dashed violet underline
- [x] Auto-save khi blur sau 1s debounce
- [x] Note rỗng → set undefined trong Convex

## Verification

- `cd apps/web && npx tsc --noEmit` — 0 errors
