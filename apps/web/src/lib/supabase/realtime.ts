"use client";
// Realtime manager DÙNG CHUNG: 1 channel duy nhất nghe postgres_changes cho mọi bảng.
// Trước đây mỗi component/hook mở channel riêng → ~200 channel với 68 tài liệu →
// Supabase Realtime throttle/không join → không nhận event. Giờ gom về 1 channel,
// các hook đăng ký callback theo bảng qua emitter JS (không tạo channel mới).
import { supabase } from "@/lib/supabase/client";

// Mọi bảng có trong publication supabase_realtime (0002 + profiles ở 0003 + study ở 0005).
const TABLES = [
  "documents", "domains", "handbooks", "folders", "tags",
  "document_tags", "document_folders", "reading_progress", "reading_history",
  "tabs", "note_tabs", "highlights", "notes", "transcripts", "userAiSettings", "profiles",
  // Module Học tập (0005) — realtime để tạo space/đổi tiến độ hiện ngay, đồng bộ đa thiết bị.
  "study_spaces", "study_units", "study_checkpoints", "flashcards", "review_logs",
  "quiz_attempts", "feynman_sessions", "study_sessions", "study_plans", "study_plan_tasks",
] as const;

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let channel: any = null;
let currentToken: string | null = null;
let tokenInitialized = false;

// ── Echo suppression ──────────────────────────────────────────────────────────
// Ghi từ chính client này (đánh dấu bằng clientMutationId) không cần refetch:
// UI đã có state đúng. Chỉ nuốt đúng key mình vừa ghi → thay đổi từ thiết bị
// khác vẫn nhận bình thường. Fail-open: payload không có key thì fire như cũ.
const ownEchoKeys = new Set<string>();
const MAX_ECHO_KEYS = 200;

export function suppressEcho(key: string) {
  ownEchoKeys.add(key);
  if (ownEchoKeys.size > MAX_ECHO_KEYS) {
    // Set giữ thứ tự chèn — xoá key cũ nhất
    const oldest = ownEchoKeys.values().next().value;
    if (oldest !== undefined) ownEchoKeys.delete(oldest);
  }
}

// ── Debounced fire ────────────────────────────────────────────────────────────
// Gom nhiều event của cùng 1 bảng trong cửa sổ ngắn thành 1 lần notify.
// Import ZIP 50 file → 1-2 đợt refetch thay vì 50 đợt.
const FIRE_DEBOUNCE_MS = 150;
const fireTimers = new Map<string, ReturnType<typeof setTimeout>>();

function fire(table: string) {
  if (fireTimers.has(table)) return; // đã có đợt chờ — event này gộp vào
  fireTimers.set(table, setTimeout(() => {
    fireTimers.delete(table);
    const set = listeners.get(table);
    if (set) set.forEach((fn) => fn());
  }, FIRE_DEBOUNCE_MS));
}

function rebuild() {
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  let ch = supabase.channel("rt:all");
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (payload: any) => {
      const key = payload?.new?.clientMutationId as string | undefined;
      if (key && ownEchoKeys.has(key)) {
        ownEchoKeys.delete(key);
        return; // echo của chính mình — bỏ qua
      }
      fire(t);
    });
  }
  ch.subscribe();
  channel = ch;
}

// Gọi từ SupabaseProvider khi có/đổi JWT. Chỉ rebuild khi token thực sự đổi.
export function setRealtimeToken(token: string | null) {
  if (tokenInitialized && token === currentToken) return;
  tokenInitialized = true;
  currentToken = token;
  supabase.realtime.setAuth(token);
  rebuild();
}

// Hook đăng ký nghe thay đổi 1 bảng; trả về hàm huỷ đăng ký. KHÔNG tạo channel mới.
export function subscribeTable(table: string, cb: Listener): () => void {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table)!.add(cb);
  if (!channel) rebuild(); // khởi tạo lần đầu (sẽ rebuild lại khi token set)
  return () => {
    listeners.get(table)?.delete(cb);
  };
}
