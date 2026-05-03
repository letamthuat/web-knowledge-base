---
title: 'Story 6.5 — Click Result Jump to Position'
type: 'feature'
created: '2026-05-03'
status: 'done'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Khi click kết quả search, reader mở đúng tài liệu nhưng scroll về đầu trang — người dùng phải tự tìm đoạn chứa keyword trong tài liệu dài.

**Approach:** Truyền keyword qua URL param `?q=keyword` khi navigate từ SearchModal. MarkdownViewer đọc param này sau khi render xong, dùng TreeWalker để tìm text node đầu tiên chứa keyword (case-insensitive), wrap trong `<mark class="search-jump">`, rồi scroll đến đó. Chỉ áp dụng cho Markdown — PDF/EPUB defer.

## Boundaries & Constraints

**Always:**
- URL pattern: `/reader/[docId]?q=keyword`
- Chỉ scroll đến **first match** — không iterate qua tất cả match.
- Highlight jump mark dùng class `search-jump` (màu vàng), tự xóa sau 3 giây.
- Chỉ implement cho **MarkdownViewer** — PDF/EPUB không có jump trong story này.
- Nếu keyword không tìm được trong DOM → không làm gì (silent fail).

**Ask First:**
- Nếu muốn "next/prev match" navigation — hỏi trước.

**Never:**
- Không dùng `window.find()` — không reliable trên mobile/Firefox.
- Không sửa Convex backend.
- Không implement cho PDF hoặc EPUB viewer trong story này.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Click doc result (markdown) | q="safetystock", doc=markdown | Reader mở, scroll đến đoạn "safetystock", text được highlight vàng 3s | — |
| Keyword không có trong rendered text | q="xyz123" | Reader mở bình thường, không scroll | Silent fail |
| Click doc result (PDF) | q="keyword", doc=pdf | Reader mở bình thường (không có jump) | — |
| Navigate lại không có ?q | URL không có q param | MarkdownViewer render bình thường | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/search/SearchModal.tsx` — `goToDoc()` thêm `?q=` param
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — đọc `searchParams`, truyền `highlightQuery` prop xuống viewer
- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — nhận `highlightQuery?: string`, sau render dùng TreeWalker tìm + scroll

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/components/search/SearchModal.tsx` — sửa `goToDoc(docId)` thành `goToDoc(docId, q)`, navigate `/reader/${docId}?q=${encodeURIComponent(q)}` khi q có giá trị
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm `useSearchParams()`, đọc `q` param, truyền `highlightQuery={q ?? undefined}` vào component viewer (MarkdownViewer)
- [ ] `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — thêm prop `highlightQuery?: string`; sau render xong (useEffect depend on `highlightQuery` + content ready), dùng TreeWalker tìm text node đầu tiên chứa keyword, split node, wrap match trong `<mark class="search-jump" style="background:yellow">`, `scrollIntoView({ behavior:'smooth', block:'center' })`; setTimeout 3000ms xóa mark (unwrap text node)

**Acceptance Criteria:**
- Given click doc result từ search "safetystock", when tài liệu là markdown, then reader scroll đến đoạn chứa "safetystock" và text được highlight vàng
- Given highlight jump, when 3 giây trôi qua, then highlight tự biến mất
- Given click doc result (PDF), when reader mở, then không có lỗi JS, scroll về đầu bình thường
- Given URL không có `?q`, when reader load, then không có highlight nào

## Design Notes

**TreeWalker approach:**
```ts
useEffect(() => {
  if (!highlightQuery || !contentRef.current) return;
  const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT);
  const lower = highlightQuery.toLowerCase();
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const idx = node.textContent?.toLowerCase().indexOf(lower) ?? -1;
    if (idx === -1) continue;
    // split + wrap
    const before = node.splitText(idx);
    const match = before.splitText(lower.length);  // 'match' = node after, 'before' = the keyword
    const mark = document.createElement("mark");
    mark.className = "search-jump";
    mark.style.cssText = "background:#fef08a;border-radius:2px;padding:0 1px";
    before.parentNode?.insertBefore(mark, match);  // wrong — need to wrap 'before' itself
    // Correct: wrap the keyword node (the text between splits)
    const keyword = before; // 'before' now contains keyword text
    keyword.parentNode?.insertBefore(mark, keyword);
    mark.appendChild(keyword);
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => mark.replaceWith(...Array.from(mark.childNodes)), 3000);
    break;
  }
}, [highlightQuery]);
```

**Truyền prop từ ReaderPageInner:**
MarkdownViewer cần nhận `highlightQuery` chỉ khi format="markdown". Các viewer khác (PDFViewer, EPUBViewer) không cần sửa.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: không có lỗi mới

**Manual checks:**
- Search "safetystock" → click kết quả markdown → reader scroll đến đoạn chứa keyword, highlight vàng 3s
- Search → click PDF result → mở bình thường, không có JS error
