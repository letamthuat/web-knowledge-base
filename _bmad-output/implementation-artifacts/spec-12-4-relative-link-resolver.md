---
title: 'Story 12.4 — Relative-link resolver (ảnh + cross-doc .md)'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** File markdown trong handbook nhúng ảnh (`![](./assets/img/m06/x.png)`) và trỏ chéo (`[..](05-sourcing.md)`) bằng relative path. Hiện `MarkdownViewer` không override `img`/`a` nên ảnh không hiện (path không phải URL) và link chéo không mở được nội bộ.

**Approach:** Thêm lớp resolve lúc render: một context cung cấp map `relPath → {docId, format}` của handbook hiện tại + presigned URL ảnh (batch). Override component `img` và `a` trong `MarkdownViewer`: chuẩn hóa path tương đối theo `relPath` của doc đang mở, tra map → ảnh dùng presigned URL, link `.md`/doc khác → rewrite thành mở reader nội bộ (đồng thời bật hover preview ở 13.3). Link http(s) hoặc không tra được → giữ nguyên.

## Boundaries & Constraints

**Always:**
- Resolve **chỉ khi** doc đang mở thuộc handbook (`doc.handbookId` có giá trị) và có `doc.relPath`.
- Chuẩn hóa path: xử lý `./`, `../`, bỏ query/anchor (`#`, `?`) khi tra, áp lại anchor cho link nội bộ.
- Ảnh: lấy presigned URL qua batch action `handbooks.getAssetUrls(handbookId)` (trả map relPath→URL cho mọi doc format=image trong handbook), cache theo handbookId trong context, refetch khi gần hết TTL (15 phút R2).
- Link doc đọc được khác: rewrite mở qua cơ chế tab/`openTab` (giống reader hiện tại) hoặc `router.push('/reader/<docId>')`.
- Link ngoài handbook (http/https/mailto) hoặc relPath không khớp → render `<a target=_blank rel=noopener>` / giữ nguyên, KHÔNG phá.

**Ask First:**
- Nếu một số file md tham chiếu ảnh bằng absolute path (`/assets/...`) khác convention → hỏi cách chuẩn hóa.

**Never:**
- Không sửa file md gốc (resolve runtime, không rewrite nội dung lưu trữ).
- Không tải toàn bộ file nhị phân về client để resolve (chỉ presigned URL).

## I/O & Edge-Case Matrix

| Scenario | Input trong md (doc relPath=`06-warehouse.md`) | Resolve ra | Hành vi |
|----------|--------------|------------|---------|
| Ảnh cùng cây | `./assets/img/m06/x.png` | relPath `assets/img/m06/x.png` | `<img>` presigned URL |
| Ảnh `../` | `../assets/img/m06/x.png` từ doc trong subfolder | normalize lên 1 cấp | `<img>` presigned URL |
| Link chéo md | `05-sourcing-procurement.md` | relPath `05-sourcing-procurement.md` | mở reader doc đó nội bộ |
| Link kèm anchor | `05-sourcing.md#muc-3` | relPath + anchor | mở reader + scroll anchor |
| Link ngoài | `https://x.com` | — | `<a target=_blank>` |
| Không khớp | `khong-ton-tai.md` | undefined | `<a>` thường, click no-op/toast nhẹ |
| Doc không thuộc handbook | `doc.handbookId=undefined` | resolver tắt | render mặc định như cũ |

</frozen-after-approval>

## Code Map

- `apps/web/src/lib/handbook/resolvePath.ts` (mới) — `normalizeRelative(baseRelPath, href)` → relPath chuẩn hóa (+ tách anchor/query).
- `apps/web/src/components/handbook/HandbookResolverContext.tsx` (mới) — context `{ filesByPath: Map<string,{docId,format}>, getImageUrl(relPath): string|undefined }`; provider fetch `listHandbookFiles` + `getAssetUrls`.
- `convex/handbooks/actions.ts` (mới) — `getAssetUrls({handbookId})`: query docs format=image của handbook, presigned GET mỗi key, trả `Record<relPath,url>` (tái dùng `getR2Client` pattern từ `convex/documents/actions.ts`).
- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — mở rộng `MD_COMPONENTS` thành factory nhận resolver; thêm override `img` (resolve src) + `a` (resolve href → internal/external). Truyền `doc.relPath`+`doc.handbookId` xuống (cần bổ sung props từ ViewerDispatcher → MarkdownViewer).
- `apps/web/src/components/viewers/ViewerDispatcher.tsx` — truyền `doc` đầy đủ (có `handbookId`,`relPath`) cho MarkdownViewer; bọc `HandbookResolverProvider` khi `doc.handbookId`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/handbook/resolvePath.ts` — implement normalize (./, ../, anchor, query) + unit-friendly pure function.
- [ ] `convex/handbooks/actions.ts` — `getAssetUrls(handbookId)` presigned URL cho ảnh.
- [ ] `HandbookResolverContext.tsx` — provider: `useQuery(listHandbookFiles)` build map; `useAction(getAssetUrls)` cache URL ảnh + TTL refetch.
- [ ] `MarkdownViewer.tsx` — chuyển `MD_COMPONENTS` → `makeComponents(resolver, baseRelPath)`; override `img`/`a`. Giữ nguyên `code`/mermaid.
- [ ] `ViewerDispatcher.tsx` — bọc provider + truyền props khi handbook doc.
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given mở `06-warehouse.md` của handbook, when render, then ảnh `assets/img/m06/*.png` hiển thị (không vỡ).
- Given click `[..](05-sourcing-procurement.md)`, when click, then mở đúng doc nội bộ trong reader.
- Given link `https://...`, when click, then mở tab ngoài, không bị rewrite.
- Given doc markdown rời (không handbook), when mở, then render y như trước (no regression).
