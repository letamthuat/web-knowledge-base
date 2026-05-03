---
title: 'Story 5.7 — Note Pane từ Highlight Ctrl/Cmd+N ≤1.5s'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'c1f5b95'
---

## Intent

Hỗ trợ Ctrl/Cmd+N để mở note editor cho highlight đang được chọn. Latency ≤1.5s từ phím đến popover.

## Code Map

- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — Ctrl/Cmd+N handler, mở NotePopover
- `apps/web/src/components/viewers/markdown/NotePopover.tsx` — reused từ 5.6

## Tasks & Acceptance

- [x] `MarkdownViewer.tsx` — keydown listener: Ctrl+N / Cmd+N → mở NotePopover cho highlight đang active
- [x] Nếu không có highlight active → không làm gì
- [x] NotePopover mở với initialNote từ highlight hiện tại

## Verification

- `cd apps/web && npx tsc --noEmit` — 0 errors
