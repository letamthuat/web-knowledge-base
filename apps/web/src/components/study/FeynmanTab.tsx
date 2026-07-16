"use client";

// Tab Feynman — thu âm giảng lại (mock flow) + nhật ký phiên với rubric 4 mục.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, Keyboard,
  Lightbulb, Loader2, Mic, Quote, Search, Square, X, XCircle,
} from "lucide-react";
import {
  FEYNMAN_SESSIONS, LEAF_UNITS, UNIT_TITLES, firstUnitKey, moduleKeyOf, type FeynmanSession,
} from "./mock";

type RecState = "idle" | "recording" | "processing" | "result";

// Checkpoint mock: phần đọc từ lần ôn trước tới giờ = 2.2.2 (bản thật tính từ study_checkpoints)
const CHECKPOINT_SCOPE = ["2.2.2"];
const MAX_SCOPE = 4; // giảng tự do: tối đa 4 tiểu mục / module một lần

// Phiên liên kết (giảng từ tab Feynman, nhiều mục / cross-module) đánh dấu bằng "↔"
const isCrossSession = (s: FeynmanSession) => s.scopeLabel.includes("↔");

export function FeynmanTab({ focusUnitKey }: { focusUnitKey?: string | null }) {
  const [rec, setRec] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 2 chế độ giảng:
  // - checklist (điều phối từ Tổng quan): khóa đúng 1 tiểu mục bài học yêu cầu
  // - tự do (vào thẳng tab): chọn nhiều tiểu mục / cross-module để giảng LIÊN KẾT kiến thức
  const [freeMode, setFreeMode] = useState(false);
  const checklistMode = !!focusUnitKey && !freeMode;

  const [freeScope, setFreeScope] = useState<string[]>(CHECKPOINT_SCOPE);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    setFreeMode(false);
    setFreeScope(CHECKPOINT_SCOPE);
    setPickerOpen(false);
  }, [focusUnitKey]);

  const scope = checklistMode ? [focusUnitKey!] : freeScope;

  function toggleScope(key: string) {
    setFreeScope((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= MAX_SCOPE ? prev : [...prev, key]
    );
  }

  // Phiên trong nhật ký thuộc tiểu mục được điều phối → highlight + mở sẵn
  const isFocused = (scopeLabel: string) => !!focusUnitKey && scopeLabel.startsWith(focusUnitKey);

  const crossSessions = FEYNMAN_SESSIONS.filter(isCrossSession);

  // Nhóm nhật ký theo module → tiểu mục (chỉ tiểu mục đã có phiên; phiên liên kết tách nhóm riêng)
  function groupSessions(): [string, [string, FeynmanSession[]][]][] {
    const byUnit = new Map<string, FeynmanSession[]>();
    for (const s of FEYNMAN_SESSIONS.filter((x) => !isCrossSession(x))) {
      const key = firstUnitKey(s.scopeLabel);
      byUnit.set(key, [...(byUnit.get(key) ?? []), s]);
    }
    const byModule = new Map<string, [string, FeynmanSession[]][]>();
    for (const key of [...byUnit.keys()].sort()) {
      const m = moduleKeyOf(key);
      byModule.set(m, [...(byModule.get(m) ?? []), [key, byUnit.get(key)!]]);
    }
    return [...byModule.entries()];
  }

  useEffect(() => {
    if (rec === "recording") {
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [rec]);

  // Mock: 2.5s "AI chấm" rồi hiện kết quả (dùng session seed đầu tiên)
  useEffect(() => {
    if (rec !== "processing") return;
    const t = setTimeout(() => setRec("result"), 2500);
    return () => clearTimeout(t);
  }, [rec]);

  function start() { setSeconds(0); setRec("recording"); }
  function stop() { setRec("processing"); }

  return (
    <div className="space-y-5">
      {/* Khối thu âm */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[13.5px] font-semibold">Giảng lại phần vừa đọc</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Nói 1-3 phút như đang dạy người mới. AI đối chiếu với nội dung gốc và chấm theo 4 mục.
        </p>

        {/* Sẽ giảng theo những tiểu mục nào — nhìn thấy rõ */}
        <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-semibold text-muted-foreground">
              {checklistMode
                ? "GIẢNG THEO CHECKLIST — ĐÚNG 1 TIỂU MỤC BÀI HỌC YÊU CẦU"
                : `GIẢNG LIÊN KẾT — ${scope.length} MỤC ĐƯỢC CHỌN (cross-module được)`}
            </p>
            {!checklistMode && (
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="shrink-0 text-[11px] font-medium text-primary hover:underline"
              >
                {pickerOpen ? "xong" : "chỉnh"}
              </button>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scope.map((k) => (
              <span key={k} className="flex max-w-full items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11.5px] font-medium text-primary">
                <span className="truncate">{UNIT_TITLES[k] ?? k}</span>
                {!checklistMode && (
                  <button onClick={() => toggleScope(k)} aria-label="Bỏ mục này" className="shrink-0 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {scope.length === 0 && (
              <span className="text-[11.5px] text-muted-foreground">Chưa chọn — bấm "chỉnh" để chọn tiểu mục</span>
            )}
          </div>

          {checklistMode ? (
            <button
              onClick={() => { setFreeMode(true); setPickerOpen(true); }}
              className="mt-2 text-[11px] text-primary hover:underline"
            >
              Muốn giảng nhiều mục / nối kiến thức xuyên module? Chuyển sang giảng tự do →
            </button>
          ) : (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              Chọn ≥ 2 mục để AI chấm thêm phần <b>kết nối kiến thức</b> giữa các mục — kể cả mục thuộc module khác.
            </p>
          )}

          {!checklistMode && pickerOpen && (
            <ScopePicker
              scope={scope}
              max={MAX_SCOPE}
              onToggle={toggleScope}
              onReset={() => setFreeScope(CHECKPOINT_SCOPE)}
            />
          )}
        </div>

        <div className="mt-4 flex flex-col items-center py-2">
          {rec === "idle" && (
            <>
              <button
                onClick={start}
                disabled={scope.length === 0}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                aria-label="Bắt đầu thu âm"
              >
                <Mic className="h-7 w-7" />
              </button>
              <p className="mt-2.5 text-[12px] text-muted-foreground">
                {scope.length > 0 ? `Chạm để bắt đầu giảng ${scope.join(" + ")}` : "Chọn tiểu mục trước rồi mới giảng"}
              </p>
              <button className="mt-1 flex items-center gap-1 text-[11.5px] text-primary hover:underline">
                <Keyboard className="h-3 w-3" /> hoặc gõ thay vì nói
              </button>
            </>
          )}

          {rec === "recording" && (
            <>
              <button
                onClick={stop}
                className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
                aria-label="Dừng thu âm"
              >
                <Square className="h-6 w-6 fill-current" />
              </button>
              <p className="mt-2.5 font-mono text-[15px] font-semibold text-red-500">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </p>
              <p className="text-[11.5px] text-muted-foreground">Đang nghe… chạm ⏹ khi giảng xong</p>
            </>
          )}

          {rec === "processing" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
              <p className="mt-2.5 text-[12px] text-muted-foreground">
                AI đang nghe lại và đối chiếu với tài liệu… (1 call Gemini gộp)
              </p>
            </>
          )}

          {rec === "result" && (
            <div className="w-full">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Đã chấm xong — kết quả demo bên dưới
              </div>
              <div className="mt-2">
                <RubricCard session={{ ...FEYNMAN_SESSIONS[0], scopeLabel: `${scope.join(" + ")} (vừa giảng)` }} defaultOpen />
              </div>
              <button
                onClick={() => setRec("idle")}
                className="mt-3 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium hover:bg-muted"
              >
                Giảng lại lần nữa
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Nhật ký phiên — LỊCH SỬ theo lộ trình (module → tiểu mục), chỉ tiểu mục đã giảng */}
      <section>
        <h2 className="text-[13px] font-semibold text-muted-foreground">NHẬT KÝ HIỂU BÀI ({FEYNMAN_SESSIONS.length})</h2>
        <div className="mt-2 space-y-3">
          {/* Phiên liên kết — giảng nối nhiều mục / cross-module */}
          {crossSessions.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[13px] font-semibold">🔗 Phiên liên kết — nối kiến thức xuyên mục ({crossSessions.length})</p>
              <div className="mt-2 space-y-1.5">
                {crossSessions.map((s) => (
                  <RubricCard key={s.id} session={s} onRetry={start} />
                ))}
              </div>
            </div>
          )}
          {groupSessions().map(([mKey, units]) => (
            <div key={mKey} className="rounded-xl border bg-card p-3">
              <p className="text-[13px] font-semibold">{UNIT_TITLES[mKey] ?? mKey}</p>
              <div className="mt-2 space-y-2.5">
                {units.map(([uKey, sessions]) => (
                  <div key={uKey}>
                    <p className={`mb-1 truncate text-[11.5px] font-medium ${uKey === focusUnitKey ? "text-primary" : "text-muted-foreground"}`}>
                      {UNIT_TITLES[uKey] ?? uKey} · {sessions.length} phiên
                      {uKey === focusUnitKey && " ← tiểu mục bạn vừa chọn"}
                    </p>
                    <div className="space-y-1.5">
                      {sessions.map((s) => (
                        <RubricCard
                          key={s.id}
                          session={s}
                          onRetry={start}
                          defaultOpen={isFocused(s.scopeLabel)}
                          highlighted={isFocused(s.scopeLabel)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {focusUnitKey && !FEYNMAN_SESSIONS.some((s) => isFocused(s.scopeLabel)) && (
            <div className="rounded-xl border border-dashed bg-card p-4 text-center">
              <p className="text-[12.5px] text-muted-foreground">
                Tiểu mục {focusUnitKey} chưa có phiên giảng nào — bấm 🎤 phía trên để giảng lần đầu.
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Tiểu mục chưa giảng lần nào sẽ không hiện ở đây — bắt đầu từ checklist tiểu mục trong tab Tổng quan.
        </p>
      </section>
    </div>
  );
}

// ─── Picker chọn tiểu mục (giảng tự do) ──────────────────────────────────────
// Nhóm theo module + ô lọc tên + chấm trạng thái học + đếm X/4 — thay flat list
// khó quét khi handbook thật có 29+ tiểu mục đã đọc.

const PICKER_DOT: Record<string, string> = {
  new: "bg-muted-foreground/30",
  reading: "bg-blue-500",
  read: "bg-amber-500",
  mastered: "bg-emerald-500",
  decayed: "bg-red-500",
};

function ScopePicker({ scope, max, onToggle, onReset }: {
  scope: string[]; max: number; onToggle: (k: string) => void; onReset: () => void;
}) {
  const [q, setQ] = useState("");
  const full = scope.length >= max;

  // Nhóm tiểu mục đã đọc theo module; mục cấp module (M1…) đứng một mình không cần heading
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const visible = LEAF_UNITS.filter(
      (u) => u.readPct > 0 && (!ql || u.title.toLowerCase().includes(ql) || u.key.includes(ql))
    );
    const map = new Map<string, typeof visible>();
    for (const u of visible) {
      const m = /^M\d+$/.test(u.key) ? u.key : moduleKeyOf(u.key);
      map.set(m, [...(map.get(m) ?? []), u]);
    }
    return [...map.entries()];
  }, [q]);

  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc theo tên hoặc số mục (vd 2.2)…"
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <span className={`shrink-0 text-[11px] font-bold tabular-nums ${full ? "text-amber-600" : "text-muted-foreground"}`}>
          {scope.length}/{max}
        </span>
        <button onClick={onReset} className="shrink-0 text-[11px] font-medium text-primary hover:underline">
          ↺ phần vừa đọc
        </button>
      </div>
      {full && (
        <p className="mt-1 text-[10.5px] text-amber-600">
          Đã đủ {max} mục — bấm × trên thẻ đã chọn để đổi mục khác.
        </p>
      )}

      <div className="mt-1.5 max-h-64 space-y-2 overflow-y-auto pr-1">
        {groups.map(([mKey, units]) => {
          const standaloneModule = units.length === 1 && units[0].key === mKey;
          return (
            <div key={mKey}>
              {!standaloneModule && (
                <p className="py-0.5 text-[10.5px] font-semibold text-muted-foreground">{UNIT_TITLES[mKey] ?? mKey}</p>
              )}
              {units.map((u) => {
                const checked = scope.includes(u.key);
                const disabled = !checked && full;
                return (
                  <button
                    key={u.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(u.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] transition-colors ${
                      checked ? "bg-primary/10" : "hover:bg-background"
                    } ${disabled ? "opacity-40" : ""}`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                    >
                      {checked && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PICKER_DOT[u.status]}`} />
                    <span className="min-w-0 flex-1 truncate">{u.title}</span>
                    {u.readPct < 100 && <span className="shrink-0 text-[10px] text-blue-500">đọc {u.readPct}%</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="py-3 text-center text-[11.5px] text-muted-foreground">
            Không có tiểu mục đã đọc nào khớp &quot;{q}&quot;
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Card rubric 4 mục ───────────────────────────────────────────────────────

function RubricCard({
  session,
  defaultOpen = false,
  highlighted = false,
  onRetry,
}: {
  session: FeynmanSession;
  defaultOpen?: boolean;
  highlighted?: boolean;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const r = session.rubric;
  return (
    <div className={`rounded-xl border bg-card ${highlighted ? "border-primary ring-2 ring-primary/30 shadow-md" : ""}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 p-3 text-left">
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Mic className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{session.scopeLabel}</p>
          <p className="text-[10.5px] text-muted-foreground">
            {session.date} · nói {Math.floor(session.durationSec / 60)}p{session.durationSec % 60}s
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
            ✓ {r.correct.length}
          </span>
          {r.missing.length > 0 && (
            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
              sót {r.missing.length}
            </span>
          )}
          {r.wrong.length > 0 && (
            <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
              sai {r.wrong.length}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t p-3.5">
          {/* Transcript trích */}
          <div className="flex gap-2 rounded-lg bg-muted/60 p-2.5">
            <Quote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[12px] italic leading-snug text-muted-foreground">{session.excerpt}</p>
          </div>

          {/* 1. Đúng */}
          <RubricGroup icon={CheckCircle2} cls="text-emerald-600" title="Nắm đúng" items={r.correct} />
          {/* 2. Sót */}
          {r.missing.length > 0 && (
            <RubricGroup icon={AlertCircle} cls="text-amber-600" title="Bỏ sót" items={r.missing} />
          )}
          {/* 3. Sai */}
          {r.wrong.length > 0 && (
            <RubricGroup icon={XCircle} cls="text-red-500" title="Hiểu chưa đúng" items={r.wrong} />
          )}

          {/* 4. Chiều sâu */}
          <div>
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary" /> CHIỀU SÂU
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  r.hasExample ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                }`}
              >
                {r.hasExample ? "✓ Có ví dụ của riêng bạn" : "✗ Chưa có ví dụ riêng"}
              </span>
              <span
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  r.hasEdgeCase ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                }`}
              >
                {r.hasEdgeCase ? "✓ Có nêu giới hạn/edge case" : "✗ Chưa nêu giới hạn/edge case"}
              </span>
            </div>
            <div className="mt-2 flex gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[12px] leading-snug">
                <b>Câu hỏi đào tiếp:</b> {r.followUp}
              </p>
            </div>
          </div>

          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"
            >
              <Mic className="h-3.5 w-3.5" /> Giảng lại tiểu mục này
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RubricGroup({
  icon: Icon, cls, title, items,
}: { icon: typeof CheckCircle2; cls: string; title: string; items: string[] }) {
  return (
    <div>
      <p className={`flex items-center gap-1.5 text-[11.5px] font-semibold ${cls}`}>
        <Icon className="h-3.5 w-3.5" /> {title.toUpperCase()}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="pl-5 text-[12.5px] leading-snug text-foreground/90">• {it}</li>
        ))}
      </ul>
    </div>
  );
}
