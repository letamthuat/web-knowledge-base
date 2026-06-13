---
title: 'Story 13.3 — Hover preview cho link chéo'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Khi di chuột qua link chéo nội bộ (`[..](05-sourcing.md)`), cần khung nhỏ tóm tắt nội dung file đích trước khi click.

**Approach:** Dựa trên resolver (12.4): khi `a` được rewrite thành link nội bộ (có docId đích), gắn handler hover → hiện card với title + trích đoạn `extractedText` của doc đích. Query lấy summary qua `documents.queries.getById` (đã trả extractedText). Tái dùng pattern positioning/animation của `NoteHoverCard.tsx`.

## Boundaries & Constraints

**Always:**
- Chỉ hover preview cho link nội bộ resolve được (có docId); link ngoài không preview.
- Trích đoạn: ~200–300 ký tự đầu của `extractedText` (bỏ ký tự markdown thừa), + title.
- Delay hiện ~300ms; ẩn khi rời chuột; định vị tránh tràn viewport (giống NoteHoverCard).
- Lazy fetch: chỉ query doc đích khi thực sự hover (không prefetch toàn bộ).
- Cache summary theo docId trong phiên.

**Ask First:**
- Nếu muốn preview render markdown thật (mini) thay vì plain snippet → xác nhận (mặc định: plain snippet, rẻ + nhanh).

**Never:**
- Không tải full file đích để preview (dùng extractedText sẵn có).

## I/O & Edge-Case Matrix

| Scenario | Input | Behavior |
|----------|-------|----------|
| Hover link nội bộ | docId đích | sau 300ms hiện card title + snippet |
| Rời chuột | — | ẩn card |
| Doc đích chưa có extractedText | extractedText rỗng | card chỉ hiện title |
| Link ngoài | http | không preview |
| Gần mép màn hình | — | card lật vị trí tránh tràn |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/handbook/CrossLinkHoverCard.tsx` (mới) — card hover (mượn layout/positioning từ `NoteHoverCard.tsx`).
- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — trong override `a` (từ 12.4), gắn `onMouseEnter/Leave` mở `CrossLinkHoverCard` cho link nội bộ.
- Tái dùng: `documents.queries.getById` (trả extractedText), pattern `NoteHoverCard`.

## Tasks & Acceptance

**Execution:**
- [ ] `CrossLinkHoverCard.tsx` — fetch doc đích (lazy), render title + snippet, positioning chống tràn.
- [ ] Tích hợp hover handler vào `a` override trong MarkdownViewer.
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given hover link chéo nội bộ, when giữ ~300ms, then hiện card title + tóm tắt doc đích.
- Given rời chuột, when rời, then card ẩn.
- Given hover link ngoài, when hover, then không có card.
