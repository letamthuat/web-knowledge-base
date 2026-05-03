
## Story 5.12 — Voice note đính kèm highlight (2026-05-03)

Bỏ qua theo yêu cầu. Implement sau nếu cần.

- **Scope**: Ghi âm ngắn đính kèm trực tiếp vào một highlight cụ thể (khác 5.10 là ghi âm tự do)
- **Schema sẵn**: `highlights.voiceNoteStorageId: v.optional(v.id("_storage"))` đã có trong convex/schema.ts
- **Việc cần làm khi implement**: Thêm nút mic trong HighlightMenu → dùng lại `useAudioRecorder` → upload R2 → patch `voiceNoteStorageId` → playback trong AnnotationPanel/NoteHoverCard

---

## From Story 4.1 review (2026-04-29)

- **reorderTabs duplicate order**: `reorderTabs` không enforce unique `order` values — nếu 2 tabs cùng order, index trả về theo insertion order. Fix khi implement Story 4.3 drag-drop.
- **closeTab updatedAt heuristic**: Promote tab bằng `updatedAt` cao nhất nhưng `updatedAt` bị mutate khi promote → sau lần đóng đầu tiên heuristic không còn là "tab user dùng gần nhất". Acceptable MVP — revisit nếu user complain.
- **openTab clientMutationId decorative**: `clientMutationId` được lưu nhưng không check để dedup — chỉ meaningful khi có offline queue (Epic 8 scope).
- **reorderTabs silent partial skip**: Tabs không thuộc user bị skip silently, UI optimistic revert cần xử lý ở Story 4.3.
