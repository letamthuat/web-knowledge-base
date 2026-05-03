---
title: 'Story 6.1 — Search Index + Text Extraction Pipeline'
type: 'feature'
created: '2026-05-03'
status: 'in-progress'
baseline_commit: '8bc4e8f53cb534d08bd47002722eb931ea6d47ba'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Người dùng không thể tìm kiếm nội dung tài liệu vì không có pipeline extract text và chưa có query function nào dùng search index đã có trong schema.

**Approach:** Tạo Convex action `extractText(docId)` chạy sau `finalizeUpload` — download file từ R2, extract text theo format (MD raw, PDF via pdfjs-dist, DOCX via mammoth, EPUB via epubjs, webclip via readability), patch `extractedText` lên document. Thêm search query functions cho documents + notes + highlights.

## Boundaries & Constraints

**Always:**
- Schema `documents.extractedText` + search indexes (`search_title`, `search_content`) đã có — không sửa schema.
- `notes` search index `search_body` đã có — dùng luôn.
- Extract text phía Convex action (Node.js runtime) — không phải client.
- `extractedText` cắt tối đa 500KB (Convex document limit ~1MB, để dự phòng).
- Audio/video/image → `extractedText = title` (không OCR/transcribe).
- Chỉ extract khi `extractedText` chưa có (idempotent).

**Ask First:**
- Nếu mammoth/epubjs không chạy được trong Convex action runtime → hỏi trước khi dùng workaround.

**Never:**
- Không implement search UI trong story này (6.2+).
- Không dùng Meilisearch hay external search (MVP = Convex native search).
- Không re-extract tài liệu cũ hàng loạt (batch backfill là việc riêng).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| MD upload | format="md", file UTF-8 text | `extractedText` = full content (cắt 500KB) | decode error → skip, log |
| PDF upload | format="pdf", pdfjs-dist | `extractedText` = text từ tất cả pages | pdfjs fail → extractedText = title |
| DOCX upload | format="docx", mammoth | `extractedText` = plain text từ mammoth | mammoth fail → extractedText = title |
| EPUB upload | format="epub", epubjs | `extractedText` = text từ spine items | epubjs fail → extractedText = title |
| Webclip | format="webclip", html | `extractedText` = Readability plain text | parse fail → extractedText = title |
| Audio/Video/Image | format ∈ {audio,video,image} | `extractedText` = title | — |
| Search docs | query string ≥ 2 chars | top 10 docs matching title hoặc content | empty → [] |
| Search notes | query string ≥ 2 chars | top 10 notes matching body | empty → [] |

</frozen-after-approval>

## Code Map

- `convex/documents/actions.ts` — thêm `extractText(docId)` action
- `convex/documents/mutations.ts` — thêm `patchExtractedText(docId, text)` internal mutation
- `convex/documents/queries.ts` — thêm `search(q, format?)` query dùng `search_content` + `search_title`
- `convex/notes/queries.ts` — thêm `search(q, docId?)` query dùng `search_body`
- `convex/highlights/queries.ts` — thêm `search(q, docId?)` query tìm trong `note` field (text scan vì không có search index)
- `convex/documents/mutations.ts` (`finalizeUpload`) — gọi `extractText` sau khi insert

## Tasks & Acceptance

**Execution:**
- [ ] `convex/documents/mutations.ts` — thêm internal mutation `patchExtractedText`: nhận `docId + text`, patch `{ extractedText: text.slice(0, 500_000) }`
- [ ] `convex/documents/actions.ts` — thêm action `extractText(docId)`: fetch file từ storage URL, branch theo format, extract text, gọi `patchExtractedText`; audio/video/image → dùng title
- [ ] `convex/documents/mutations.ts` (`finalizeUpload`) — sau insert doc, schedule `api.documents.actions.extractText` với docId vừa tạo
- [ ] `convex/documents/queries.ts` — thêm `search({ q, format? })`: dùng `search_content` index (filter userId), merge với `search_title` results, dedup, trả top 10
- [ ] `convex/notes/queries.ts` — thêm `search({ q, docId? })`: dùng `search_body` index filter userId (+docId nếu có), trả top 10
- [ ] `convex/highlights/queries.ts` — thêm `search({ q })`: `listByUser` rồi filter `.note?.toLowerCase().includes(q)`, trả top 10

**Acceptance Criteria:**
- Given upload file MD/PDF/DOCX/EPUB, when `finalizeUpload` xong, then `extractedText` được populate trong vòng 30s
- Given `api.documents.queries.search({ q: "keyword" })`, when có doc chứa keyword, then trả về doc đó trong results
- Given `api.notes.queries.search({ q: "keyword" })`, when có note chứa keyword trong body, then trả về note đó
- Given format là audio/video, when extract chạy, then `extractedText = title` (không error)

## Design Notes

**pdfjs-dist trong Convex action (Node runtime):**
```ts
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = ""; // disable worker in Node
const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
let text = "";
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ") + "\n";
}
```

**Schedule extractText sau finalizeUpload:**
```ts
await ctx.scheduler.runAfter(0, api.documents.actions.extractText, { docId: id });
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: 0 errors trên files mới
- `npx convex deploy --yes` — expected: schema validation complete

**Manual checks:**
- Upload 1 file MD → vào Convex dashboard → document có `extractedText` populated
- Upload 1 file PDF → `extractedText` chứa text từ PDF
