"use client";

// Tab Kiểm tra — LỊCH SỬ quiz tổ chức theo lộ trình (module → tiểu mục).
// Chỉ hiện tiểu mục ĐÃ có lần làm (hoặc vừa được điều phối tới từ checklist).
// Quiz sinh on-demand: lần đầu làm mới gọi AI tạo đề (mock "đang tạo"), sau đó cache.
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, History, Loader2, Play, Quote, RotateCcw, Sparkles, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ATTEMPT_DETAILS, QUIZ_QUESTIONS, QUIZ_SECTIONS, UNIT_TITLES, firstUnitKey, moduleKeyOf,
  type AttemptDetail, type QuizQuestion, type QuizSection,
} from "./mock";

type View =
  | { kind: "list" }
  | { kind: "generating"; section: QuizSection }
  | { kind: "run"; section: QuizSection }
  | { kind: "review"; section: QuizSection; detail: AttemptDetail };

export function QuizTab({ focusSectionId }: { focusSectionId?: string | null }) {
  const [view, setView] = useState<View>({ kind: "list" });

  // Lần đầu làm quiz của tiểu mục → AI tạo đề on-demand (1 call, sau đó cache) — mock 2s
  useEffect(() => {
    if (view.kind !== "generating") return;
    const t = setTimeout(() => setView({ kind: "run", section: view.section }), 2000);
    return () => clearTimeout(t);
  }, [view]);

  if (view.kind === "generating") {
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-[13.5px] font-medium">AI đang tạo đề cho {view.section.title}…</p>
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
          1 call Gemini trên đúng nội dung tiểu mục này — đề được lưu lại, các lần làm sau không tốn call nữa.
        </p>
      </div>
    );
  }
  if (view.kind === "run") {
    return <QuizRunner section={view.section} onExit={() => setView({ kind: "list" })} />;
  }
  if (view.kind === "review") {
    return (
      <AttemptReview
        section={view.section}
        detail={view.detail}
        onExit={() => setView({ kind: "list" })}
        onRetry={() => setView({ kind: "run", section: view.section })}
      />
    );
  }
  return (
    <SectionList
      focusSectionId={focusSectionId}
      onStart={(s) => setView(s.attempts.length === 0 ? { kind: "generating", section: s } : { kind: "run", section: s })}
      onReview={(s, d) => setView({ kind: "review", section: s, detail: d })}
    />
  );
}

// ─── Danh sách section ────────────────────────────────────────────────────────

function SectionList({
  focusSectionId,
  onStart,
  onReview,
}: {
  focusSectionId?: string | null;
  onStart: (s: QuizSection) => void;
  onReview: (s: QuizSection, d: AttemptDetail) => void;
}) {
  const focusRef = useRef<HTMLDivElement | null>(null);

  // Được điều phối từ checklist → cuộn tới đúng section được highlight
  useEffect(() => {
    if (focusSectionId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusSectionId]);

  function reviewLatest(s: QuizSection) {
    for (let i = s.attempts.length - 1; i >= 0; i--) {
      const detail = ATTEMPT_DETAILS.find((d) => d.sectionId === s.id && d.date === s.attempts[i].date);
      if (detail) { onReview(s, detail); return; }
    }
    toast.info("Prototype — chi tiết demo chỉ có cho lần 05/07 của 2.1.3");
  }

  // Chỉ hiện lịch sử: section đã có lần làm, hoặc vừa được điều phối tới (để làm lần đầu)
  const visible = QUIZ_SECTIONS.filter((s) => s.attempts.length > 0 || s.id === focusSectionId);

  // Nhóm theo module như cây lộ trình ở Tổng quan
  const byModule = new Map<string, QuizSection[]>();
  for (const s of visible) {
    const m = moduleKeyOf(firstUnitKey(s.title));
    byModule.set(m, [...(byModule.get(m) ?? []), s]);
  }

  const renderSection = (s: QuizSection) => {
          const last = s.attempts[s.attempts.length - 1];
          const focused = s.id === focusSectionId;
          return (
            <div
              key={s.id}
              ref={focused ? focusRef : undefined}
              className={`rounded-lg border p-3 transition-shadow ${
                focused ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border/50"
              }`}
            >
              {focused && (
                <p className="mb-1.5 text-[10.5px] font-semibold text-primary">← QUIZ CỦA TIỂU MỤC BẠN VỪA CHỌN</p>
              )}
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{s.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.unitLabel}</p>
                  {s.attempts.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {s.attempts.map((a, i) => (
                        <button
                          key={i}
                          title="Xem lại bài làm này"
                          onClick={() => {
                            const detail = ATTEMPT_DETAILS.find((d) => d.sectionId === s.id && d.date === a.date);
                            if (detail) onReview(s, detail);
                            else toast.info("Prototype — chi tiết demo chỉ có cho lần 05/07 của 2.1.3");
                          }}
                          className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium transition-transform hover:scale-105 ${
                            a.score >= 80
                              ? "bg-emerald-500/10 text-emerald-600"
                              : a.score >= 60
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          <History className="h-2.5 w-2.5" />
                          {a.date} · {a.score}%
                        </button>
                      ))}
                      {s.attempts.length >= 2 && last.score > s.attempts[0].score && (
                        <span className="text-[10.5px] text-emerald-600">↗ tiến bộ</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {s.attempts.length > 0 && (
                    <button
                      onClick={() => reviewLatest(s)}
                      className="flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"
                    >
                      <History className="h-3 w-3" /> Xem lại
                    </button>
                  )}
                  <button
                    onClick={() => onStart(s)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Play className="h-3 w-3" /> {s.attempts.length > 0 ? "Làm lại" : "Bắt đầu"}
                  </button>
                </div>
              </div>
            </div>
          );
  };

  return (
    <div>
      <p className="text-[12.5px] text-muted-foreground">
        Lịch sử kiểm tra theo lộ trình — "Xem lại" mở bài làm cũ kèm nhận xét, "Làm lại" giữ nguyên lịch sử điểm.
      </p>
      <div className="mt-3 space-y-3">
        {[...byModule.entries()].map(([mKey, sections]) => (
          <div key={mKey} className="rounded-xl border bg-card p-3">
            <p className="text-[13px] font-semibold">{UNIT_TITLES[mKey] ?? mKey}</p>
            <div className="mt-2 space-y-2">{sections.map(renderSection)}</div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-5 text-center">
            <p className="text-[13px] text-muted-foreground">Chưa có bài kiểm tra nào.</p>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Tiểu mục chưa làm quiz sẽ không hiện ở đây — bắt đầu từ checklist tiểu mục trong tab Tổng quan (AI tạo đề
        lúc đó, 1 call cho đúng tiểu mục).
      </p>
    </div>
  );
}

// ─── Xem lại một lần làm cũ ───────────────────────────────────────────────────

function AttemptReview({
  section,
  detail,
  onExit,
  onRetry,
}: {
  section: QuizSection;
  detail: AttemptDetail;
  onExit: () => void;
  onRetry: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExit}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Về danh sách"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{section.title}</p>
          <p className="text-[11px] text-muted-foreground">
            Xem lại bài làm {detail.date} · <b className={detail.score >= 80 ? "text-emerald-600" : "text-amber-600"}>{detail.score}%</b>
          </p>
        </div>
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-3 w-3" /> Làm lại bài này
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {QUIZ_QUESTIONS.map((q, i) => (
          <ReviewQuestion key={i} index={i} q={q} answer={detail.answers[i]} />
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Làm lại bài này
        </button>
      </div>
    </div>
  );
}

function ReviewQuestion({ index, q, answer }: { index: number; q: QuizQuestion; answer?: { mcqPick?: number; openText?: string } }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
        CÂU {index + 1} · {q.kind === "mcq" ? "TRẮC NGHIỆM" : "TỰ LUẬN"}
      </span>
      <p className="mt-2.5 text-[14px] font-medium leading-relaxed">{q.q}</p>

      {q.kind === "mcq" ? (
        <div className="mt-3 space-y-2">
          {q.options.map((opt, i) => {
            const picked = answer?.mcqPick === i;
            const isCorrect = i === q.correct;
            if (!picked && !isCorrect) {
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-transparent p-2.5 text-[13px] leading-snug text-muted-foreground/70">
                  <OptionBadge i={i} />
                  <span className="flex-1">{opt}</span>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-[13px] leading-snug ${
                  isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"
                }`}
              >
                <OptionBadge i={i} picked={picked} />
                <span className="flex-1">
                  {opt}
                  {picked && !isCorrect && (
                    <span className="mt-1 block text-[11.5px] font-medium text-red-500">Bạn đã chọn câu này</span>
                  )}
                  {q.explainWrong[i] && (
                    <span className="mt-1 block text-[11.5px] text-muted-foreground">{q.explainWrong[i]}</span>
                  )}
                </span>
                {isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[10.5px] font-semibold text-muted-foreground">CÂU TRẢ LỜI CỦA BẠN</p>
            <p className="mt-1 text-[13px] leading-relaxed">{answer?.openText || "(bỏ trống)"}</p>
          </div>
          <div className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> AI ĐÃ NHẬN XÉT
            </p>
            {q.feedbackGood.map((f, i) => (
              <p key={i} className="flex gap-1.5 text-[12.5px] text-emerald-600">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f}
              </p>
            ))}
            {q.feedbackMissing.map((f, i) => (
              <p key={i} className="flex gap-1.5 text-[12.5px] text-amber-600">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Thiếu: {f}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
        <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-[12px] italic leading-snug text-muted-foreground">
          {q.quote}
          <span className="ml-1 cursor-pointer not-italic text-primary underline-offset-2 hover:underline">
            mở đúng vị trí trong tài liệu →
          </span>
        </p>
      </div>
    </div>
  );
}

function OptionBadge({ i, picked }: { i: number; picked?: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
        picked ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
      }`}
    >
      {String.fromCharCode(65 + i)}
    </span>
  );
}

// ─── Quiz runner ──────────────────────────────────────────────────────────────

type Answer = { mcqPick?: number; openText?: string; submitted: boolean };

function QuizRunner({ section, onExit }: { section: QuizSection; onExit: () => void }) {
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(QUIZ_QUESTIONS.map(() => ({ submitted: false })));
  const [finished, setFinished] = useState(false);

  const q = QUIZ_QUESTIONS[qIdx];
  const a = answers[qIdx];
  const total = QUIZ_QUESTIONS.length;

  function patch(p: Partial<Answer>) {
    setAnswers((prev) => prev.map((x, i) => (i === qIdx ? { ...x, ...p } : x)));
  }

  if (finished) {
    const mcqCorrect = QUIZ_QUESTIONS.filter(
      (qq, i) => qq.kind === "mcq" && answers[i].mcqPick === qq.correct
    ).length;
    const score = Math.round(((mcqCorrect + 1.5) / 5) * 100); // demo: tự luận tính 1.5/2
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-10 text-center">
        <div className={`text-4xl font-bold ${score >= 80 ? "text-emerald-500" : "text-amber-500"}`}>{score}%</div>
        <h2 className="mt-2 text-base font-semibold">{section.title}</h2>
        <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          Trắc nghiệm {mcqCorrect}/3 · Tự luận: AI chấm đủ ý 1.5/2 (demo). Bài làm + nhận xét được lưu vào lịch sử —
          xem lại bất cứ lúc nào từ danh sách.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={onExit} className="rounded-lg border px-3 py-1.5 text-[13px] font-medium hover:bg-muted">
            Về danh sách
          </button>
          <button className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90">
            Tạo flashcard từ câu sai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header runner */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExit}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Thoát quiz"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{section.title}</p>
        <span className="shrink-0 text-[12px] text-muted-foreground">Câu {qIdx + 1}/{total}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((qIdx + 1) / total) * 100}%` }} />
      </div>

      {/* Câu hỏi */}
      <div className="mt-4 rounded-xl border bg-card p-4">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
          {q.kind === "mcq" ? "TRẮC NGHIỆM · VẬN DỤNG" : "TỰ LUẬN NGẮN · AI CHẤM Ý"}
        </span>
        <p className="mt-2.5 text-[14.5px] font-medium leading-relaxed">{q.q}</p>

        {q.kind === "mcq" ? (
          <div className="mt-3 space-y-2">
            {q.options.map((opt, i) => {
              const picked = a.mcqPick === i;
              const showResult = a.submitted;
              const isCorrect = i === q.correct;
              return (
                <button
                  key={i}
                  disabled={a.submitted}
                  onClick={() => patch({ mcqPick: i })}
                  className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-[13px] leading-snug transition-colors ${
                    showResult && isCorrect
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : showResult && picked && !isCorrect
                        ? "border-red-500/50 bg-red-500/10"
                        : picked
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/60"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      picked ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">
                    {opt}
                    {showResult && (isCorrect || picked) && q.explainWrong[i] && (
                      <span className="mt-1 block text-[11.5px] text-muted-foreground">{q.explainWrong[i]}</span>
                    )}
                  </span>
                  {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                  {showResult && picked && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3">
            <textarea
              value={a.openText ?? ""}
              disabled={a.submitted}
              onChange={(e) => patch({ openText: e.target.value })}
              placeholder="Trả lời bằng lời của bạn (2-4 câu)…"
              rows={4}
              className="w-full rounded-lg border bg-background p-2.5 text-[13px] leading-relaxed outline-none transition-colors focus:border-ring disabled:opacity-70"
            />
            {a.submitted && (
              <div className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> AI CHẤM Ý (demo)
                </p>
                {q.feedbackGood.map((f, i) => (
                  <p key={i} className="flex gap-1.5 text-[12.5px] text-emerald-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f}
                  </p>
                ))}
                {q.feedbackMissing.map((f, i) => (
                  <p key={i} className="flex gap-1.5 text-[12.5px] text-amber-600">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Thiếu: {f}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trích đoạn gốc sau khi trả lời */}
        {a.submitted && (
          <div className="mt-3 flex gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-[12px] italic leading-snug text-muted-foreground">
              {q.quote}
              <span className="ml-1 cursor-pointer not-italic text-primary underline-offset-2 hover:underline">
                mở đúng vị trí trong tài liệu →
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Điều hướng */}
      <div className="mt-4 flex justify-end gap-2">
        {!a.submitted ? (
          <button
            disabled={q.kind === "mcq" ? a.mcqPick === undefined : !a.openText?.trim()}
            onClick={() => patch({ submitted: true })}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Trả lời
          </button>
        ) : (
          <button
            onClick={() => (qIdx + 1 >= total ? setFinished(true) : setQIdx(qIdx + 1))}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {qIdx + 1 >= total ? "Xem kết quả" : "Câu tiếp"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
