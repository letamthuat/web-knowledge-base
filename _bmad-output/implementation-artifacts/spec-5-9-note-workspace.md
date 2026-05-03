---
title: 'Story 5.9 — Note Workspace /notes (BlockNote editor)'
type: 'feature'
created: '2026-05-02'
status: 'done'
baseline_commit: '31991a7491a0da3a43cfbc39e7d391d23d881f9c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Người dùng không có chỗ xem và quản lý toàn bộ ghi chú của mình — hiện tại ghi chú chỉ xem được trong AnnotationPanel khi đang đọc từng tài liệu.

**Approach:** Tạo trang `/notes` layout 2 cột: list bên trái + BlockNote editor (Notion-like, block-based WYSIWYG) bên phải. Notes lưu body dạng JSON string. Thêm `listAllByUser` Convex query. Auto-save 1s debounce.

## Boundaries & Constraints

**Always:**
- Route `/notes` cùng cấp với `library/`, `reader/`.
- Editor: `@blocknote/react` + `@blocknote/mantine` (lazy-loaded). Body lưu JSON string (`JSON.stringify(blocks[])`).
- Auto-save 1s debounce sau mỗi lần editor thay đổi.
- Notes sắp xếp mới nhất trước (`updatedAt` desc).
- Chỉ show doc notes (notes có `docId` hoặc không có `docId`) — không show highlight-only notes (`highlightId` có mà không có body đáng kể).

**Ask First:**
- Nếu cần pagination khi >50 notes.

**Never:**
- Không implement tag filter/sort (Story 5.11).
- Không implement `@` bidirectional link (Story 5.10).
- Không đổi schema `body` thành non-string (vẫn là `v.string()`, chỉ nội dung là JSON).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Trang trống | Chưa có note | Empty state + nút "Tạo ghi chú đầu tiên" | — |
| Tạo note mới | Click "+ Ghi chú mới" | Tạo note với body `[]`, chọn ngay, editor focus vào title | — |
| Edit note | Click note trong list | BlockNote editor load blocks từ JSON body | Body không phải JSON hợp lệ → render as plain text block |
| Auto-save | Thay đổi editor, dừng 1s | Lưu Convex, badge "Đã lưu" | Fail → toast lỗi |
| Xoá note | Hover → X → confirm | Note xoá khỏi list, chọn note kế tiếp | — |
| Note có docId | Note thuộc document | Hiển thị tên doc, click → `/reader/[docId]` tab mới | Doc đã xoá → ẩn link |

</frozen-after-approval>

## Code Map

- `convex/notes/queries.ts` — thêm `listAllByUser` (join docTitle)
- `apps/web/src/hooks/useNotes.ts` — thêm `useAllNotes()`
- `apps/web/src/app/notes/page.tsx` — trang `/notes` (tạo mới)
- `apps/web/src/components/notes/NoteList.tsx` — list panel trái (tạo mới)
- `apps/web/src/components/notes/NoteEditor.tsx` — BlockNote editor panel phải (tạo mới)
- Nav/sidebar hiện tại — thêm link "Ghi chú"

## Tasks & Acceptance

**Execution:**
- [x] `convex/notes/queries.ts` — thêm `listAllByUser`: không args, index `by_user_updated` desc, join `documents` để lấy `docTitle`
- [x] `apps/web/src/hooks/useNotes.ts` — thêm `useAllNotes()` gọi `api.notes.queries.listAllByUser`
- [x] `npm install @blocknote/react @blocknote/mantine @blocknote/core` trong `apps/web`
- [x] `apps/web/src/components/notes/NoteEditor.tsx` — BlockNote editor: load blocks từ JSON body, onChange debounce 1s → `updateNote`, title input riêng, badge "Đã lưu", link doc
- [x] `apps/web/src/components/notes/NoteList.tsx` — list item: title/preview/docName/time, nút "+ Ghi chú mới", X xoá confirm
- [x] `apps/web/src/app/notes/page.tsx` + `NotesPageInner.tsx` — layout 2 cột, `useAllNotes`, `selectedNoteId` state, `addNote` để tạo mới
- [x] Link "Ghi chú" trong nav đã có sẵn trong LibraryPageInner; NotesPageInner cũng có navbar với active state đúng

**Acceptance Criteria:**
- Given vào `/notes`, when có notes, then list hiển thị mới nhất trước
- Given click "+ Ghi chú mới", when tạo xong, then editor mở, cursor focus title
- Given đang edit trong BlockNote, when dừng 1s, then auto-save + badge "Đã lưu"
- Given note có docId, when click tên doc, then mở reader tab mới
- Given click X trên note, when confirm, then note xoá, chọn note liền kề

## Design Notes

**Parse body an toàn:**
```ts
function parseBlocks(body: string) {
  try { return JSON.parse(body); }
  catch { return [{ type: "paragraph", content: [{ type: "text", text: body }] }]; }
}
```

**BlockNote lazy load** để không bloat initial bundle:
```ts
const BlockNoteEditor = dynamic(() => import("@/components/notes/NoteEditor"), { ssr: false });
```

**listAllByUser join docTitle** — Convex không có JOIN, dùng `Promise.all`:
```ts
const notes = await ctx.db.query("notes").withIndex("by_user_updated", q => q.eq("userId", userId)).order("desc").collect();
const withTitles = await Promise.all(notes.map(async (n) => ({
  ...n,
  docTitle: n.docId ? (await ctx.db.get(n.docId))?.title : undefined,
})));
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: 0 errors

**Manual checks:**
- `/notes` load, list + editor hiển thị đúng layout
- Tạo note → gõ → 1s → "Đã lưu"
- Xoá note → confirm → biến mất
- Note có doc → click link → mở reader

## Spec Change Log
