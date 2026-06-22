"use client";
// Realtime manager DÙNG CHUNG: 1 channel duy nhất nghe postgres_changes cho mọi bảng.
// Trước đây mỗi component/hook mở channel riêng → ~200 channel với 68 tài liệu →
// Supabase Realtime throttle/không join → không nhận event. Giờ gom về 1 channel,
// các hook đăng ký callback theo bảng qua emitter JS (không tạo channel mới).
import { supabase } from "@/lib/supabase/client";

// Mọi bảng có trong publication supabase_realtime (0002 + profiles ở 0003).
const TABLES = [
  "documents", "domains", "handbooks", "folders", "tags",
  "document_tags", "document_folders", "reading_progress", "reading_history",
  "tabs", "note_tabs", "highlights", "notes", "transcripts", "userAiSettings", "profiles",
] as const;

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let channel: any = null;
let currentToken: string | null = null;
let tokenInitialized = false;

function fire(table: string) {
  const set = listeners.get(table);
  if (set) set.forEach((fn) => fn());
}

function rebuild() {
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  let ch = supabase.channel("rt:all");
  for (const t of TABLES) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => fire(t));
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
