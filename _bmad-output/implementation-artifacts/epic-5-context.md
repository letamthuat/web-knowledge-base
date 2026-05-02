# Epic 5 Context: Highlight, Note & Knowledge Linking

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to annotate documents with color highlights and inline sticky notes, write free-form Markdown notes in a dedicated workspace, link notes bidirectionally to documents and highlights, and attach voice recordings to highlights. This epic turns passive reading into active knowledge capture and forms the knowledge-graph layer of the app.

## Stories

- Story 5.1: Schema `highlights` + Convex CRUD
- Story 5.2: Highlight inline + floating menu 4 màu
- Story 5.3: Highlight list + jump
- Story 5.4: Edit + Delete highlight
- Story 5.5: Bookmark/Timestamp marker
- Story 5.6: Sticky note inline neo highlight
- Story 5.7: Note pane từ highlight với Ctrl/Cmd+N (≤1.5s)
- Story 5.8: Schema `notes` + auto-save ≤1s
- Story 5.9: Note workspace `/notes` Markdown editor
- Story 5.10: Bidirectional link `@doc-title` `@highlight-id`
- Story 5.11: Tag note + filter/sort
- Story 5.12: Voice note đính kèm highlight

## Requirements & Constraints

**Highlights (FR29–33)**
- Text selection ≥ 3 chars in PDF/EPUB/DOCX/MD/WebClip triggers a floating menu with 4 color swatches (yellow/green/blue/pink) plus "Note" and "Copy" actions.
- Highlight creation is optimistic: render immediately from Dexie, sync to Convex in background; if offline, badge as pending (flushed in Epic 8).
- Users can jump from the highlight list to the exact position in the viewer via `scrollToAnchor`.
- Bookmarks/timestamp markers share the same `highlights` table using format-specific anchor types (see Technical Decisions).
- Edit color and delete are available via popover on any highlight.

**Notes (FR34–39)**
- Note auto-save must fire ≤ 1 second after the user stops typing (800ms debounce → upsert → "Đã lưu" toast within 1s total — NFR5).
- Note pane must open with caret focused within ≤ 1.5 seconds of `Ctrl/Cmd+N` or click (NFR4).
- Note workspace (`/notes`) supports: headings H1–H3, list, code, table, KaTeX math, mermaid diagrams, paste image (Ctrl+V → upload → insert URL), drag-drop file attachment.
- Sticky notes are capped at 200 chars; overflow should prompt the user to open the Note pane.
- Voice notes: record via `MediaRecorder`, max 2 minutes, upload as MP3/WebM ≤ 5MB to Convex `_storage`, store ID in `highlights.voiceNoteStorageId`. No transcription in MVP.
- Bidirectional links: typing `@` in the note editor opens an autocomplete popover (docs + recent highlights); selecting inserts a `[@Name](docref:ID)` markdown link and writes a `note_links` row. The doc's "Backlinks" panel lists all notes linking to it.
- Tag/filter: notes share the same `tags` table used by documents; `/notes` filter bar supports tag, date range, and `parentDocId`.
- Voice note requires microphone permission; missing permission shows a Vietnamese error message.

**Non-functional**
- All mutations must include a `clientMutationId` (UUID v7) for idempotency via `mutation_log`.
- All Convex functions must call `requireAuth`.
- Voice transcription is deferred to Phase 2+; schema must be forward-compatible.

## Technical Decisions

**Data model**

```
highlights(userId, docId, color: enum, anchor: string, text: string,
           stickyNoteText?: string, voiceNoteStorageId?: Id<"_storage">,
           createdAt, updatedAt)
  index: by_user_doc

notes(userId, title, bodyMd, tagIds: Id<"tags">[], parentDocId?: Id<"documents">,
      updatedAt)

note_links(noteId, targetType: "doc"|"highlight", targetId, createdAt)
  index: by_note, by_target
```

**Anchor format** — `anchor` is a JSON-serialised string encoding position by format:
- PDF: `{pdf_page, page, offset}`
- EPUB: CFI string
- DOCX/MD/WebClip: text-quote range
- Audio/Video: `{time_seconds, seconds}`
- PPTX: `{slide_index, slide}`

**Convex modules**
- `convex/highlights/{queries,mutations}.ts` — exports `listByDoc`, `create`, `update`, `delete`
- `convex/notes/{queries,mutations.ts}` — exports `getById`, `listByUser({tagIds?, parentDocId?, dateRange?})`, `upsert`
- Voice upload uses Convex `_storage` (not R2/B2); only small audio files (≤ 5MB).

**Mutation pattern (outbox)**
All mutations go through `useMutateWithOutbox`: write Dexie `mutation_outbox` first → optimistic UI → Convex sync in background. Conflict resolution uses Last-Write-Wins (LWW); conflicts surface in `sync_conflicts` table.

**Component structure**
- `components/highlight/` — `HighlightLayer.tsx`, `FloatingMenu.tsx`, `HighlightList.tsx`
- `components/note/` — `NotePane.tsx`, `StickyNote.tsx`, `NoteWorkspace.tsx`, `MarkdownEditor.tsx`, `BiDirectionalLink.tsx`, `VoiceNoteRecorder.tsx`
- Markdown preview uses `react-markdown` + KaTeX + mermaid (all lazy-loaded only when note content requires them).
- Editor choice: CodeMirror 6 or TipTap (decision deferred to story implementation).

**State layers**
- UI ephemeral (Zustand): pane open/close, recording state, floating menu visibility
- Data (Convex reactive `useQuery`): highlights list, notes list, backlinks
- Offline cache (Dexie): `notes_cache`, `mutation_outbox`

**Telemetry events**: `note.opened_from_highlight`, `note.saved` (both with `latencyMs`).

## UX & Interaction Patterns

- Floating menu appears near the text selection; dismissed on click-outside or Escape.
- Note pane slides in from the right at 40% viewport width; Esc or the X button closes it and triggers auto-save.
- Sticky note icon (📝) renders inline next to the highlight in the viewer; click expands/collapses a small overlay.
- Voice note icon (🎤) is in the floating menu; clicking opens a modal recorder with real-time waveform display.
- `@` autocomplete in the note editor is a popover with keyboard navigation (Tab/Enter to select).
- All labels, buttons, and error messages are in Vietnamese (NFR37); mobile tap targets ≥ 44×44 px (NFR31).

## Cross-Story Dependencies

- **5.1 must ship before 5.2–5.6**: schema and Convex CRUD must exist before any UI story.
- **5.8 must ship before 5.7, 5.9–5.11**: `notes` schema and upsert mutation required by all note UI stories.
- **5.6** extends the `highlights` schema (adds `stickyNoteText`) — coordinate with 5.1.
- **5.12** extends the `highlights` schema (adds `voiceNoteStorageId`) — coordinate with 5.1.
- **5.10** depends on 5.8 (`notes` table) and 5.1 (`highlights` for target IDs); `note_links` table should be added in 5.8.
- **Epic 8 (Offline & PWA)**: highlights/notes offline queue uses the outbox flushed in Epic 8 — Stories 5.2/5.7 write to outbox but rely on Epic 8 for the flush mechanism.
- **Epic 6 (Full-text Search)**: search will index `notes.bodyMd` and `highlights.text`; schema in this epic must be finalized before Epic 6 indexing work begins.
- **Epic 9 (Data Portability)**: export ZIP must include highlights and notes; schema stability here is a prerequisite.
