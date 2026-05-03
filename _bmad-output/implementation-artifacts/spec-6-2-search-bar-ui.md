---
title: 'Story 6.2 — Search Bar + Kết Quả Unified'
type: 'feature'
created: '2026-05-03'
status: 'in-progress'
baseline_commit: '3ba3315'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Người dùng không thể tìm kiếm nội dung — không có search UI nào dù backend search queries đã sẵn sàng (6.1).

**Approach:** Thêm nút Search vào navbar (hiện trên mọi trang), Cmd/Ctrl+K mở modal overlay — gõ ≥2 ký tự → debounce 200ms → query song song 3 nguồn (docs + notes + highlights) → hiển thị kết quả grouped. Click result → navigate đến đúng trang.

## Boundaries & Constraints

**Always:**
- Search modal là overlay toàn trang (không phải inline) — Cmd/Ctrl+K mở, Escape đóng.
- Debounce 200ms trước khi query.
- Kết quả grouped: "Tài liệu", "Ghi chú", "Highlight notes" — mỗi nhóm tối đa 5 items.
- Click doc result → `router.push("/reader/[docId]")`.
- Click note result → `router.push("/notes")` + select note đó (pass qua URL `?note=id`).
- Click highlight result → `router.push("/reader/[docId]")`.
- Navbar hiện trên tất cả pages (library, notes, settings, reader).

**Ask First:**
- Nếu muốn search page riêng `/search` thay vì modal — hỏi trước.

**Never:**
- Không implement snippet highlight (6.3), filter (6.4), jump-to-position (6.5) trong story này.
- Không dùng thư viện cmdk — tự build modal đơn giản.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở search | Cmd/Ctrl+K hoặc click icon | Modal mở, input focused | — |
| Gõ <2 ký tự | "a" | Không query, hiện placeholder | — |
| Gõ ≥2 ký tự | "react" | Sau 200ms hiện spinner → kết quả grouped | Lỗi query → hiện "Không tìm được" |
| Không có kết quả | "xyzabc123" | "Không có kết quả" | — |
| Click doc result | Doc item | Đóng modal, mở reader tab | — |
| Click note result | Note item | Đóng modal, `/notes?note=id` | — |
| Escape | Modal đang mở | Đóng modal | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/search/SearchModal.tsx` — modal overlay: input + grouped results (tạo mới)
- `apps/web/src/hooks/useSearch.ts` — debounce 200ms, query parallel 3 sources (tạo mới)
- `apps/web/src/components/library/LibraryPageInner.tsx` — thêm Search button vào navbar, render `<SearchModal>`
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm Cmd+K handler + `<SearchModal>`
- `apps/web/src/app/notes/NotesPageInner.tsx` — thêm `<SearchModal>`, handle `?note=id` param
- `apps/web/src/app/settings/page.tsx` — thêm `<SearchModal>`

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/hooks/useSearch.ts` — hook: nhận `q: string`, debounce 200ms, `useQuery` parallel cho `api.documents.queries.search`, `api.notes.queries.search`, `api.highlights.queries.search`; trả `{ docs, notes, highlights, isLoading }`
- [ ] `apps/web/src/components/search/SearchModal.tsx` — modal: `open` prop, `onClose`, input autofocus, hiện 3 section grouped, keyboard nav (↑↓ Enter), click handler navigate
- [ ] `apps/web/src/components/library/LibraryPageInner.tsx` — thêm Search button (Search icon + "Tìm kiếm" + `⌘K`) vào navbar; state `searchOpen`; render `<SearchModal>`; global keydown Cmd/Ctrl+K
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm `searchOpen` state, Cmd/Ctrl+K handler, render `<SearchModal>`
- [ ] `apps/web/src/app/notes/NotesPageInner.tsx` — thêm `<SearchModal>`; đọc `?note=id` từ URL để auto-select note sau navigate
- [ ] `apps/web/src/app/settings/page.tsx` — thêm `<SearchModal>`

**Acceptance Criteria:**
- Given bất kỳ trang nào, when nhấn Cmd/Ctrl+K, then search modal mở với input focused
- Given modal mở, when gõ ≥2 ký tự và dừng 200ms, then hiện kết quả grouped từ docs + notes + highlights
- Given click doc result, when modal đang mở, then modal đóng và mở reader tab đúng docId
- Given không có kết quả, when query chạy xong, then hiện "Không có kết quả cho ..."
- Given nhấn Escape, when modal đang mở, then modal đóng

## Design Notes

**useSearch hook — dùng `useQuery` với skip khi q ngắn:**
```ts
const debouncedQ = useDebounce(q, 200);
const enabled = debouncedQ.length >= 2;
const docs = useQuery(api.documents.queries.search, enabled ? { q: debouncedQ } : "skip") ?? [];
const notes = useQuery(api.notes.queries.search, enabled ? { q: debouncedQ } : "skip") ?? [];
const highlights = useQuery(api.highlights.queries.search, enabled ? { q: debouncedQ } : "skip") ?? [];
```

**Modal structure:**
```
fixed inset-0 z-50 bg-black/40 → click ngoài đóng
  div centered max-w-lg w-full bg-card rounded-xl shadow-2xl
    input autofocus placeholder="Tìm kiếm tài liệu, ghi chú..."
    divider
    results scroll max-h-96
      Section "Tài liệu (X)" → DocResultItem[]
      Section "Ghi chú (Y)" → NoteResultItem[]
      Section "Highlight notes (Z)" → HighlightResultItem[]
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: 0 errors

**Manual checks:**
- Cmd/Ctrl+K mở modal từ Library, Reader, Notes, Settings
- Gõ từ khoá có trong doc → kết quả xuất hiện trong "Tài liệu"
- Click kết quả doc → reader mở đúng tài liệu
