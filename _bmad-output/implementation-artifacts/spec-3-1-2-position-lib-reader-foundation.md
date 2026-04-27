---
title: 'Epic 3.1+3.2 — Position Lib + Reader Foundation'
type: 'feature'
created: '2026-04-27'
status: 'draft'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Chưa có abstraction cho vị trí đọc (page/CFI/timestamp/scroll/slide), chưa có Convex CRUD cho reading_progress, và chưa có route/component skeleton để các viewer gắn vào.

**Approach:** Tạo `lib/position/` với 5-variant discriminated union + serialize/deserialize, tạo `convex/reading_progress/` với getByDoc + upsert idempotent, tạo route `/reader/[docId]` + `ViewerDispatcher` lazy-load theo format, tạo Convex action để generate download URL cho cả Convex storage lẫn R2.

## Boundaries & Constraints

**Always:**
- Position lib phải pure TypeScript, không import Convex/React — testable độc lập
- `upsert` dùng `clientMutationId` (uuidv7) để idempotent (offline-safe)
- Viewer route dùng `dynamic({ ssr: false })` cho tất cả viewer components
- Download URL action phải server-side (secret R2 keys không expose client)
- Reader page yêu cầu auth — redirect `/login` nếu chưa đăng nhập

**Ask First:**
- Nếu schema `reading_progress` trong `convex/schema.ts` không khớp với position types dự kiến → HALT

**Never:**
- Implement PDF/EPUB/audio/video viewer logic trong sprint này (chỉ placeholder)
- Expose R2 secret keys ra client
- Dùng SSR cho viewer components

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| serialize round-trip | `ReadingPosition` 5 loại | JSON string → deserialize → identical object | throw nếu type mismatch |
| getByDoc no record | docId chưa có progress | return `null` | — |
| upsert lần đầu | docId mới + positionValue | insert record | — |
| upsert idempotent | cùng clientMutationId | no-op (không insert duplicate) | — |
| download URL Convex | storageKey = Convex storageId | trả URL từ `ctx.storage.getUrl()` | null nếu không tìm thấy |
| download URL R2 | storageKey = R2 key | trả presigned GET URL (15 min) | throw nếu R2 config thiếu |
| ViewerDispatcher unknown format | format = "web_clip" | render placeholder "Chưa hỗ trợ" | — |

</frozen-after-approval>

## Code Map

- `convex/schema.ts` — reading_progress table đã có, kiểm tra field names
- `convex/reading_progress/queries.ts` — tạo mới: getByDoc
- `convex/reading_progress/mutations.ts` — tạo mới: upsert với LWW + idempotency
- `convex/documents/actions.ts` — thêm action: getDownloadUrl (Convex + R2)
- `apps/web/src/lib/position/index.ts` — entry point, export ReadingPosition union + serialize/deserialize
- `apps/web/src/lib/position/types.ts` — 5 variant types + progress % helpers
- `apps/web/src/app/reader/[docId]/page.tsx` — route mới, auth guard, load doc + progress
- `apps/web/src/components/viewers/ViewerDispatcher.tsx` — route theo format → lazy viewer
- `apps/web/src/components/viewers/PlaceholderViewer.tsx` — fallback cho format chưa implement
- `apps/web/src/hooks/useReadingProgress.ts` — hook: upsert với throttle 5s + visibilitychange

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/lib/position/types.ts` -- tạo mới: discriminated union `ReadingPosition` 5 variant (`pdf_page`, `epub_cfi`, `time_seconds`, `scroll_pct`, `slide_index`) + progress % helpers -- foundation cho mọi viewer
- [ ] `apps/web/src/lib/position/index.ts` -- tạo mới: export `ReadingPosition`, `serialize(pos): string`, `deserialize(s, type): ReadingPosition` (validate, throw nếu invalid) -- public API của lib
- [ ] `convex/reading_progress/queries.ts` -- tạo mới: `getByDoc({ docId })` query, return null nếu chưa auth, return record hoặc null -- reactive query cho reader
- [ ] `convex/reading_progress/mutations.ts` -- tạo mới: `upsert({ docId, positionType, positionValue, clientMutationId })` với LWW (skip nếu updatedAt server > client) + idempotency check -- offline-safe position save
- [ ] `convex/documents/actions.ts` -- thêm action `getDownloadUrl({ docId })`: load doc, nếu storageBackend="convex" dùng ctx.storage.getUrl(), nếu "r2" generate presigned GET URL 15min -- viewer cần URL để load file
- [ ] `apps/web/src/hooks/useReadingProgress.ts` -- tạo mới: hook nhận docId, expose `position` (từ useQuery) + `savePosition(pos)` (throttle 5s, flush on visibilitychange/beforeunload) -- shared logic cho mọi viewer
- [ ] `apps/web/src/components/viewers/PlaceholderViewer.tsx` -- tạo mới: hiển thị tên format + icon + "Viewer đang được phát triển" -- fallback
- [ ] `apps/web/src/components/viewers/ViewerDispatcher.tsx` -- tạo mới: nhận `doc` prop, switch theo `doc.format`, dynamic import lazy viewer (ssr:false), fallback PlaceholderViewer -- central routing
- [ ] `apps/web/src/app/reader/[docId]/page.tsx` -- tạo mới: auth guard (redirect login), useQuery getById + getByDoc + getDownloadUrl action, render ViewerDispatcher -- entry point cho reader
- [ ] `convex/_generated/` -- chạy `npx convex dev --once` để regenerate types sau khi thêm reading_progress module

**Acceptance Criteria:**
- Given `serialize({ type: "pdf_page", page: 5, offset: 0.3 })`, when gọi `deserialize(result, "pdf_page")`, then trả về object giống hệt ban đầu
- Given user chưa đăng nhập, when navigate `/reader/[docId]`, then redirect về `/login`
- Given doc tồn tại với storageBackend="convex", when call `getDownloadUrl`, then trả về URL string hợp lệ
- Given `upsert` gọi 2 lần cùng `clientMutationId`, when query `getByDoc`, then chỉ có 1 record
- Given format="pdf", when render `ViewerDispatcher`, then lazy load `PDFViewer` (placeholder OK ở sprint này)
- Given format="web_clip", when render `ViewerDispatcher`, then render `PlaceholderViewer`

## Design Notes

**Position discriminated union pattern:**
```typescript
export type ReadingPosition =
  | { type: "pdf_page"; page: number; offset: number }
  | { type: "epub_cfi"; cfi: string }
  | { type: "time_seconds"; seconds: number }
  | { type: "scroll_pct"; pct: number }
  | { type: "slide_index"; slide: number }
```

**LWW upsert logic:** Check existing record — nếu `existing.updatedAt >= args.updatedAt` thì skip (client cũ hơn server). Nếu không có record hoặc server cũ hơn → patch/insert.

**R2 presigned GET:** Dùng `@aws-sdk/s3-request-presigner` với `GetObjectCommand`, expiresIn: 900 (15 phút) — giống pattern presigned PUT đã có trong `actions.ts`.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: 0 errors
- `npx convex dev --once` -- expected: "Convex functions ready!"
