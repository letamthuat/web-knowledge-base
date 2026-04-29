---
title: 'Story 4.1 — Schema tabs + Convex reactive hook useTabSync'
type: 'feature'
created: '2026-04-29'
status: 'done'
baseline_commit: 'd489b0390f353da5512a5cc11528052c4fd6bf27'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Không có data layer nào cho tab workspace — không có mutations/queries Convex cho `tabs` table, không có hook reactive để sync tab state cross-device.

**Approach:** Tạo `convex/tabs/mutations.ts` + `convex/tabs/queries.ts` với đầy đủ CRUD + limit 10 tab; tạo `apps/web/src/hooks/useTabSync.ts` reactive hook expose tab list + mutations cho UI.

## Boundaries & Constraints

**Always:**
- `tabs` schema đã có sẵn trong `convex/schema.ts` (userId, docId, order, isActive, scrollState, updatedAt, clientMutationId) — không sửa schema
- Mọi mutation phải gọi `requireAuth()` từ `convex/lib/auth.ts`
- `openTab` phải idempotent: nếu docId đã mở thì `setActive` + return existing tabId, không tạo duplicate
- Giới hạn 10 tab: throw `convexError("VALIDATION", "Max 10 tabs", "Tối đa 10 tab cùng lúc")` khi user đã có 10 tab và mở tab mới
- `clientMutationId` + `updatedAt` dùng cho LWW conflict resolution (pattern từ `reading_progress`)
- Tất cả UI text/error messages bằng tiếng Việt

**Ask First:**
- Nếu cần thêm field vào `tabs` schema ngoài những gì đã có

**Never:**
- Không tạo thêm WebSocket service — dùng Convex reactive query (D9)
- Không copy Convex data vào Zustand trong hook này (Zustand cho ephemeral UI state ở Story 4.3)
- Không implement offline/Dexie cache (Epic 8 scope)
- Không implement drag-drop UI (Story 4.3 scope)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open tab — docId chưa mở | user có 3 tabs, `openTab(docId)` | Insert tab mới, `isActive=true`, trả về tabId | — |
| Open tab — docId đã mở | user có tab với docId đó | `setActive(existingTabId)`, trả về tabId (no insert) | — |
| Open tab — đã 10 tabs | user có đúng 10 tabs | Throw ConvexError VALIDATION "Tối đa 10 tab cùng lúc" | Client bắt và toast |
| Close tab active | đóng tab đang active | Xoá tab, set tab gần nhất (`lastActiveAt` cao nhất) thành active | Nếu không còn tab nào thì không set active |
| Reorder tabs | `reorderTabs([{tabId, order}])` | Patch `order` cho từng tabId | Skip tabId không thuộc user |
| updateScrollState | `updateScrollState(tabId, scrollState)` | Patch `scrollState` + `updatedAt` | — |
| listByUser reactive | subscribe | Trả về tabs sorted by `order` asc, filtered by userId | — |

</frozen-after-approval>

## Code Map

- `convex/schema.ts` — `tabs` table đã định nghĩa, không sửa
- `convex/lib/auth.ts` — `requireAuth()` helper
- `convex/lib/errors.ts` — `convexError()` factory
- `convex/tabs/mutations.ts` — cần tạo mới
- `convex/tabs/queries.ts` — cần tạo mới
- `apps/web/src/hooks/useTabSync.ts` — cần tạo mới
- `convex/_generated/api.d.ts` — auto-generated, không sửa tay

## Tasks & Acceptance

**Execution:**
- [x] `convex/tabs/queries.ts` -- tạo mới với export `listByUser` (reactive query, sort by `order` asc, requireAuth) -- data source cho useTabSync
- [x] `convex/tabs/mutations.ts` -- tạo mới với exports: `openTab`, `closeTab`, `setActive`, `reorderTabs`, `updateScrollState` -- CRUD layer cho tab workspace
- [x] `apps/web/src/hooks/useTabSync.ts` -- tạo mới hook expose `{ tabs, openTab, closeTab, setActive, reorderTabs, updateScrollState }` -- reactive interface cho UI components

**Acceptance Criteria:**
- Given schema `tabs` đã deploy, when gọi `listByUser()`, then trả về array tabs của user sorted by `order`
- Given user có 9 tabs, when `openTab(newDocId)`, then tab mới được insert và `isActive=true`
- Given user có 10 tabs, when `openTab(newDocId)`, then throw ConvexError với `messageVi: "Tối đa 10 tab cùng lúc"`
- Given `openTab(existingDocId)` khi docId đã mở, then không tạo duplicate, chỉ set active
- Given `closeTab(activeTabId)`, then tab bị xoá và tab có `lastActiveAt` cao nhất nhất được set `isActive=true`
- Given `reorderTabs([{tabId, order}])`, then `order` được patch cho đúng tabs của user, tabs không thuộc user bị skip
- Given device B subscribe `listByUser`, when device A gọi `openTab`, then device B nhận update ≤3s (Convex reactive)
- Given `useTabSync()` trong React component, then `tabs` array reactive, mutations callable

## Design Notes

**Idempotency pattern (từ reading_progress):**
```ts
// openTab — check existing trước khi insert
const existing = await ctx.db.query("tabs")
  .withIndex("by_user", q => q.eq("userId", userId))
  .filter(q => q.eq(q.field("docId"), args.docId))
  .first();
if (existing) {
  await ctx.db.patch(existing._id, { isActive: true, lastActiveAt: Date.now() });
  return existing._id;
}
```

**closeTab — auto-select next active:**
```ts
// Sau khi delete, nếu tab bị xoá là active, tìm tab có lastActiveAt cao nhất
const remaining = await ctx.db.query("tabs")
  .withIndex("by_user", q => q.eq("userId", userId)).collect();
if (tab.isActive && remaining.length > 0) {
  const next = remaining.sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
  await ctx.db.patch(next._id, { isActive: true });
}
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: 0 errors
- `npx convex dev --once` (hoặc deploy) -- expected: schema validated, functions deployed

**Manual checks:**
- Mở Convex dashboard → Functions → tabs/queries:listByUser và tabs/mutations:openTab xuất hiện
- Gọi `openTab` 11 lần cho cùng 1 user → lần thứ 11 phải throw ConvexError (test qua dashboard Run function)

## Suggested Review Order

**Data layer — Convex**

- Schema reference: tabs table shape, indexes `by_user` + `by_user_order`
  [`schema.ts:243`](../../convex/schema.ts#L243)

- Core mutation logic: openTab idempotency, limit enforcement, deactivate-all pattern
  [`mutations.ts:8`](../../convex/tabs/mutations.ts#L8)

- closeTab auto-promote next active tab by updatedAt
  [`mutations.ts:66`](../../convex/tabs/mutations.ts#L66)

- setActive, reorderTabs, updateScrollState with LWW idempotency
  [`mutations.ts:92`](../../convex/tabs/mutations.ts#L92)

- Reactive query sorted by order index
  [`queries.ts:1`](../../convex/tabs/queries.ts#L1)

**React hook**

- useTabSync: reactive binding + isLoading sentinel to distinguish loading vs empty
  [`useTabSync.ts:1`](../../apps/web/src/hooks/useTabSync.ts#L1)

## Spec Change Log

