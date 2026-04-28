import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Các format tài liệu được hỗ trợ (FR6)
const documentFormat = v.union(
  v.literal("pdf"),
  v.literal("epub"),
  v.literal("docx"),
  v.literal("pptx"),
  v.literal("image"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("markdown"),
  v.literal("web_clip"),
);

// Storage backend (D10)
const storageBackend = v.union(
  v.literal("convex"),
  v.literal("r2"),
  v.literal("b2"),
);

// Position type (FR22 — 5 loại)
const positionType = v.union(
  v.literal("pdf_page"),    // {page: number, offset: number}
  v.literal("epub_cfi"),    // {cfi: string}
  v.literal("time_seconds"),// {seconds: number}
  v.literal("scroll_pct"),  // {pct: number}
  v.literal("slide_index"), // {index: number}
);

// Role sharing Phase 2+ schema-ready (FR56)
const shareRole = v.union(
  v.literal("owner"),
  v.literal("editor"),
  v.literal("commenter"),
  v.literal("viewer"),
);

// Highlight màu (FR30)
const highlightColor = v.union(
  v.literal("yellow"),
  v.literal("green"),
  v.literal("blue"),
  v.literal("pink"),
);

export default defineSchema({
  // ─── USERS ───────────────────────────────────────────────────────────────────
  // Better Auth quản lý bảng này — ta extend thêm các field cho MFA + preferences
  users: defineTable({
    // Better Auth core fields
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),

    // D2: MFA TOTP từ MVP (FR4)
    twoFactorEnabled: v.boolean(),
    twoFactorSecret: v.optional(v.string()),   // encrypted at rest
    backupCodes: v.optional(v.array(v.string())), // hashed

    // User preferences (Reading Mode FR61-FR62)
    preferences: v.optional(v.object({
      readingMode: v.optional(v.object({
        // theme nhớ riêng theo format (FR61)
        themeByFormat: v.optional(v.record(v.string(), v.union(
          v.literal("light"),
          v.literal("sepia"),
          v.literal("dark"),
        ))),
        fontFamily: v.optional(v.union(
          v.literal("serif"),
          v.literal("sans"),
          v.literal("mono"),
        )),
        fontSize: v.optional(v.number()),     // 12–28
        lineHeight: v.optional(v.number()),   // 1.4–2.0
        columnWidth: v.optional(v.union(
          v.literal("narrow"),
          v.literal("medium"),
          v.literal("wide"),
        )),
      })),
    })),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  // ─── SESSIONS (Better Auth) ───────────────────────────────────────────────
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    deviceId: v.optional(v.string()),    // per-device logout (FR3)
    expiresAt: v.number(),               // 30 ngày (NFR21)
    lastActiveAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // ─── DOCUMENTS ────────────────────────────────────────────────────────────
  // FR6-FR11: Upload + library
  documents: defineTable({
    userId: v.id("users"),

    // Metadata
    title: v.string(),
    format: documentFormat,
    fileSizeBytes: v.optional(v.number()),
    mimeType: v.optional(v.string()),

    // Storage (D10)
    storageBackend: storageBackend,
    storageKey: v.string(),             // Id<"_storage"> hoặc R2 object key

    // URL content (web_clip)
    sourceUrl: v.optional(v.string()),
    clippedContent: v.optional(v.string()), // Mozilla Readability output

    // Trạng thái
    status: v.union(
      v.literal("processing"),  // đang upload/process
      v.literal("ready"),       // sẵn sàng đọc
      v.literal("error"),       // lỗi xử lý
      v.literal("trashed"),     // thùng rác (FR9)
    ),
    trashedAt: v.optional(v.number()),    // để tính 30 ngày TTL
    restoredAt: v.optional(v.number()),

    // Full-text search content (D3)
    extractedText: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    lastOpenedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_format", ["userId", "format"])
    .index("by_user_created", ["userId", "createdAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId", "format", "status"],
    })
    .searchIndex("search_content", {
      searchField: "extractedText",
      filterFields: ["userId", "status"],
    }),

  // ─── TAGS ─────────────────────────────────────────────────────────────────
  // FR10: Tag tự do
  tags: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),  // hex
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // ─── DOCUMENT TAGS (many-to-many) ────────────────────────────────────────
  document_tags: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),
    tagId: v.id("tags"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_doc", ["docId"])
    .index("by_tag", ["tagId"])
    .index("by_doc_tag", ["docId", "tagId"]),

  // ─── FOLDERS ──────────────────────────────────────────────────────────────
  // FR10: Folder hierarchy
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentFolderId"]),

  // ─── DOCUMENT FOLDERS ────────────────────────────────────────────────────
  document_folders: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),
    folderId: v.id("folders"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_doc", ["docId"])
    .index("by_folder", ["folderId"]),

  // ─── READING PROGRESS ─────────────────────────────────────────────────────
  // FR21-FR23: Lưu vị trí đọc, resume cross-device
  reading_progress: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),

    positionType: positionType,
    // JSON.stringify của position object (PDF: {page,offset}, EPUB: {cfi}, ...)
    positionValue: v.string(),

    // Estimated progress 0–1 cho progress bar (FR65)
    progressPct: v.optional(v.number()),

    // LWW field-level (D5)
    updatedAt: v.number(),

    // clientMutationId cho idempotency offline queue (D6)
    clientMutationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_doc", ["userId", "docId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  // ─── READING HISTORY ──────────────────────────────────────────────────────
  // FR24: ≥10 entries lịch sử đọc gần đây
  reading_history: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),
    openedAt: v.number(),
    // Vị trí lúc mở (để jump back)
    positionType: v.optional(positionType),
    positionValue: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_opened", ["userId", "openedAt"])
    .index("by_user_doc_opened", ["userId", "docId", "openedAt"]),

  // ─── TABS ─────────────────────────────────────────────────────────────────
  // FR25-FR28: Multi-tab workspace, sync cross-device
  tabs: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),

    // Thứ tự tab (drag-drop FR26)
    order: v.number(),
    isActive: v.boolean(),

    // Scroll state (FR27)
    scrollState: v.optional(v.string()), // JSON position

    // LWW (D5)
    updatedAt: v.number(),
    clientMutationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"]),

  // ─── HIGHLIGHTS ───────────────────────────────────────────────────────────
  // FR29-FR33: Highlight + bookmark + timestamp marker
  highlights: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),

    color: highlightColor,

    // Type: text selection hoặc marker
    type: v.union(
      v.literal("text"),       // bôi đen text (FR29)
      v.literal("bookmark"),   // page bookmark PDF/EPUB (FR33)
      v.literal("timestamp"),  // audio/video timestamp (FR33)
    ),

    // Vị trí trong tài liệu
    positionType: positionType,
    positionValue: v.string(),   // JSON position

    // Text được bôi đen
    selectedText: v.optional(v.string()),

    // Short note đính kèm (FR30 — Ctrl+N)
    note: v.optional(v.string()),

    // Voice note (FR39)
    voiceNoteStorageId: v.optional(v.id("_storage")),

    // LWW (D5)
    updatedAt: v.number(),
    createdAt: v.number(),
    clientMutationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_doc", ["userId", "docId"])
    .index("by_doc", ["docId"]),

  // ─── NOTES ────────────────────────────────────────────────────────────────
  // FR34-FR38: Note Markdown workspace
  notes: defineTable({
    userId: v.id("users"),

    // Có thể gắn với doc (FR38)
    docId: v.optional(v.id("documents")),

    // Sticky note gắn highlight (FR36)
    highlightId: v.optional(v.id("highlights")),

    title: v.optional(v.string()),
    body: v.string(),  // Markdown

    // Tags cho note (FR38)
    tagIds: v.optional(v.array(v.id("tags"))),

    // LWW (D5)
    updatedAt: v.number(),
    createdAt: v.number(),
    clientMutationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_doc", ["userId", "docId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .searchIndex("search_body", {
      searchField: "body",
      filterFields: ["userId", "docId"],
    }),

  // ─── DOCUMENT SHARES (Phase 2+ — schema sẵn từ MVP) ─────────────────────
  // FR55-FR59: Sharing & collaboration
  document_shares: defineTable({
    docId: v.id("documents"),
    ownerId: v.id("users"),
    sharedWithEmail: v.string(),        // email người được mời
    sharedWithUserId: v.optional(v.id("users")), // sau khi họ đăng ký
    role: shareRole,
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_doc", ["docId"])
    .index("by_owner", ["ownerId"])
    .index("by_shared_email", ["sharedWithEmail"]),

  // ─── TELEMETRY EVENTS ─────────────────────────────────────────────────────
  // FR52-FR53: Self-observability, không third-party
  telemetry_events: defineTable({
    userId: v.id("users"),

    // event name theo dot.notation (resume_position.loaded, tabs.synced, ...)
    event: v.string(),

    // Latency đo được (ms)
    latencyMs: v.optional(v.number()),

    // Device identifier
    deviceId: v.optional(v.string()),

    // Metadata bổ sung
    meta: v.optional(v.any()),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_event", ["userId", "event"])
    .index("by_event_ts", ["event", "createdAt"]),

  // ─── ERROR LOGS ───────────────────────────────────────────────────────────
  // FR54: Error log cho /admin/errors
  error_logs: defineTable({
    userId: v.optional(v.id("users")),

    // Error classification
    code: v.string(),      // NOT_FOUND | FORBIDDEN | VALIDATION | CONFLICT | INTERNAL
    message: v.string(),   // EN (log)
    stack: v.optional(v.string()),

    // Context
    source: v.optional(v.string()),   // convex function name / component
    meta: v.optional(v.any()),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_created", ["createdAt"]),

  // ─── SYNC CONFLICTS ───────────────────────────────────────────────────────
  // D5: LWW + diff > 20 chars → ghi conflict cho user review
  sync_conflicts: defineTable({
    userId: v.id("users"),

    // Entity bị conflict
    entityType: v.string(),   // "notes" | "highlights" | "reading_progress" | ...
    entityId: v.string(),     // Convex Id dạng string

    fieldName: v.string(),

    // Hai version xung đột
    versionA: v.string(),
    versionB: v.string(),

    // Đã giải quyết chưa
    resolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
    resolvedWith: v.optional(v.union(v.literal("a"), v.literal("b"))),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_resolved", ["userId", "resolved"]),

  // ─── MUTATION LOG (idempotency) ───────────────────────────────────────────
  // D6: Dedupe offline mutations, TTL 7 ngày
  mutation_log: defineTable({
    userId: v.id("users"),
    clientMutationId: v.string(),   // UUID v7
    mutationName: v.string(),
    result: v.optional(v.any()),
    createdAt: v.number(),
    // TTL tự prune bằng scheduled action
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_mutation_id", ["clientMutationId"])
    .index("by_expires", ["expiresAt"]),

  // ─── UPLOAD SESSIONS ──────────────────────────────────────────────────────
  // D10: R2 multipart resumable upload (file > 100MB), TTL 24h
  upload_sessions: defineTable({
    userId: v.id("users"),
    docId: v.optional(v.id("documents")),

    // R2 multipart upload ID
    uploadId: v.string(),
    objectKey: v.string(),

    // Progress
    totalChunks: v.number(),
    uploadedChunks: v.array(v.object({
      partNumber: v.number(),
      etag: v.string(),
    })),

    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("aborted"),
    ),

    createdAt: v.number(),
    expiresAt: v.number(),  // TTL 24h
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_upload_id", ["uploadId"])
    .index("by_expires", ["expiresAt"]),

  // ─── TRANSCRIPTS ─────────────────────────────────────────────────────────────
  transcripts: defineTable({
    docId: v.id("documents"),
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error"),
    ),
    // Mảng segments với timestamp (từ Groq Whisper)
    segments: v.optional(v.array(v.object({
      start: v.number(),   // seconds
      end: v.number(),     // seconds
      text: v.string(),
    }))),
    language: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_doc", ["docId"])
    .index("by_user", ["userId"]),
});
