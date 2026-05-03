---
title: 'Story 6.4 — Filter Search'
type: 'feature'
created: '2026-05-03'
status: 'done'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Khi search có nhiều kết quả, người dùng không thể thu hẹp — ví dụ chỉ muốn tìm trong PDF, hoặc chỉ trong ghi chú.

**Approach:** Thêm filter bar trong SearchModal — 2 filter: **Loại** (Tất cả / Tài liệu / Ghi chú / Highlight) và **Định dạng** (All / PDF / EPUB / DOCX / Markdown / Web Clip). Filter Định dạng chỉ hiện khi Loại = "Tài liệu". Truyền `format` xuống Convex query đã có sẵn arg.

## Boundaries & Constraints

**Always:**
- Filter nằm trong SearchModal (không phải trang riêng).
- Filter "Loại" ẩn/hiện section: chọn "Tài liệu" → chỉ show docs section; "Ghi chú" → chỉ notes; "Highlight" → chỉ highlights; "Tất cả" → show cả 3.
- Filter "Định dạng" chỉ hiện khi Loại = "Tất cả" hoặc "Tài liệu".
- `format` filter truyền vào `api.documents.queries.search` — query đã có `format?: string` arg.
- Reset filter khi modal đóng và mở lại.

**Ask First:**
- Nếu muốn thêm filter theo tag hoặc folder — hỏi trước (cần join phức tạp hơn).

**Never:**
- Không thêm filter date range (scope creep).
- Không tạo trang `/search` riêng.
- Không sửa Convex schema hay index.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Filter "Tài liệu" | q="react", loại=Tài liệu | Chỉ hiện docs section, notes/highlights ẩn | — |
| Filter "Định dạng PDF" | q="react", loại=Tài liệu, format=pdf | Chỉ hiện doc kết quả là PDF | — |
| Filter "Tất cả" | q="react", loại=Tất cả | Show cả 3 section như hiện tại | — |
| Không có kết quả sau filter | loại=Ghi chú, không có note match | "Không có kết quả cho ..." | — |
| Đóng modal rồi mở lại | — | Filter reset về "Tất cả" | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/hooks/useSearch.ts` — thêm `filter: { type, format }` arg, truyền format vào docs query
- `apps/web/src/components/search/SearchModal.tsx` — thêm filter bar UI, state `filterType` + `filterFormat`, pass filter vào useSearch

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/hooks/useSearch.ts` — thêm arg `filter?: { type?: "docs"|"notes"|"highlights"; format?: string }`, skip docs query khi type="notes"|"highlights", skip notes/highlights query khi type="docs", truyền format vào docs query
- [ ] `apps/web/src/components/search/SearchModal.tsx` — thêm filter bar (tab-style buttons) bên dưới input: "Tất cả" | "Tài liệu" | "Ghi chú" | "Highlight"; khi Loại=Tài liệu/Tất cả thêm row format chips (All | PDF | EPUB | DOCX | Markdown | Web Clip); state `filterType`, `filterFormat`; reset khi modal mở lại; truyền filter vào useSearch

**Acceptance Criteria:**
- Given modal mở, when chọn filter "Tài liệu", then chỉ section Tài liệu hiện, 2 section kia ẩn
- Given filter "Tài liệu" + "PDF", when có kết quả, then chỉ show docs có format=pdf
- Given modal đóng rồi mở, when gõ lại, then filter về "Tất cả"
- Given filter "Ghi chú" active, when không có note nào match, then hiện "Không có kết quả"

## Design Notes

**useSearch signature mới:**
```ts
export function useSearch(q: string, filter?: { type?: "docs"|"notes"|"highlights"; format?: string })
```
Skip query bằng `"skip"` — nếu type="notes" thì docs query = `"skip"`, tương tự cho highlights.

**Filter bar layout:**
```
[Tất cả] [Tài liệu] [Ghi chú] [Highlight]   ← row 1: tab buttons
[All] [PDF] [EPUB] [DOCX] [Markdown] [Web Clip]  ← row 2: chỉ hiện khi type≠"notes"/"highlights"
```
Style: pill buttons, selected = `bg-primary text-primary-foreground`, unselected = `bg-muted text-muted-foreground`.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: không có lỗi mới từ files đã sửa

**Manual checks:**
- Gõ từ khoá → chọn "Tài liệu" → chỉ còn docs section
- Chọn "PDF" → kết quả chỉ là PDF
- Đóng modal → mở lại → filter về "Tất cả"
