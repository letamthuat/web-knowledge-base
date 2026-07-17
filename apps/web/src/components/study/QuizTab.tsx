"use client";

// Tab Kiểm tra — quiz THẬT: đề sinh AI on-demand (cache section_questions), chấm MCQ
// deterministic + tự luận AI, lưu quiz_attempts (append-only). Lịch sử theo lộ trình.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, History, Loader2, Play, Quote, RotateCcw, Sparkles, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { StudySpace, StudyUnit } from "./mock";
import { StudyMarkdown } from "./StudyMarkdown";
import { useOpenDoc } from "./SpaceOverview";
import { useAiSettings } from "@/lib/api/ai-settings";
import {
  useQuizAttempts, getSectionQuestions, saveSectionQuestions, recordQuizAttempt, logStudySession,
  type QuizAttemptRow, type QuizQuestion, type AttemptAnswer,
} from "@/lib/api/study";
import { getUnitScopeText } from "@/lib/study/materialize";
import { requestGeneratedQuiz, requestEssayGrades, type EssayGrade } from "@/lib/study/generate";

type Leaf = { unitKey: string; moduleKey: string; title: string; docId: string | null; anchor: string | null };
function unitKeyOfId(id: string): string {
  return /^m\d+$/.test(id) ? "M" + id.slice(1) : id.slice(1).split("-").join(".");
}
function flatten(units: StudyUnit[]): { leaves: Leaf[]; titleByKey: Map<string, string> } {
  const leaves: Leaf[] = [];
  const titleByKey = new Map<string, string>();
  const walk = (u: StudyUnit) => {
    const key = unitKeyOfId(u.id);
    titleByKey.set(key, u.title);
    if (u.children && u.children.length) u.children.forEach(walk);
    else leaves.push({ unitKey: key, moduleKey: "M" + key.split(".")[0], title: u.title, docId: u.docId ?? null, anchor: u.headingAnchor ?? null });
  };
  units.forEach(walk);
  return { leaves, titleByKey };
}

// Nút "mở tài liệu →" cạnh trích đoạn
function OpenDocLink({ leaf }: { leaf: Leaf }) {
  const openDoc = useOpenDoc();
  if (!leaf.docId) return null;
  return (
    <button onClick={() => openDoc(leaf.docId!, leaf.anchor)} className="mt-1 block text-[11px] font-medium text-primary hover:underline">
      mở tài liệu →
    </button>
  );
}
function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type View =
  | { kind: "list" }
  | { kind: "working"; label: string }
  | { kind: "run"; leaf: Leaf; questions: QuizQuestion[] }
  | { kind: "review"; leaf: Leaf; attempt: QuizAttemptRow; questions: QuizQuestion[] };

export function QuizTab({ spaceId, space, focusSectionId }: { spaceId: string; space: StudySpace; focusSectionId?: string | null }) {
  const attempts = useQuizAttempts(spaceId);
  const ai = useAiSettings();
  const [view, setView] = useState<View>({ kind: "list" });
  const { leaves, titleByKey } = useMemo(() => flatten(space.units), [space.units]);
  const focusUnitKey = focusSectionId ? focusSectionId.replace(/^q-/, "").split("-").join(".") : null;

  async function start(leaf: Leaf) {
    setView({ kind: "working", label: `Chuẩn bị đề cho ${leaf.unitKey}…` });
    try {
      const cached = await getSectionQuestions(spaceId, leaf.unitKey, "quiz");
      let questions = (cached?.questions as QuizQuestion[] | undefined) ?? undefined;
      if (!questions || questions.length === 0) {
        if (!leaf.docId) { toast.error("Tiểu mục chưa gắn tài liệu"); setView({ kind: "list" }); return; }
        const scope = await getUnitScopeText(leaf.docId, leaf.unitKey);
        if (!scope || scope.length < 40) { toast.error("Không lấy được nội dung tiểu mục"); setView({ kind: "list" }); return; }
        questions = await requestGeneratedQuiz({ scopeText: scope, unitLabel: `${leaf.unitKey} ${leaf.title}`, geminiApiKey: ai?.geminiApiKey, geminiModels: ai?.geminiModels });
        await saveSectionQuestions(spaceId, leaf.unitKey, "quiz", questions);
      }
      setView({ kind: "run", leaf, questions });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo đề thất bại");
      setView({ kind: "list" });
    }
  }

  async function review(leaf: Leaf, attempt: QuizAttemptRow) {
    setView({ kind: "working", label: "Đang mở bài làm…" });
    const cached = await getSectionQuestions(spaceId, leaf.unitKey, "quiz");
    const questions = cached?.questions as QuizQuestion[] | undefined;
    if (!questions) { toast.error("Không tìm thấy đề đã lưu"); setView({ kind: "list" }); return; }
    setView({ kind: "review", leaf, attempt, questions });
  }

  if (attempts === undefined) {
    return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>;
  }
  if (view.kind === "working") {
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-[13.5px] font-medium">{view.label}</p>
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Đề sinh 1 lần bằng AI rồi lưu lại — các lần làm sau không tốn call.</p>
      </div>
    );
  }
  if (view.kind === "run") {
    return <QuizRunner leaf={view.leaf} questions={view.questions} spaceId={spaceId} ai={ai} onExit={() => setView({ kind: "list" })} />;
  }
  if (view.kind === "review") {
    return <AttemptReview leaf={view.leaf} attempt={view.attempt} questions={view.questions} onExit={() => setView({ kind: "list" })} onRetry={() => setView({ kind: "run", leaf: view.leaf, questions: view.questions })} />;
  }
  return <SectionList attempts={attempts} leaves={leaves} titleByKey={titleByKey} focusUnitKey={focusUnitKey} onStart={start} onReview={review} />;
}

// ─── Danh sách section theo lộ trình ─────────────────────────────────────────
function SectionList({
  attempts, leaves, titleByKey, focusUnitKey, onStart, onReview,
}: {
  attempts: QuizAttemptRow[]; leaves: Leaf[]; titleByKey: Map<string, string>; focusUnitKey: string | null;
  onStart: (l: Leaf) => void; onReview: (l: Leaf, a: QuizAttemptRow) => void;
}) {
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focusUnitKey && focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusUnitKey]);

  const byUnit = new Map<string, QuizAttemptRow[]>();
  for (const a of attempts) byUnit.set(a.unitKey, [...(byUnit.get(a.unitKey) ?? []), a]);
  for (const arr of byUnit.values()) arr.sort((x, y) => x.attemptedAt - y.attemptedAt);

  // Hiện leaf có lịch sử HOẶC được điều phối tới
  const visible = leaves.filter((l) => byUnit.has(l.unitKey) || l.unitKey === focusUnitKey);
  const byModule = new Map<string, Leaf[]>();
  for (const l of visible) byModule.set(l.moduleKey, [...(byModule.get(l.moduleKey) ?? []), l]);

  const renderLeaf = (l: Leaf) => {
    const atts = byUnit.get(l.unitKey) ?? [];
    const last = atts[atts.length - 1];
    const focused = l.unitKey === focusUnitKey;
    return (
      <div key={l.unitKey} ref={focused ? focusRef : undefined} className={`rounded-lg border p-3 transition-shadow ${focused ? "border-primary shadow-md ring-2 ring-primary/30" : "border-border/50"}`}>
        {focused && <p className="mb-1.5 text-[10.5px] font-semibold text-primary">← QUIZ CỦA TIỂU MỤC BẠN VỪA CHỌN</p>}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{l.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{l.unitKey}</p>
            {atts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {atts.map((a) => (
                  <button
                    key={a._id}
                    title="Xem lại bài làm này"
                    onClick={() => onReview(l, a)}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium transition-transform hover:scale-105 ${a.score >= 80 ? "bg-emerald-500/10 text-emerald-600" : a.score >= 60 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-500"}`}
                  >
                    <History className="h-2.5 w-2.5" /> {fmtDate(a.attemptedAt)} · {a.score}%
                  </button>
                ))}
                {atts.length >= 2 && last.score > atts[0].score && <span className="text-[10.5px] text-emerald-600">↗ tiến bộ</span>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            {atts.length > 0 && (
              <button onClick={() => onReview(l, last)} className="flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted">
                <History className="h-3 w-3" /> Xem lại
              </button>
            )}
            <button onClick={() => onStart(l)} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
              <Play className="h-3 w-3" /> {atts.length > 0 ? "Làm lại" : "Bắt đầu"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <p className="text-[12.5px] text-muted-foreground">
        Lịch sử kiểm tra theo lộ trình — “Xem lại” mở bài làm cũ kèm nhận xét, “Làm lại” giữ nguyên lịch sử điểm.
      </p>
      <div className="mt-3 space-y-3">
        {[...byModule.entries()].map(([mKey, ls]) => (
          <div key={mKey} className="rounded-xl border bg-card p-3">
            <p className="text-[13px] font-semibold">{titleByKey.get(mKey) ?? mKey}</p>
            <div className="mt-2 space-y-2">{ls.map(renderLeaf)}</div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-5 text-center">
            <p className="text-[13px] text-muted-foreground">Chưa có bài kiểm tra nào.</p>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Tiểu mục chưa làm quiz sẽ không hiện ở đây — bắt đầu từ checklist tiểu mục trong tab Tổng quan (AI tạo đề lúc đó, 1 call).
      </p>
    </div>
  );
}

// ─── Xem lại bài làm ─────────────────────────────────────────────────────────
function AttemptReview({
  leaf, attempt, questions, onExit, onRetry,
}: {
  leaf: Leaf; attempt: QuizAttemptRow; questions: QuizQuestion[]; onExit: () => void; onRetry: () => void;
}) {
  const grades = (attempt.aiFeedback as EssayGrade[] | null) ?? [];
  let openIdx = -1;
  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={onExit} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Về danh sách">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{leaf.title}</p>
          <p className="text-[11px] text-muted-foreground">
            Bài làm {fmtDate(attempt.attemptedAt)} · <b className={attempt.score >= 80 ? "text-emerald-600" : "text-amber-600"}>{attempt.score}%</b> · TN {attempt.mcqCorrect} · TL {attempt.essayScore ?? 0}
          </p>
        </div>
        <button onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
          <RotateCcw className="h-3 w-3" /> Làm lại
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {questions.map((q, i) => {
          const grade = q.kind === "open" ? grades[++openIdx] : undefined;
          return <ReviewQuestion key={i} index={i} q={q} answer={attempt.answers[i]} grade={grade} leaf={leaf} />;
        })}
      </div>
    </div>
  );
}

function ReviewQuestion({ index, q, answer, grade, leaf }: { index: number; q: QuizQuestion; answer?: AttemptAnswer; grade?: EssayGrade; leaf: Leaf }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
        CÂU {index + 1} · {q.kind === "mcq" ? "TRẮC NGHIỆM" : "TỰ LUẬN"}
      </span>
      <StudyMarkdown className="mt-2.5 text-[14px] font-medium leading-relaxed">{q.q}</StudyMarkdown>
      {q.kind === "mcq" ? (
        <div className="mt-3 space-y-2">
          {q.options.map((opt, i) => {
            const picked = answer?.mcqPick === i;
            const isCorrect = i === q.correct;
            if (!picked && !isCorrect) {
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-transparent p-2.5 text-[13px] leading-snug text-muted-foreground/70">
                  <OptionBadge i={i} /><div className="flex-1"><StudyMarkdown>{opt}</StudyMarkdown></div>
                </div>
              );
            }
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-[13px] leading-snug ${isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"}`}>
                <OptionBadge i={i} picked={picked} />
                <div className="flex-1">
                  <StudyMarkdown>{opt}</StudyMarkdown>
                  {picked && !isCorrect && <span className="mt-1 block text-[11.5px] font-medium text-red-500">Bạn đã chọn câu này</span>}
                  {q.explainWrong[i] && <StudyMarkdown className="mt-1 text-[11.5px] text-muted-foreground">{q.explainWrong[i]}</StudyMarkdown>}
                </div>
                {isCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[10.5px] font-semibold text-muted-foreground">CÂU TRẢ LỜI CỦA BẠN {grade && <span className="text-primary">· {Math.round(grade.credit * 100)}%</span>}</p>
            <StudyMarkdown className="mt-1 text-[13px] leading-relaxed">{answer?.openText || "(bỏ trống)"}</StudyMarkdown>
          </div>
          <div className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" /> AI NHẬN XÉT</p>
            {(grade?.good ?? q.feedbackGood).map((f, i) => <p key={i} className="flex gap-1.5 text-[12.5px] text-emerald-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f}</p>)}
            {(grade?.missing ?? q.feedbackMissing).map((f, i) => <p key={i} className="flex gap-1.5 text-[12.5px] text-amber-600"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Thiếu: {f}</p>)}
          </div>
        </div>
      )}
      {q.quote && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div className="flex gap-2">
            <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
            <StudyMarkdown className="text-[12px] italic leading-snug text-muted-foreground">{q.quote}</StudyMarkdown>
          </div>
          <OpenDocLink leaf={leaf} />
        </div>
      )}
    </div>
  );
}

function OptionBadge({ i, picked }: { i: number; picked?: boolean }) {
  return (
    <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${picked ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}>
      {String.fromCharCode(65 + i)}
    </span>
  );
}

// ─── Quiz runner ──────────────────────────────────────────────────────────────
type Answer = { mcqPick?: number; openText?: string; submitted: boolean };

function QuizRunner({
  leaf, questions, spaceId, ai, onExit,
}: {
  leaf: Leaf; questions: QuizQuestion[]; spaceId: string;
  ai: { geminiApiKey: string | null; geminiModels: string[] | null } | null | undefined; onExit: () => void;
}) {
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(questions.map(() => ({ submitted: false })));
  const [phase, setPhase] = useState<"run" | "grading" | "done">("run");
  const [result, setResult] = useState<{ score: number; mcqCorrect: number; essayScore: number; grades: EssayGrade[] } | null>(null);

  const q = questions[qIdx];
  const a = answers[qIdx];
  const total = questions.length;
  const mcqTotal = questions.filter((x) => x.kind === "mcq").length;
  const openTotal = total - mcqTotal;

  function patch(p: Partial<Answer>) {
    setAnswers((prev) => prev.map((x, i) => (i === qIdx ? { ...x, ...p } : x)));
  }

  async function finish() {
    setPhase("grading");
    const mcqCorrect = questions.filter((qq, i) => qq.kind === "mcq" && answers[i].mcqPick === qq.correct).length;
    const openItems = questions
      .map((qq, i) => ({ qq, i }))
      .filter((x) => x.qq.kind === "open")
      .map((x) => ({ q: x.qq.q, answer: answers[x.i].openText ?? "", feedbackGood: (x.qq as Extract<QuizQuestion, { kind: "open" }>).feedbackGood, feedbackMissing: (x.qq as Extract<QuizQuestion, { kind: "open" }>).feedbackMissing }));
    let grades: EssayGrade[] = [];
    try {
      if (openItems.length > 0) grades = await requestEssayGrades({ items: openItems, geminiApiKey: ai?.geminiApiKey, geminiModels: ai?.geminiModels });
    } catch {
      grades = openItems.map(() => ({ credit: 0.5, good: [], missing: ["(AI chấm lỗi — tạm 0.5)"] }));
    }
    const essayScore = grades.reduce((s, g) => s + g.credit, 0);
    const score = Math.round(((mcqCorrect + essayScore) / total) * 100);
    const answersOut: AttemptAnswer[] = answers.map((x) => ({ mcqPick: x.mcqPick, openText: x.openText }));
    try {
      await recordQuizAttempt({ spaceId, unitKey: leaf.unitKey, score, mcqCorrect, essayScore, answers: answersOut, aiFeedback: grades });
      await logStudySession({ spaceId, activityType: "quiz", unitKey: leaf.unitKey, activeMinutes: 10 });
    } catch {
      toast.error("Lưu kết quả quiz thất bại");
    }
    setResult({ score, mcqCorrect, essayScore, grades });
    setPhase("done");
  }

  if (phase === "grading") {
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-[13.5px] font-medium">AI đang chấm câu tự luận…</p>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-10 text-center">
        <div className={`text-4xl font-bold ${result.score >= 80 ? "text-emerald-500" : "text-amber-500"}`}>{result.score}%</div>
        <h2 className="mt-2 text-base font-semibold">{leaf.title}</h2>
        <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          Trắc nghiệm {result.mcqCorrect}/{mcqTotal} · Tự luận {result.essayScore.toFixed(1)}/{openTotal} (AI chấm). Bài làm + nhận xét đã lưu vào lịch sử.
        </p>
        <button onClick={onExit} className="mt-4 rounded-lg border px-3 py-1.5 text-[13px] font-medium hover:bg-muted">Về danh sách</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={onExit} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Thoát quiz">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{leaf.title}</p>
        <span className="shrink-0 text-[12px] text-muted-foreground">Câu {qIdx + 1}/{total}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((qIdx + 1) / total) * 100}%` }} />
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
          {q.kind === "mcq" ? "TRẮC NGHIỆM · VẬN DỤNG" : "TỰ LUẬN NGẮN · AI CHẤM Ý"}
        </span>
        <StudyMarkdown className="mt-2.5 text-[14.5px] font-medium leading-relaxed">{q.q}</StudyMarkdown>

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
                  className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-[13px] leading-snug transition-colors ${showResult && isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : showResult && picked && !isCorrect ? "border-red-500/50 bg-red-500/10" : picked ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}
                >
                  <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${picked ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div className="flex-1">
                    <StudyMarkdown>{opt}</StudyMarkdown>
                    {showResult && (isCorrect || picked) && q.explainWrong[i] && <StudyMarkdown className="mt-1 text-[11.5px] text-muted-foreground">{q.explainWrong[i]}</StudyMarkdown>}
                  </div>
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
                <p className="text-[11px] font-semibold text-muted-foreground">Ý cần có (đối chiếu khi chấm cuối):</p>
                {q.feedbackGood.map((f, i) => <p key={i} className="flex gap-1.5 text-[12.5px] text-emerald-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f}</p>)}
              </div>
            )}
          </div>
        )}

        {a.submitted && q.quote && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <div className="flex gap-2">
              <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
              <StudyMarkdown className="text-[12px] italic leading-snug text-muted-foreground">{q.quote}</StudyMarkdown>
            </div>
            <OpenDocLink leaf={leaf} />
          </div>
        )}
      </div>

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
            onClick={() => (qIdx + 1 >= total ? finish() : setQIdx(qIdx + 1))}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {qIdx + 1 >= total ? "Xem kết quả" : "Câu tiếp"} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
