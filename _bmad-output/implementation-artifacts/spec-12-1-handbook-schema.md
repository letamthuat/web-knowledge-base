---
title: 'Story 12.1 — Schema Domain/Handbook + base queries'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hệ thống chưa có tầng phân cấp Domain > Handbook, và `documents` không lưu đường dẫn của file bên trong một handbook (`relPath`). Không có nền tảng này thì không thể ingest cây thư mục markdown, không resolve relative link, không dựng cây thư mục phân cấp.

**Approach:** Thêm 2 bảng `domains`, `handbooks` và mở rộng `documents` với 2 field optional `handbookId` + `relPath` (backward-compatible — document cũ `handbookId=undefined` vẫn là file rời). Thêm index tra cứu theo handbook + theo path. Viết các query nền tảng để liệt kê Domain/Handbook và toàn bộ file trong 1 handbook (kèm progress để story sau gắn icon trạng thái).

## Boundaries & Constraints

**Always:**
- `domains`/`handbooks` scope theo `userId` (giống mọi bảng khác). Auth qua `requireAuth` (`convex/lib/auth.ts`).
- `documents.handbookId` + `documents.relPath` đều **optional** → không phá document hiện có.
- Folder bên trong handbook **suy ra từ `relPath`**, KHÔNG tạo bảng folder cho handbook.
- `relPath` chuẩn hóa: forward-slash, không dấu `/` đầu, tương đối với gốc handbook (vd `"assets/img/m06/x.png"`, `"06-warehouse.md"`).
- Giữ nguyên `folders`/`document_folders` cho document rời ngoài handbook.

**Ask First:**
- Nếu cần đổi kiểu `storageBackend`/`format` union hiện có → hỏi trước.

**Never:**
- Không viết mutation CRUD trong story này (để 12.2).
- Không viết logic import/resolver/tree ở đây (12.3/12.4/12.5).
- Không xóa/migrate document cũ ở đây (12.7).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| listDomains | user đã auth | mảng domains sort theo `order` rồi `createdAt` | chưa auth → throw FORBIDDEN |
| listHandbooks | `domainId` | handbooks thuộc domain đó của user, sort `order` | domain không thuộc user → [] |
| listHandbookFiles | `handbookId` | mảng `{docId, relPath, format, title, progressPct}` cho mọi doc có `handbookId` này (status ready) | handbook rỗng → [] |
| Doc cũ | `handbookId=undefined` | không xuất hiện trong listHandbookFiles | — |
| Index lookup | `by_handbook_path` (handbookId, relPath) | dùng để resolver tra 1 file theo path | path không có → undefined |

</frozen-after-approval>

## Code Map

- `convex/schema.ts` — thêm bảng `domains`, `handbooks`; thêm `handbookId` + `relPath` vào `documents` + 2 index `by_handbook`, `by_handbook_path`.
- `convex/domains/queries.ts` (mới) — `listDomains`.
- `convex/handbooks/queries.ts` (mới) — `listHandbooks(domainId)`, `listHandbookFiles(handbookId)`, `getByIdInternal(handbookId)` (cho action sau).
- Tái dùng: `requireAuth` (`convex/lib/auth.ts`), `reading_progress` index `by_user_doc` để join progress.

## Schema chi tiết (đề xuất)

```ts
domains: defineTable({
  userId: v.id("users"),
  name: v.string(),
  color: v.optional(v.string()),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_order", ["userId", "order"]),

handbooks: defineTable({
  userId: v.id("users"),
  domainId: v.id("domains"),
  name: v.string(),
  color: v.optional(v.string()),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_domain", ["domainId"]),

// documents — THÊM 2 field:
handbookId: v.optional(v.id("handbooks")),
relPath: v.optional(v.string()),
// documents — THÊM 2 index:
.index("by_handbook", ["handbookId"])
.index("by_handbook_path", ["handbookId", "relPath"])
```

## Tasks & Acceptance

**Execution:**
- [ ] `convex/schema.ts` — thêm `domains`, `handbooks`; thêm `handbookId`+`relPath`+2 index vào `documents`.
- [ ] `convex/domains/queries.ts` — `listDomains()`: query `by_user_order`, sort.
- [ ] `convex/handbooks/queries.ts` — `listHandbooks({domainId})`; `listHandbookFiles({handbookId})` join `reading_progress` (`by_user_doc`) trả `progressPct`; `getByIdInternal({handbookId})` (internalQuery).
- [ ] `npm run typecheck` xanh; Convex dev push schema không lỗi migration.

**Acceptance Criteria:**
- Given schema mới deploy, when push lên Convex, then không có lỗi (vì field mới optional).
- Given chưa có domain nào, when gọi `listDomains`, then trả `[]`.
- Given doc cũ (handbookId rỗng), when gọi `listHandbookFiles` cho handbook bất kỳ, then doc cũ KHÔNG xuất hiện.
