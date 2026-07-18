"use client";

// Tab Feynman — THU ÂM THẬT (MediaRecorder) → 1 call Gemini nghe + đối chiếu tài liệu →
// rubric 4 mục, lưu feynman_sessions. 2 chế độ: checklist (khóa 1 tiểu mục) / tự do (nối ≤4 mục).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, Keyboard, Lightbulb, Link2, Loader2, Mic, Quote, Search, Square, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { StudySpace, StudyUnit, UnitStatus } from "./mock";
import { StudyMarkdown } from "./StudyMarkdown";
import { useAiSettings } from "@/lib/api/ai-settings";
import {
  useFeynmanSessions, useStudyCheckpoint, recordFeynmanSession, logStudySession,
  type FeynmanSessionRow, type FeynmanRubric,
} from "@/lib/api/study";
import { getUnitScopeText } from "@/lib/study/materialize";
import { requestFeynmanGrade } from "@/lib/study/generate";

type RecState = "idle" | "recording" | "processing" | "result";
const MAX_SCOPE = 4;

type Leaf = { key: string; title: string; docId: string | null; readPct: number; status: UnitStatus; isStation?: boolean };
function unitKeyOfId(id: string): string {
  return /^m\d+$/.test(id) ? "M" + id.slice(1) : id.slice(1).split("-").join(".");
}
// leaves = tiểu mục + mục x.y (giảng cả mục — trạm tổng kết). isStation không hiện trong picker.
function flatten(units: StudyUnit[]): { leaves: Leaf[]; titleByKey: Map<string, string> } {
  const leaves: Leaf[] = [];
  const titleByKey = new Map<string, string>();
  const walk = (u: StudyUnit) => {
    const key = unitKeyOfId(u.id);
    titleByKey.set(key, u.title);
    if (u.children && u.children.length) {
      if (u.children.every((c) => !c.children)) leaves.push({ key, title: u.title, docId: u.docId ?? null, readPct: u.readPct, status: u.status, isStation: true });
      u.children.forEach(walk);
    } else {
      leaves.push({ key, title: u.title, docId: u.docId ?? null, readPct: u.readPct, status: u.status });
    }
  };
  units.forEach(walk);
  return { leaves, titleByKey };
}
function moduleKeyOf(k: string): string { return "M" + k.split(".")[0]; }
function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function FeynmanTab({ spaceId, space, focusUnitKey }: { spaceId: string; space: StudySpace; focusUnitKey?: string | null }) {
  const ai = useAiSettings();
  const sessions = useFeynmanSessions(spaceId);
  const checkpoint = useStudyCheckpoint(spaceId);
  const { leaves, titleByKey } = useMemo(() => flatten(space.units), [space.units]);
  const readLeaves = useMemo(() => leaves.filter((l) => l.readPct > 0 && !l.isStation), [leaves]);
  const leafByKey = useMemo(() => new Map(leaves.map((l) => [l.key, l])), [leaves]);

  const [rec, setRec] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [freeMode, setFreeMode] = useState(false);
  const [freeScope, setFreeScope] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [resultRubric, setResultRubric] = useState<{ rubric: FeynmanRubric; scopeKeys: string[]; durationSec: number } | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);

  const checklistMode = !!focusUnitKey && !freeMode;
  const scope = checklistMode ? [focusUnitKey!] : freeScope;

  // Scope mặc định (tự do) = checkpoint (chỗ đọc gần nhất) hoặc leaf đã đọc cuối cùng
  const defaultScope = useMemo<string[]>(() => {
    if (checkpoint?.lastReadUnitKey && leafByKey.has(checkpoint.lastReadUnitKey)) return [checkpoint.lastReadUnitKey];
    const last = readLeaves[readLeaves.length - 1];
    return last ? [last.key] : [];
  }, [checkpoint, readLeaves, leafByKey]);

  useEffect(() => {
    setFreeMode(false);
    setFreeScope(defaultScope);
    setPickerOpen(false);
    setRec("idle");
    setResultRubric(null);
    setTyping(false);
    setTypedText("");
  }, [focusUnitKey, defaultScope]);

  useEffect(() => {
    if (rec === "recording") timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    else if (timer.current) { clearInterval(timer.current); timer.current = null; }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [rec]);

  function toggleScope(key: string) {
    setFreeScope((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= MAX_SCOPE ? prev : [...prev, key]));
  }

  async function start() {
    if (scope.length === 0) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        void handleAudio(blob, mr.mimeType || "audio/webm");
      };
      mr.start();
      mediaRef.current = mr;
      startTsRef.current = Date.now();
      setSeconds(0);
      setRec("recording");
    } catch {
      toast.error("Không truy cập được micro — kiểm tra quyền trình duyệt");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    setRec("processing");
  }

  async function gradeAndSave(input: { audioBase64?: string; mimeType?: string; transcriptText?: string }, durationSec: number) {
    const scopeKeys = [...scope];
    try {
      const scopeText = (
        await Promise.all(scopeKeys.map((k) => { const l = leafByKey.get(k); return l?.docId ? getUnitScopeText(l.docId, k) : Promise.resolve(""); }))
      ).filter(Boolean).join("\n\n---\n\n");
      if (!scopeText) throw new Error("Không lấy được nội dung gốc để đối chiếu");
      const isLinked = scopeKeys.length >= 2;
      const unitLabels = scopeKeys.map((k) => titleByKey.get(k) ?? k).join(" ↔ ");
      const { rubric, transcript } = await requestFeynmanGrade({
        ...input, scopeText, unitLabels, isLinked, geminiApiKey: ai?.geminiApiKey, geminiModels: ai?.geminiModels,
      });
      await recordFeynmanSession({ spaceId, scopeKeys, isLinked, durationSec, transcript, rubric });
      await logStudySession({ spaceId, activityType: "feynman", unitKey: scopeKeys[0], activeMinutes: Math.max(1, Math.round(durationSec / 60)) });
      setResultRubric({ rubric, scopeKeys, durationSec });
      setRec("result");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chấm Feynman thất bại");
      setRec("idle");
    }
  }

  async function handleAudio(blob: Blob, mimeType: string) {
    const durationSec = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000));
    const audioBase64 = await blobToBase64(blob);
    if (!audioBase64) { toast.error("Ghi âm rỗng"); setRec("idle"); return; }
    await gradeAndSave({ audioBase64, mimeType }, durationSec);
  }

  async function submitTyped() {
    if (scope.length === 0) return;
    const text = typedText.trim();
    if (text.length < 10) { toast.error("Viết dài hơn chút để AI chấm được"); return; }
    setRec("processing");
    await gradeAndSave({ transcriptText: text }, Math.max(1, Math.round(text.split(/\s+/).length / 2)));
  }

  const scopeLabelOf = (keys: string[], linked: boolean) => keys.map((k) => titleByKey.get(k) ?? k).join(linked ? " ↔ " : " + ");

  // Nhật ký từ DB
  const rows = sessions ?? [];
  const crossSessions = rows.filter((s) => s.isLinked);
  const soloSessions = rows.filter((s) => !s.isLinked);
  const byUnit = new Map<string, FeynmanSessionRow[]>();
  for (const s of soloSessions) { const k = s.scopeKeys[0] ?? "?"; byUnit.set(k, [...(byUnit.get(k) ?? []), s]); }
  const byModule = new Map<string, [string, FeynmanSessionRow[]][]>();
  for (const k of [...byUnit.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const m = moduleKeyOf(k);
    byModule.set(m, [...(byModule.get(m) ?? []), [k, byUnit.get(k)!]]);
  }
  const focusHasSession = focusUnitKey ? byUnit.has(focusUnitKey) : true;

  return (
    <div className="space-y-5">
      {/* Khối thu âm */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[13.5px] font-semibold">Giảng lại phần vừa đọc</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">Nói 1-3 phút như đang dạy người mới. AI đối chiếu nội dung gốc và chấm theo 4 mục.</p>

        <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-semibold text-muted-foreground">
              {checklistMode ? "GIẢNG THEO CHECKLIST — ĐÚNG 1 TIỂU MỤC" : `GIẢNG LIÊN KẾT — ${scope.length} MỤC (cross-module được)`}
            </p>
            {!checklistMode && rec === "idle" && (
              <button onClick={() => setPickerOpen(!pickerOpen)} className="shrink-0 text-[11px] font-medium text-primary hover:underline">
                {pickerOpen ? "xong" : "chỉnh"}
              </button>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scope.map((k) => (
              <span key={k} className="flex max-w-full items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11.5px] font-medium text-primary">
                <span className="truncate">{titleByKey.get(k) ?? k}</span>
                {!checklistMode && rec === "idle" && (
                  <button onClick={() => toggleScope(k)} aria-label="Bỏ mục này" className="shrink-0 hover:text-red-500"><X className="h-3 w-3" /></button>
                )}
              </span>
            ))}
            {scope.length === 0 && <span className="text-[11.5px] text-muted-foreground">Chưa chọn — bấm “chỉnh” để chọn tiểu mục đã đọc</span>}
          </div>

          {rec === "idle" && (checklistMode ? (
            <button onClick={() => { setFreeMode(true); setPickerOpen(true); }} className="mt-2 text-[11px] text-primary hover:underline">
              Muốn giảng nhiều mục / nối kiến thức xuyên module? Chuyển sang giảng tự do →
            </button>
          ) : (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">Chọn ≥ 2 mục để AI chấm thêm phần <b>kết nối kiến thức</b> — kể cả mục thuộc module khác.</p>
          ))}

          {!checklistMode && pickerOpen && rec === "idle" && (
            <ScopePicker units={readLeaves} titleByKey={titleByKey} scope={scope} max={MAX_SCOPE} onToggle={toggleScope} onReset={() => setFreeScope(defaultScope)} />
          )}
        </div>

        <div className="mt-4 flex flex-col items-center py-2">
          {rec === "idle" && !typing && (
            <>
              <button onClick={start} disabled={scope.length === 0}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                aria-label="Bắt đầu thu âm">
                <Mic className="h-7 w-7" />
              </button>
              <p className="mt-2.5 text-[12px] text-muted-foreground">
                {scope.length > 0 ? "Chạm để bắt đầu giảng" : "Chọn tiểu mục đã đọc trước rồi mới giảng"}
              </p>
              {scope.length > 0 && (
                <button onClick={() => setTyping(true)} className="mt-1.5 flex items-center gap-1 text-[11.5px] text-primary hover:underline">
                  <Keyboard className="h-3 w-3" /> hoặc gõ thay vì nói
                </button>
              )}
            </>
          )}
          {rec === "idle" && typing && (
            <div className="w-full">
              <textarea
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                rows={6}
                placeholder="Gõ lại phần bạn hiểu, như đang giảng cho người mới… AI sẽ đối chiếu với tài liệu và chấm."
                className="w-full rounded-lg border bg-background p-3 text-[13px] leading-relaxed outline-none focus:border-primary"
                autoFocus
              />
              <div className="mt-2 flex items-center justify-between">
                <button onClick={() => { setTyping(false); setTypedText(""); }} className="text-[12px] text-muted-foreground hover:text-foreground">← Quay lại thu âm</button>
                <button onClick={submitTyped} disabled={typedText.trim().length < 10} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">Chấm bài gõ</button>
              </div>
            </div>
          )}
          {rec === "recording" && (
            <>
              <button onClick={stop} className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-red-500 text-white shadow-lg" aria-label="Dừng thu âm">
                <Square className="h-6 w-6 fill-current" />
              </button>
              <p className="mt-2.5 font-mono text-[15px] font-semibold text-red-500">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>
              <p className="text-[11.5px] text-muted-foreground">Đang thu… chạm ⏹ khi giảng xong</p>
            </>
          )}
          {rec === "processing" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              <p className="mt-2.5 text-[12px] text-muted-foreground">AI đang nghe lại và đối chiếu với tài liệu… (1 call Gemini gộp)</p>
            </>
          )}
          {rec === "result" && resultRubric && (
            <div className="w-full">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Đã chấm xong</div>
              <div className="mt-2">
                <RubricCard
                  scopeLabel={`${scopeLabelOf(resultRubric.scopeKeys, resultRubric.scopeKeys.length >= 2)} (vừa giảng)`}
                  dateMs={Date.now()} durationSec={resultRubric.durationSec} rubric={resultRubric.rubric} transcript="" defaultOpen
                />
              </div>
              <button onClick={() => { setRec("idle"); setResultRubric(null); }} className="mt-3 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium hover:bg-muted">Giảng lại lần nữa</button>
            </div>
          )}
        </div>
      </section>

      {/* Nhật ký phiên */}
      <section>
        <h2 className="text-[13px] font-semibold text-muted-foreground">NHẬT KÝ HIỂU BÀI ({rows.length})</h2>
        {sessions === undefined ? (
          <p className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải…</p>
        ) : (
          <div className="mt-2 space-y-3">
            {crossSessions.length > 0 && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[13px] font-semibold">🔗 Phiên liên kết — nối kiến thức xuyên mục ({crossSessions.length})</p>
                <div className="mt-2 space-y-1.5">
                  {crossSessions.map((s) => (
                    <RubricCard key={s._id} scopeLabel={scopeLabelOf(s.scopeKeys, true)} dateMs={s.attemptedAt} durationSec={s.durationSec} rubric={s.rubric} transcript={s.transcript ?? ""} />
                  ))}
                </div>
              </div>
            )}
            {[...byModule.entries()].map(([mKey, units]) => (
              <div key={mKey} className="rounded-xl border bg-card p-3">
                <p className="text-[13px] font-semibold">{titleByKey.get(mKey) ?? mKey}</p>
                <div className="mt-2 space-y-2.5">
                  {units.map(([uKey, ss]) => (
                    <div key={uKey}>
                      <p className={`mb-1 truncate text-[11.5px] font-medium ${uKey === focusUnitKey ? "text-primary" : "text-muted-foreground"}`}>
                        {titleByKey.get(uKey) ?? uKey} · {ss.length} phiên{uKey === focusUnitKey && " ← tiểu mục bạn vừa chọn"}
                      </p>
                      <div className="space-y-1.5">
                        {ss.map((s) => (
                          <RubricCard key={s._id} scopeLabel={scopeLabelOf(s.scopeKeys, false)} dateMs={s.attemptedAt} durationSec={s.durationSec} rubric={s.rubric} transcript={s.transcript ?? ""} defaultOpen={uKey === focusUnitKey} highlighted={uKey === focusUnitKey} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {focusUnitKey && !focusHasSession && (
              <div className="rounded-xl border border-dashed bg-card p-4 text-center">
                <p className="text-[12.5px] text-muted-foreground">Tiểu mục {focusUnitKey} chưa có phiên giảng nào — bấm 🎤 phía trên để giảng lần đầu.</p>
              </div>
            )}
            {rows.length === 0 && !focusUnitKey && (
              <div className="rounded-xl border border-dashed bg-card p-5 text-center">
                <p className="text-[13px] text-muted-foreground">Chưa có phiên giảng nào. Chọn tiểu mục đã đọc rồi bấm 🎤.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Picker chọn tiểu mục (giảng tự do) ──────────────────────────────────────
const PICKER_DOT: Record<UnitStatus, string> = {
  new: "bg-muted-foreground/30", reading: "bg-blue-500", read: "bg-amber-500", mastered: "bg-emerald-500", decayed: "bg-red-500",
};

function ScopePicker({ units, titleByKey, scope, max, onToggle, onReset }: {
  units: Leaf[]; titleByKey: Map<string, string>; scope: string[]; max: number; onToggle: (k: string) => void; onReset: () => void;
}) {
  const [q, setQ] = useState("");
  const full = scope.length >= max;
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const visible = units.filter((u) => !ql || u.title.toLowerCase().includes(ql) || u.key.includes(ql));
    const map = new Map<string, Leaf[]>();
    for (const u of visible) { const m = moduleKeyOf(u.key); map.set(m, [...(map.get(m) ?? []), u]); }
    return [...map.entries()];
  }, [q, units]);

  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc theo tên hoặc số mục (vd 2.2)…" className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground" />
        </div>
        <span className={`shrink-0 text-[11px] font-bold tabular-nums ${full ? "text-amber-600" : "text-muted-foreground"}`}>{scope.length}/{max}</span>
        <button onClick={onReset} className="shrink-0 text-[11px] font-medium text-primary hover:underline">↺ mặc định</button>
      </div>
      {full && <p className="mt-1 text-[10.5px] text-amber-600">Đã đủ {max} mục — bỏ bớt để đổi mục khác.</p>}
      <div className="mt-1.5 max-h-64 space-y-2 overflow-y-auto pr-1">
        {groups.map(([mKey, us]) => (
          <div key={mKey}>
            <p className="py-0.5 text-[10.5px] font-semibold text-muted-foreground">{titleByKey.get(mKey) ?? mKey}</p>
            {us.map((u) => {
              const checked = scope.includes(u.key);
              const disabled = !checked && full;
              return (
                <button key={u.key} type="button" disabled={disabled} onClick={() => onToggle(u.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] transition-colors ${checked ? "bg-primary/10" : "hover:bg-background"} ${disabled ? "opacity-40" : ""}`}>
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {checked && <CheckCircle2 className="h-3 w-3" />}
                  </span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${PICKER_DOT[u.status]}`} />
                  <span className="min-w-0 flex-1 truncate">{u.title}</span>
                  {u.readPct < 100 && <span className="shrink-0 text-[10px] text-blue-500">đọc {u.readPct}%</span>}
                </button>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <p className="py-3 text-center text-[11.5px] text-muted-foreground">Không có tiểu mục đã đọc nào khớp “{q}”</p>}
      </div>
    </div>
  );
}

// ─── Card rubric ─────────────────────────────────────────────────────────────
function RubricCard({
  scopeLabel, dateMs, durationSec, rubric, transcript, defaultOpen = false, highlighted = false,
}: {
  scopeLabel: string; dateMs: number; durationSec: number; rubric: FeynmanRubric; transcript: string; defaultOpen?: boolean; highlighted?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border bg-card ${highlighted ? "border-primary shadow-md ring-2 ring-primary/30" : ""}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 p-3 text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Mic className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{scopeLabel}</p>
          <p className="text-[10.5px] text-muted-foreground">{fmtDate(dateMs)} · nói {Math.floor(durationSec / 60)}p{durationSec % 60}s</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">✓ {rubric.correct.length}</span>
          {rubric.missing.length > 0 && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">sót {rubric.missing.length}</span>}
          {rubric.wrong.length > 0 && <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">sai {rubric.wrong.length}</span>}
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t p-3.5">
          {transcript && (
            <div className="flex gap-2 rounded-lg bg-muted/60 p-2.5">
              <Quote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <StudyMarkdown className="text-[12px] italic leading-snug text-muted-foreground">{transcript.length > 400 ? transcript.slice(0, 400) + "…" : transcript}</StudyMarkdown>
            </div>
          )}
          <RubricGroup icon={CheckCircle2} cls="text-emerald-600" title="Nắm đúng" items={rubric.correct} />
          {rubric.missing.length > 0 && <RubricGroup icon={AlertCircle} cls="text-amber-600" title="Bỏ sót" items={rubric.missing} />}
          {rubric.wrong.length > 0 && <RubricGroup icon={XCircle} cls="text-red-500" title="Hiểu chưa đúng" items={rubric.wrong} />}
          {rubric.connection && (
            <div className="flex gap-2 rounded-lg border border-teal-500/25 bg-teal-500/5 p-2.5">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
              <div><p className="text-[11px] font-semibold text-teal-600">KẾT NỐI KIẾN THỨC</p><StudyMarkdown className="mt-0.5 text-[12.5px] leading-snug">{rubric.connection}</StudyMarkdown></div>
            </div>
          )}
          <div>
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground"><Lightbulb className="h-3.5 w-3.5 text-primary" /> CHIỀU SÂU</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${rubric.hasExample ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{rubric.hasExample ? "✓ Có ví dụ của riêng bạn" : "✗ Chưa có ví dụ riêng"}</span>
              <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${rubric.hasEdgeCase ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{rubric.hasEdgeCase ? "✓ Có nêu giới hạn/edge case" : "✗ Chưa nêu giới hạn/edge case"}</span>
            </div>
            {rubric.followUp && (
              <div className="mt-2 flex gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
                <HelpCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="text-[12px] leading-snug"><b>Câu hỏi đào tiếp:</b> <StudyMarkdown className="mt-0.5">{rubric.followUp}</StudyMarkdown></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RubricGroup({ icon: Icon, cls, title, items }: { icon: typeof CheckCircle2; cls: string; title: string; items: string[] }) {
  return (
    <div>
      <p className={`flex items-center gap-1.5 text-[11.5px] font-semibold ${cls}`}><Icon className="h-3.5 w-3.5" /> {title.toUpperCase()}</p>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => <li key={i} className="flex gap-1.5 pl-3 text-[12.5px] leading-snug text-foreground/90"><span className="text-muted-foreground">•</span><StudyMarkdown className="flex-1">{it}</StudyMarkdown></li>)}
      </ul>
    </div>
  );
}
