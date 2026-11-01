"use client";
// Nghe bài — player singleton (1 thẻ <audio> cho cả app) để nghe tiếp khi rời reader / khoá màn hình.
// iOS PWA: phải "mở khoá" audio ĐỒNG BỘ trong cú chạm (unlockAudio) trước mọi await;
// đoạn kế được xin URL sẵn trong lúc đoạn hiện tại đang phát → hết đoạn chỉ đổi src, không chờ mạng.
import { useSyncExternalStore } from "react";
import type { SpeechSegment } from "./speechText";

export type TtsVoice = "Kore" | "Charon"; // giọng Gemini TTS: nữ / nam
export const TTS_RATES = [0.9, 1, 1.15, 1.3, 1.5, 1.75, 2] as const;

export type TtsState = {
  docId: string | null;
  docTitle: string;
  segments: SpeechSegment[];
  index: number;
  playing: boolean;
  loading: boolean;
  error: string | null;
  rate: number;
  voice: TtsVoice;
  /** Trang mở khi bấm "tới chỗ đang nghe" (podcast); null = reader của docId. */
  href: string | null;
};

const LS_RATE = "tts-rate";
const LS_VOICE = "tts-voice";
const posKey = (docId: string) => `tts-pos:${docId}`;

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string | null) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ }
}

let state: TtsState = {
  docId: null, docTitle: "", segments: [], index: 0,
  playing: false, loading: false, error: null, rate: 1, voice: "Kore", href: null,
};
let prefsLoaded = false;
const listeners = new Set<() => void>();

function setState(patch: Partial<TtsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function loadPrefs() {
  if (prefsLoaded || typeof window === "undefined") return;
  prefsLoaded = true;
  const r = Number(lsGet(LS_RATE));
  const v = lsGet(LS_VOICE);
  state = {
    ...state,
    rate: (TTS_RATES as readonly number[]).includes(r) ? r : 1,
    voice: v === "Charon" ? v : "Kore",
  };
}

export function useTts(): TtsState {
  loadPrefs();
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export function getTtsState(): TtsState {
  loadPrefs();
  return state;
}

// ─── audio element ──────────────────────────────────────────────────────────

let audio: HTMLAudioElement | null = null;
let silentUrl: string | null = null;
let loadToken = 0;
let pendingSeek: number | null = null;
let lastSaved = 0;

/** WAV im lặng 0.1s — tạo bằng tay để chắc chắn iOS giải mã được. */
function silentWavUrl(): string {
  if (silentUrl) return silentUrl;
  const n = 800; // 8kHz × 0.1s, 8-bit mono
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentUrl;
}

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = "auto";
  a.setAttribute("playsinline", "");
  a.addEventListener("play", () => { if (a.src !== silentUrl) setState({ playing: true }); syncMediaSession(); });
  a.addEventListener("pause", () => { if (a.src !== silentUrl) { setState({ playing: false }); savePos(true); } syncMediaSession(); });
  a.addEventListener("playing", () => { setState({ loading: false }); prefetch(state.index + 1); });
  a.addEventListener("waiting", () => setState({ loading: true }));
  a.addEventListener("loadedmetadata", () => {
    a.playbackRate = state.rate; // iOS reset playbackRate khi đổi src
    if (pendingSeek != null && pendingSeek < a.duration) a.currentTime = pendingSeek;
    pendingSeek = null;
  });
  a.addEventListener("timeupdate", () => { savePos(false); updatePositionState(); });
  a.addEventListener("ended", () => {
    if (a.src === silentUrl) return;
    if (state.index + 1 < state.segments.length) void loadIndex(state.index + 1, 0);
    else {
      setState({ playing: false });
      if (state.docId) lsSet(posKey(state.docId), null); // nghe hết → lần sau nghe từ chỗ đang đọc
      window.dispatchEvent(new CustomEvent("kb:tts-finished", { detail: { docId: state.docId } }));
    }
  });
  a.addEventListener("error", () => {
    if (a.src && a.src !== silentUrl) setState({ loading: false, playing: false, error: "Không phát được đoạn này" });
  });
  audio = a;
  return a;
}

/** GỌI ĐỒNG BỘ trong onClick, trước mọi await — iOS chỉ cho play() trong cú chạm. */
export function unlockAudio() {
  const a = getAudio();
  if (state.docId && a.src && a.src !== silentUrl) return; // đã có phiên đang chạy
  a.src = silentWavUrl();
  a.play().catch(() => {});
}

// ─── URL cache (presigned 6h) ───────────────────────────────────────────────

const urlCache = new Map<string, Promise<string>>();

/** Đoạn thường đọc bằng giọng user chọn; đoạn podcast gửi nguyên hội thoại 2 giọng. */
function requestUrl(seg: SpeechSegment): Promise<string> {
  const k = JSON.stringify(seg.dialogue ? { dialogue: seg.dialogue } : { text: seg.text, voice: state.voice });
  const hit = urlCache.get(k);
  if (hit) return hit;
  const p = fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: k,
  }).then(async (res) => {
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? `Lỗi ${res.status}`);
    return data.url;
  });
  p.catch(() => urlCache.delete(k));
  urlCache.set(k, p);
  return p;
}

/** Xin sẵn URL 2 đoạn kế (lượt thoại podcast ngắn) — hết đoạn chỉ đổi src, chạy được khi khoá máy. */
function prefetch(i: number) {
  for (const k of [i, i + 1]) {
    const seg = state.segments[k];
    if (seg) requestUrl(seg).catch(() => {});
  }
}

async function loadIndex(i: number, seekTo: number) {
  const seg = state.segments[i];
  if (!seg) return;
  const token = ++loadToken;
  setState({ index: i, loading: true, error: null });
  syncMediaSession();
  window.dispatchEvent(new CustomEvent("kb:tts-segment", { detail: { docId: state.docId, segment: seg, index: i } }));
  try {
    const url = await requestUrl(seg);
    if (token !== loadToken) return;
    const a = getAudio();
    pendingSeek = seekTo > 0 ? seekTo : null;
    a.src = url;
    a.playbackRate = state.rate;
    await a.play();
  } catch (e) {
    if (token !== loadToken) return;
    setState({ loading: false, playing: false, error: e instanceof Error ? e.message : "Không tải được giọng đọc" });
  }
}

// ─── position ───────────────────────────────────────────────────────────────

function savePos(force: boolean) {
  if (!state.docId || !audio || audio.src === silentUrl) return;
  const now = Date.now();
  if (!force && now - lastSaved < 4000) return;
  lastSaved = now;
  lsSet(posKey(state.docId), JSON.stringify({ index: state.index, time: audio.currentTime, title: state.segments[state.index]?.title, at: now }));
}

export function getSavedPos(docId: string): { index: number; time: number; title?: string } | null {
  try {
    const raw = lsGet(posKey(docId));
    if (!raw) return null;
    const p = JSON.parse(raw) as { index: number; time: number; title?: string; at: number };
    if (Date.now() - p.at > 30 * 86_400_000) return null;
    return p;
  } catch { return null; }
}

// ─── public API ─────────────────────────────────────────────────────────────

export function startListening(opts: { docId: string; docTitle: string; segments: SpeechSegment[]; startIndex: number; startTime?: number; href?: string }) {
  if (opts.segments.length === 0) {
    setState({ error: "Tài liệu này không có chữ để đọc" });
    return;
  }
  setState({
    docId: opts.docId, docTitle: opts.docTitle, segments: opts.segments,
    error: null, playing: false, href: opts.href ?? null,
  });
  const i = Math.max(0, Math.min(opts.segments.length - 1, opts.startIndex));
  void loadIndex(i, opts.startTime ?? 0);
}

export function togglePlay() {
  const a = getAudio();
  if (!state.docId) return;
  if (!a.src || a.src === silentUrl || state.error) { void loadIndex(state.index, 0); return; }
  if (a.paused) a.play().catch(() => {});
  else a.pause();
}

export function skipSegment(delta: number) {
  const i = state.index + delta;
  if (i < 0 || i >= state.segments.length) return;
  void loadIndex(i, 0);
}

export function jumpToSegment(i: number) {
  if (i >= 0 && i < state.segments.length) void loadIndex(i, 0);
}

export function seekBy(sec: number) {
  const a = getAudio();
  if (!a.duration) return;
  const t = a.currentTime + sec;
  if (t < 0 && state.index > 0 && sec < 0) { void loadIndex(state.index - 1, 0); return; }
  a.currentTime = Math.max(0, Math.min(a.duration - 0.2, t));
}

export function setRate(rate: number) {
  lsSet(LS_RATE, String(rate));
  setState({ rate });
  if (audio) { audio.playbackRate = rate; audio.defaultPlaybackRate = rate; }
}

export function setVoice(voice: TtsVoice) {
  lsSet(LS_VOICE, voice);
  setState({ voice });
  const ownVoices = state.segments.some((s) => s.dialogue);
  if (state.docId && !ownVoices && audio && audio.src !== silentUrl) void loadIndex(state.index, 0);
}

export function stopListening() {
  savePos(true);
  loadToken++;
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  setState({ docId: null, segments: [], index: 0, playing: false, loading: false, error: null, href: null });
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
}

export function getAudioTime(): { current: number; duration: number } {
  return { current: audio?.currentTime ?? 0, duration: audio && isFinite(audio.duration) ? audio.duration : 0 };
}

// ─── Media Session (màn hình khoá / tai nghe) ──────────────────────────────

let handlersBound = false;
function syncMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const seg = state.segments[state.index];
  if (seg && state.docId) {
    ms.metadata = new MediaMetadata({
      title: seg.speaker ? `${seg.speaker} · ${seg.title}` : seg.title,
      artist: state.docTitle,
      album: `Đoạn ${state.index + 1}/${state.segments.length}`,
      artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    });
  }
  ms.playbackState = state.playing ? "playing" : "paused";
  if (handlersBound) return;
  handlersBound = true;
  const set = (a: MediaSessionAction, h: MediaSessionActionHandler) => { try { ms.setActionHandler(a, h); } catch { /* unsupported */ } };
  set("play", () => { getAudio().play().catch(() => {}); });
  set("pause", () => { getAudio().pause(); });
  set("previoustrack", () => skipSegment(-1));
  set("nexttrack", () => skipSegment(1));
  set("seekbackward", (d) => seekBy(-(d.seekOffset ?? 15)));
  set("seekforward", (d) => seekBy(d.seekOffset ?? 15));
}

function updatePositionState() {
  if (!audio || !("mediaSession" in navigator) || !isFinite(audio.duration)) return;
  try {
    navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate });
  } catch { /* */ }
}
