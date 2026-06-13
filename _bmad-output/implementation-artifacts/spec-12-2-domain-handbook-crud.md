---
title: 'Story 12.2 — Domain & Handbook CRUD'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** User cần toàn quyền tạo/đổi tên/xóa Domain và Handbook trực tiếp trên web. Xóa Handbook phải dọn sạch toàn bộ document + file R2 + highlight/note/progress liên quan (không để rác).

**Approach:** Viết mutation CRUD cho `domains` và `handbooks`. Tái dùng helper cascade `deleteDocRelatedData` đã có trong `convex/documents/mutations.ts` để xóa dữ liệu phụ thuộc của từng doc, và schedule `deleteFromStorage` để xóa file R2 (cùng pattern `deletePermanent`).

## Boundaries & Constraints

**Always:**
- Mọi mutation auth qua `requireAuth`; kiểm tra `userId` sở hữu trước khi sửa/xóa.
- Xóa Domain → cascade xóa tất cả handbooks thuộc nó → cascade xóa tất cả documents thuộc các handbook đó (+ file R2 + related data).
- Xóa Handbook → cascade xóa documents (`by_handbook`) + file R2 + related data (tái dùng `deleteDocRelatedData`).
- `order` mới = max(order hiện có) + 1 khi tạo.
- Validate tên 1–100 ký tự (trim).

**Ask First:**
- Nếu số document trong 1 handbook quá lớn khiến 1 mutation vượt giới hạn Convex (read/write limit) → hỏi trước về chuyển sang xóa theo batch qua scheduler.

**Never:**
- Không tạo confirm dialog ở backend (UI confirm là việc client).
- Không đụng tới file rời ngoài handbook khi xóa handbook.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| createDomain | `name` | insert domain, order cuối, trả domainId | name rỗng/>100 → VALIDATION |
| renameDomain | `domainId, name` | patch name | không sở hữu → NOT_FOUND |
| deleteDomain | `domainId` | xóa domain + cascade handbooks + docs + R2 | không sở hữu → NOT_FOUND |
| createHandbook | `domainId, name` | insert handbook (rỗng), order cuối | domain không sở hữu → NOT_FOUND |
| renameHandbook | `handbookId, name` | patch name | không sở hữu → NOT_FOUND |
| deleteHandbook | `handbookId` | xóa docs `by_handbook` (+related+R2) rồi xóa handbook | handbook rỗng → chỉ xóa handbook |

</frozen-after-approval>

## Code Map

- `convex/domains/mutations.ts` (mới) — `create`, `rename`, `remove` (cascade).
- `convex/handbooks/mutations.ts` (mới) — `create`, `rename`, `remove` (cascade).
- Tái dùng: `deleteDocRelatedData` (export lại từ `convex/documents/mutations.ts` — hiện là hàm module-private; **đổi thành export** để dùng chung) hoặc tách sang `convex/lib/cascade.ts`.
- Tái dùng: `internal.documents.actions.deleteFromStorage` (schedule xóa R2).
- Tái dùng: `requireAuth`, `convexError`.

## Tasks & Acceptance

**Execution:**
- [ ] Refactor: tách `deleteDocRelatedData` + logic xóa storage 1 doc thành helper export (`convex/lib/cascade.ts` → `deleteDocumentCascade(ctx, doc, userId)`), cập nhật `deletePermanent`/`deleteAllTrashed` dùng helper này (no behavior change).
- [ ] `convex/domains/mutations.ts` — `create({name, color?})`, `rename({domainId, name})`, `remove({domainId})`: remove lặp handbooks `by_domain` → mỗi handbook gọi cascade docs → xóa handbook → xóa domain.
- [ ] `convex/handbooks/mutations.ts` — `create({domainId, name, color?})`, `rename({handbookId, name})`, `remove({handbookId})`: lặp docs `by_handbook`, gọi `deleteDocumentCascade`, xóa handbook.
- [ ] `npm run typecheck` xanh.

**Acceptance Criteria:**
- Given handbook có 3 docs + highlight/note, when `remove(handbookId)`, then 3 docs + related data biến mất, file R2 được schedule xóa, handbook biến mất.
- Given domain có 2 handbooks, when `remove(domainId)`, then cả 2 handbook + docs của chúng bị xóa.
- Given mutation `deletePermanent` cũ, when refactor xong, then hành vi không đổi (regression check).
