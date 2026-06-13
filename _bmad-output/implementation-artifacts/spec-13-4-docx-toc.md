---
title: 'Story 13.4 — TOC cho DOCX (tùy chọn, ưu tiên thấp)'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Markdown đã có TOC tự động; file Word (.docx) thì chưa. User muốn mục lục nội bộ cho cả tài liệu Word.

**Approach:** DOCXViewer render qua mammoth → HTML. Sau render, quét các thẻ heading (`h1..h6`) trong DOM đã render để dựng TOC, gán id, click cuộn — y hệt cơ chế TOC của MarkdownViewer (`extractToc` + IntersectionObserver active heading).

## Boundaries & Constraints

**Always:**
- Quét heading từ HTML đã render (mammoth map Word heading styles → `<h1..h6>`); gán `id` (slug) nếu thiếu.
- Tái dùng cơ chế active-heading + scroll-to của MarkdownViewer (tách thành hook/dùng chung nếu hợp lý).
- Nếu mammoth không sinh heading (Word dùng style lạ) → TOC rỗng, ẩn panel.

**Ask First:**
- Story này ưu tiên thấp; chỉ làm khi Epic 12 + 13.1–13.3 xong và user xác nhận cần.

**Never:**
- Không đổi pipeline mammoth hiện có ngoài việc đảm bảo heading có id.

## I/O & Edge-Case Matrix

| Scenario | Input | Behavior |
|----------|-------|----------|
| DOCX có heading | Word có Heading 1/2 | TOC hiện, click cuộn |
| DOCX không heading | toàn body text | TOC ẩn |
| Active heading | cuộn | mục TOC tương ứng sáng |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/viewers/docx/DOCXViewer.tsx` — sau render HTML: query headings, gán id, dựng TOC panel.
- `apps/web/src/lib/toc/useHeadingToc.ts` (mới, tùy chọn) — tách logic active-heading + scrollToHeading từ MarkdownViewer để dùng chung.

## Tasks & Acceptance

**Execution:**
- [ ] (Tùy chọn) tách `useHeadingToc` từ MarkdownViewer.
- [ ] `DOCXViewer.tsx` — quét heading, gán id, render TOC + active + scroll.
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given DOCX có heading, when mở, then TOC hiện và click cuộn đúng.
- Given DOCX không heading, when mở, then không hiện panel TOC.
