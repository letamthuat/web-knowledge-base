# Epic 2 Context: Content Library & Multi-Format Upload

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to build a personal content library by uploading documents in 8 formats (PDF, EPUB, DOCX, PPTX, Image, Audio, Video, Markdown) or saving web URLs via drag-drop or multipart resumable upload (files >100 MB survive network drops); then view, filter by tag/folder/format/date, rename, soft-delete to a 30-day trash, and restore — all with realtime reactive UI driven by Convex.

## Stories

- Story 2.1: Storage abstraction layer (D10) — `StorageProvider` interface routing ≤5 MB → Convex, >5 MB → R2, fallback → B2
- Story 2.2: Single-file upload ≤5 MB (Convex storage path) for all 8 formats
- Story 2.3: Multipart resumable upload >5 MB via R2 (100 MB chunks, resume after disconnect)
- Story 2.4: Save URL as web clip (server-side fetch + Mozilla Readability extraction)
- Story 2.5: Reactive library list — card grid with format icon, title, size, date; realtime updates
- Story 2.6: Tag + Folder assignment per document (multi-tag, single folder, color badges)
- Story 2.7: Filter library by tag / folder / format / date range (URL-bookmarkable)
- Story 2.8: Inline document rename (double-click title, Enter save, Esc cancel)
- Story 2.9: Soft-delete to trash (30-day TTL) + restore + permanent delete

## Requirements & Constraints

**Functional (FR6–FR11):**
- FR6: Upload PDF/EPUB/DOCX/PPTX/Image/Audio/Video/Markdown/web URL
- FR7: Simultaneous multi-file upload via drag-drop or button
- FR8: Library list showing title, format, size, upload date
- FR9: Rename, soft-delete (trash), restore, permanent delete
- FR10: Assign free-form tags (many) and one folder per document
- FR11: Filter by tag / folder / format / date range

**Non-Functional (NFR3, NFR10, NFR11):**
- NFR3: Document load ≤2 s for files ≤50 MB; ≤5 s for files ≤500 MB
- NFR10: Documents private by default, AES-256 at rest
- NFR11: File access via presigned URL expiring ≤15 minutes — no permanent public URLs

**Free-tier constraint:** All storage backends (Convex, R2, B2) must stay within permanent free tiers.

## Technical Decisions

**D10 — Storage Abstraction Layer** (blocks all upload/download features):
- Interface `StorageProvider` exported from `apps/web/src/lib/storage/index.ts` with methods: `upload`, `getDownloadUrl`, `delete`, `getMultipartUploadId`, `uploadPart`, `completeMultipart`
- Routing rule: file ≤5 MB → `ConvexStorage` (returns `Id<"_storage">`); file >5 MB → `R2Storage` via presigned multipart URL; R2 failure → `B2Storage` fallback without changing call sites
- `storageBackend` field on `documents` table records which backend holds each file (`"convex" | "r2" | "b2"`)
- Presigned URLs must expire ≤15 min (NFR11); generated server-side in Convex actions

**Convex Schema (relevant tables):**
- `documents`: `userId`, `title`, `format`, `fileSizeBytes`, `storageBackend`, `storageKey`, `status`, `trashedAt`, `createdAt` — indexed `by_user`, `by_user_status`
- `tags`: `userId`, `name`, `color` — indexed `by_user`
- `document_tags`: `userId`, `docId`, `tagId` — indexed `by_doc`, `by_tag`
- `folders`: `userId`, `name` — indexed `by_user`
- `document_folders`: `userId`, `docId`, `folderId` — indexed `by_doc`, `by_folder`
- `upload_sessions`: `userId`, `uploadId`, `storageBackend`, `objectKey`, `totalChunks`, `uploadedChunks`, `status`, `expiresAt` — indexed `by_user`

**Naming conventions:**
- Table names: `snake_case` plural (`documents`, `upload_sessions`)
- Field names: `camelCase` (`userId`, `storageBackend`, `fileSizeBytes`)
- Convex functions: `camelCase` (`getDocumentsByUser`, `finalizeUpload`)
- Components: `PascalCase.tsx` (`UploadDropzone`, `DocumentGrid`)
- All Convex mutations start with `requireAuth(ctx)`; throw `ConvexError` typed

**Upload data flow:**
1. User drag-drop → `UploadDropzone`
2. `useUpload` → `api.documents.actions.requestUpload(size, format)`
3. Convex action routes storage → returns `{uploadUrl, storageBackend, uploadSessionId}`
4. Frontend chunk-uploads directly to storage
5. On complete → `api.documents.mutations.finalize(uploadSessionId)` → insert `documents`
6. Reactive `useQuery` updates library grid automatically
7. Telemetry: `logTelemetry("upload.completed", {latencyMs, sizeBytes, format})`

**Auth pattern:** Every Convex query/mutation gates on `userId` from Better Auth session. All tables indexed `by_user`; no cross-user data access.

**Cron jobs:** Weekly prune for `trashedAt < now - 30d`; 24 h prune for expired `upload_sessions`.

## UX & Interaction Patterns

**Upload flow:**
- Drag-drop zone accepts 8 supported MIME types; unsupported formats show toast VI "Định dạng không hỗ trợ" client-side
- For >5 MB files: show realtime chunk progress
- Multi-file: each file uploads independently with individual progress

**Library list (`/library`):**
- `DocumentGrid` — card per document: format icon, title, formatted size, `createdAt` VI locale, tag badges
- Sort: `createdAt desc` (newest first); loading: skeleton cards; empty state: VI + CTA
- Realtime: new uploads appear without refresh

**Filter bar:** Multi-select tags, single folder, multi-select formats, date range; URL query string updated on every change; "Xoá bộ lọc" resets

**Tag/Folder:** Tag popover per card; sidebar "Folders" with drag-to-folder

**Rename:** Double-click title → inline input; Enter saves; Esc cancels; validation: empty or >200 chars → VI error

**Trash:** "Xoá" + confirm → `status: "trashed"`, `trashedAt = now`; sidebar "Thùng rác"; "Khôi phục" restores; "Xoá vĩnh viễn" + confirm → delete row + storage

## Cross-Story Dependencies

**Dependency on Epic 1:** Auth session (Better Auth + Convex) must be live — provides `userId` for all Epic 2 mutations.

**Internal story order:**
- Story 2.1 (storage abstraction) blocks 2.2, 2.3, 2.4
- Story 2.5 (library list) depends on `documents` schema from 2.2
- Story 2.6 (tags/folders) must precede Story 2.7 (filtering)
- Story 2.9 (trash) depends on `status`/`trashedAt` fields from 2.2

**Downstream (Epic 3):** Epic 3 viewers use `storageKey` + `storageBackend` via D10 abstraction to download files.
