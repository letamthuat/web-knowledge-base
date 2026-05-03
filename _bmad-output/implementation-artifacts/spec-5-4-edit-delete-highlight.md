---
title: 'Story 5.4 — Edit + Delete Highlight'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'c1f5b95'
---

## Intent

Cho phép người dùng xoá highlight hoặc đổi màu highlight đã tạo. Truy cập qua floating menu khi click vào mark đã highlight.

## Code Map

- `apps/web/src/components/viewers/markdown/HighlightMenu.tsx` — Menu màu + nút xoá cho existing highlight
- `convex/highlights/mutations.ts` — `remove(highlightId)` mutation
- `apps/web/src/hooks/useHighlights.ts` — `removeHighlight` callback
- `apps/web/src/components/viewers/markdown/AnnotationPanel.tsx` — Nút xoá trong list panel

## Tasks & Acceptance

- [x] `HighlightMenu.tsx` — Khi `existingId` có, hiện nút PenLine (edit note) và X (delete)
- [x] `convex/highlights/mutations.ts` — `remove` mutation verify userId rồi delete
- [x] `AnnotationPanel.tsx` — HighlightRow có nút xoá với confirm nếu có note
- [x] Xoá highlight thì biến mất khỏi DOM và list ngay lập tức (Convex realtime)

## Verification

- `cd apps/web && npx tsc --noEmit` — 0 errors
