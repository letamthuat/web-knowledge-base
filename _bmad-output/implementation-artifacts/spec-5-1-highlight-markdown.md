---
title: 'Story 5.1 — Text Highlight trong MarkdownViewer'
type: 'feature'
created: '2026-05-01'
status: 'done'
baseline_commit: '18e92c41f8d034454374734b711d72a823df5a5c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** User đọc tài liệu Markdown không thể đánh dấu đoạn text quan trọng — mọi insight bị mất khi đóng tab.

**Approach:** Khi user bôi đen text trong MarkdownViewer, hiện floating menu chọn 4 màu (vàng/xanh lá/xanh dương/hồng); lưu highlight vào Convex `highlights` table với `positionType: "scroll_pct"` + XPath anchor; khi load lại tài liệu, re-render các highlight từ DB lên DOM.

## Boundaries & Constraints

**Always:**
- Chỉ áp dụng cho MarkdownViewer (`format: "markdown"`) trong story này
- Dùng `window.getSelection()` + Range API để capture text và vị trí
- Lưu `positionValue` = JSON gồm `{ xpath, offset, length, text }` để re-anchor chính xác
- LWW + `clientMutationId` theo đúng pattern Convex hiện tại
- Floating menu đóng khi click ngoài hoặc Escape
- Highlight render bằng CSS `mark` element wrap quanh text node — không dùng `dangerouslySetInnerHTML` rewrite

**Ask First:**
- Nếu XPath anchor thất bại khi re-render (doc content thay đổi) → hỏi trước khi quyết định silent-skip hay show toast

**Never:**
- Không implement highlight cho PDF/EPUB/DOCX trong story này
- Không implement sticky note popup (FR30) — defer sang 5.2
- Không sửa schema Convex (đã đủ)
- Không dùng thư viện highlight external (rangy, mark.js) — DOM Range API thuần

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | User bôi đen text, chọn màu vàng | Highlight xuất hiện ngay (optimistic), lưu Convex | Nếu lưu fail → revert highlight, toast lỗi |
| Reload trang | Highlights đã lưu trong DB | Tất cả highlight re-render đúng vị trí khi content mount | Nếu anchor không tìm thấy → skip silently |
| Bôi đen ngoài content | Selection bao gồm cả UI chrome | Floating menu không hiện | — |
| Xoá highlight | Click vào highlight đã có → menu hiện nút xoá | Highlight bị xoá khỏi DOM + Convex | — |
| Selection rỗng | mouseup mà không có text | Floating menu không hiện | — |

</frozen-after-approval>

## Code Map

- `convex/highlights/mutations.ts` -- Tạo mới (create, remove) — pattern giống tabs/mutations.ts
- `convex/highlights/queries.ts` -- Tạo mới: `listByDoc` query theo index `by_user_doc`
- `convex/_generated/api.ts` -- Auto-generated sau khi thêm functions (không sửa tay)
- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` -- Thêm mouseup handler, render highlights overlay
- `apps/web/src/components/viewers/markdown/HighlightLayer.tsx` -- Tạo mới: component nhận highlights[], re-anchor vào DOM sau khi content render
- `apps/web/src/components/viewers/markdown/HighlightMenu.tsx` -- Tạo mới: floating menu 4 màu + nút xoá
- `apps/web/src/hooks/useHighlights.ts` -- Tạo mới: wrap query + mutations, expose `highlights`, `addHighlight`, `removeHighlight`

## Tasks & Acceptance

**Execution:**
- [ ] `convex/highlights/mutations.ts` -- Tạo với `create` (insert vào highlights table, requireAuth, clientMutationId LWW) và `remove` (delete theo id, verify userId) — copy pattern từ `convex/tabs/mutations.ts`
- [ ] `convex/highlights/queries.ts` -- Tạo `listByDoc` query: `ctx.db.query("highlights").withIndex("by_user_doc", q => q.eq("userId").eq("docId")).collect()`
- [ ] `apps/web/src/hooks/useHighlights.ts` -- Tạo hook: `useQuery(api.highlights.queries.listByDoc, { docId })` + `useMutation` cho create/remove; trả về `{ highlights, addHighlight, removeHighlight }`
- [ ] `apps/web/src/components/viewers/markdown/HighlightMenu.tsx` -- Tạo floating menu: 4 color swatches (yellow/green/blue/pink) + nút × xoá; position tuyệt đối theo `getBoundingClientRect()` của selection; đóng khi Escape hoặc click ngoài
- [ ] `apps/web/src/components/viewers/markdown/HighlightLayer.tsx` -- Tạo component: sau khi content div mount (`useEffect`), iterate highlights[], dùng `TreeWalker` tìm text node theo `xpath+offset`, wrap bằng `<mark>` với màu tương ứng; cleanup khi unmount
- [ ] `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` -- Thêm: `onMouseUp` handler trên content div để detect selection + tính xpath/offset/length; render `<HighlightMenu>` và `<HighlightLayer>`; gọi `useHighlights(doc._id)`

**Acceptance Criteria:**
- Given user đang xem file markdown, when bôi đen ≥1 từ trong content area, then floating menu 4 màu xuất hiện gần selection trong ≤100ms
- Given floating menu hiện, when click màu vàng, then text được wrap bằng `<mark class="hl-yellow">`, menu đóng, highlight lưu vào Convex
- Given trang reload, when MarkdownViewer mount, then tất cả highlights đã lưu re-render đúng vị trí (text match)
- Given click vào mark đã highlight, when menu hiện nút ×, when click ×, then highlight bị xoá khỏi DOM và Convex
- Given bôi đen text ngoài `.prose` content area, then floating menu không xuất hiện

## Design Notes

**XPath anchor format:**
```json
{ "xpath": "//h2[2]/following-sibling::p[1]", "startOffset": 12, "endOffset": 45, "text": "exact text" }
```
Khi re-anchor: dùng `document.evaluate(xpath)` → text node → `createRange` → wrap. Nếu text không khớp → skip (content đã thay đổi).

**Màu highlight CSS** (thêm vào global CSS):
```css
mark.hl-yellow { background: #fef08a; color: inherit; }
mark.hl-green  { background: #bbf7d0; color: inherit; }
mark.hl-blue   { background: #bfdbfe; color: inherit; }
mark.hl-pink   { background: #fbcfe8; color: inherit; }
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: 0 errors liên quan đến highlight files
- `npx convex dev` -- expected: functions deploy thành công, không có schema error

**Manual checks:**
- Mở file markdown trong reader → bôi text → menu 4 màu xuất hiện
- Chọn màu → highlight xuất hiện → reload trang → highlight vẫn còn
- Click highlight → nút × → highlight biến mất

## Spec Change Log
