
## From Story 4.1 review (2026-04-29)

- **reorderTabs duplicate order**: `reorderTabs` không enforce unique `order` values — nếu 2 tabs cùng order, index trả về theo insertion order. Fix khi implement Story 4.3 drag-drop.
- **closeTab updatedAt heuristic**: Promote tab bằng `updatedAt` cao nhất nhưng `updatedAt` bị mutate khi promote → sau lần đóng đầu tiên heuristic không còn là "tab user dùng gần nhất". Acceptable MVP — revisit nếu user complain.
- **openTab clientMutationId decorative**: `clientMutationId` được lưu nhưng không check để dedup — chỉ meaningful khi có offline queue (Epic 8 scope).
- **reorderTabs silent partial skip**: Tabs không thuộc user bị skip silently, UI optimistic revert cần xử lý ở Story 4.3.
