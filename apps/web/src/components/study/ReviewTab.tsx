"use client";

// Tab Ôn tập — flashcard THẬT từ Supabase, tổ chức theo lộ trình (module → tiểu mục).
// Chỉ hiện tiểu mục ĐÃ CÓ card; nếu điều phối tới tiểu mục chưa có card → panel sinh AI.
// Quên/Nhớ ghi review_logs + cập nhật interval (SRS ×2 / reset). Ôn hôm nay = card đến hạn.
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Link2, Lightbulb, Loader2, Play, Quote, Sparkles, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import type { StudySpace, StudyUnit } from "./mock";
import { useAiSettings } from "@/lib/api/ai-settings";
import {
  useFlashcards, insertFlashcards, reviewFlashcard, logStudySession, isDue,
  type FlashcardRow, type CardType,
} from "@/lib/api/study";
import { getUnitScopeText } from "@/lib/study/materialize";
import { requestGeneratedCards, type GenCard } from "@/lib/study/generate";

const TYPE_META: Record<CardType, { label: string; icon: typeof Lightbulb; cls: string }> = {
  concept: { label: "Khái niệm", icon: Lightbulb, cls: "bg-blue-500/10 text-blue-500" },
  apply:   { label: "Vận dụng",  icon: Wrench,    cls: "bg-purple-500/10 text-purple-500" },
  link:    { label: "Liên kết",  icon: Link2,     cls: "bg-teal-500/10 text-teal-600" },
};

type Leaf = { unitKey: string; moduleKey: string; title: string; docId: string | null };

function unitKeyOfId(id: string): string {
  return /^m\d+$/.test(id) ? "M" + id.slice(1) : id.slice(1).split("-").join(".");
}

// Phẳng hoá cây: leaf (đơn vị scope) + map key→title (gồm cả module) để hiển thị.
function flatten(units: StudyUnit[]): { leaves: Leaf[]; titleByKey: Map<string, string> } {
  const leaves: Leaf[] = [];
  const titleByKey = new Map<string, string>();
  const walk = (u: StudyUnit) => {
    const key = unitKeyOfId(u.id);
    titleByKey.set(key, u.title);
    if (u.children && u.children.length) u.children.forEach(walk);
    else leaves.push({ unitKey: key, moduleKey: "M" + key.split(".")[0], title: u.title, docId: u.docId ?? null });
  };
  units.forEach(walk);
  return { leaves, titleByKey };
}

export function ReviewTab({ spaceId, space, focusUnitKey }: { spaceId: string; space: StudySpace; focusUnitKey?: string | null }) {
  const cards = useFlashcards(spaceId);
  const [session, setSession] = useState<FlashcardRow[] | null>(null);
  const { leaves, titleByKey } = useMemo(() => flatten(space.units), [space.units]);

  useEffect(() => { setSession(null); }, [focusUnitKey]);

  if (cards === undefined) {
    return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải card…</div>;
  }
  if (session) return <ReviewSession cards={session} spaceId={spaceId} titleByKey={titleByKey} onExit={() => setSession(null)} />;
  return (
    <CardLibrary
      spaceId={spaceId}
      cards={cards}
      leaves={leaves}
      titleByKey={titleByKey}
      focusUnitKey={focusUnitKey}
      onStudy={setSession}
    />
  );
}

// ─── Thư viện card theo lộ trình ─────────────────────────────────────────────
function CardLibrary({
  spaceId, cards, leaves, titleByKey, focusUnitKey, onStudy,
}: {
  spaceId: string; cards: FlashcardRow[]; leaves: Leaf[]; titleByKey: Map<string, string>;
  focusUnitKey?: string | null; onStudy: (cards: FlashcardRow[]) => void;
}) {
  const dueCards = cards.filter((c) => isDue(c));
  const byUnit = new Map<string, FlashcardRow[]>();
  for (const c of cards) byUnit.set(c.unitKey, [...(byUnit.get(c.unitKey) ?? []), c]);
  const unitKeys = [...byUnit.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const byModule = new Map<string, string[]>();
  for (const k of unitKeys) {
    const m = "M" + k.split(".")[0];
    byModule.set(m, [...(byModule.get(m) ?? []), k]);
  }

  // Điều phối tới tiểu mục CHƯA có card → panel sinh AI
  const focusLeaf = focusUnitKey ? leaves.find((l) => l.unitKey === focusUnitKey) : undefined;
  const focusHasCards = focusUnitKey ? byUnit.has(focusUnitKey) : true;

  return (
    <div>
      {/* Ôn hôm nay */}
      {dueCards.length > 0 && (
        <button
          onClick={() => onStudy(dueCards)}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-left transition-all hover:shadow-sm"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Play className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold">Ôn hôm nay — {dueCards.length} card đến hạn</p>
            <p className="text-[11px] text-muted-foreground">Trộn các tiểu mục theo lịch giãn cách</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        </button>
      )}

      {/* Sinh card cho tiểu mục vừa chọn (chưa có card) */}
      {focusLeaf && !focusHasCards && (
        <GeneratePanel key={focusLeaf.unitKey} spaceId={spaceId} leaf={focusLeaf} />
      )}

      {cards.length === 0 && !focusLeaf ? (
        <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">
          Chưa có flashcard nào. Vào tab Tổng quan → tiểu mục → “Tạo flashcard” để AI sinh bộ card đầu tiên.
        </div>
      ) : (
        <>
          <h2 className="mt-5 text-[13px] font-semibold text-muted-foreground">THƯ VIỆN CARD ({cards.length})</h2>
          <div className="mt-2 space-y-3">
            {[...byModule.entries()].map(([mKey, keys]) => (
              <div key={mKey} className="rounded-xl border bg-card p-3">
                <p className="text-[13px] font-semibold">{titleByKey.get(mKey) ?? mKey}</p>
                <div className="mt-2 space-y-1.5">
                  {keys.map((k) => (
                    <UnitCardGroup
                      key={k}
                      title={titleByKey.get(k) ?? k}
                      cards={byUnit.get(k)!}
                      focused={k === focusUnitKey}
                      onStudy={onStudy}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            Tiểu mục chưa có card sẽ không hiện ở đây — tạo card từ checklist tiểu mục trong tab Tổng quan.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Panel sinh card AI (duyệt trước khi lưu) ────────────────────────────────
function GeneratePanel({ spaceId, leaf }: { spaceId: string; leaf: Leaf }) {
  const ai = useAiSettings();
  const [phase, setPhase] = useState<"idle" | "generating" | "review" | "saving">("idle");
  const [gen, setGen] = useState<GenCard[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());

  async function generate() {
    if (!leaf.docId) { toast.error("Tiểu mục chưa gắn tài liệu"); return; }
    setPhase("generating");
    try {
      const scope = await getUnitScopeText(leaf.docId, leaf.unitKey);
      if (!scope || scope.length < 40) { toast.error("Không lấy được nội dung tiểu mục"); setPhase("idle"); return; }
      const cards = await requestGeneratedCards({
        scopeText: scope,
        unitLabel: `${leaf.unitKey} ${leaf.title}`,
        geminiApiKey: ai?.geminiApiKey,
        geminiModels: ai?.geminiModels,
      });
      setGen(cards);
      setKept(new Set(cards.map((_, i) => i)));
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sinh card thất bại");
      setPhase("idle");
    }
  }

  async function save() {
    setPhase("saving");
    try {
      const chosen = gen.filter((_, i) => kept.has(i));
      await insertFlashcards(spaceId, chosen.map((c) => ({
        unitKey: leaf.unitKey, moduleKey: leaf.moduleKey, type: c.type, front: c.front, back: c.back, quote: c.quote,
      })));
      await logStudySession({ spaceId, activityType: "cards", unitKey: leaf.unitKey, activeMinutes: 12 });
      toast.success(`Đã lưu ${chosen.length} card cho ${leaf.unitKey}`);
      // realtime refetch → panel biến mất (unit đã có card)
    } catch {
      toast.error("Lưu card thất bại");
      setPhase("review");
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <p className="text-[10.5px] font-semibold text-primary">← TIỂU MỤC BẠN VỪA CHỌN</p>
      <p className="mt-0.5 text-[13px] font-semibold">{leaf.unitKey} — {leaf.title}</p>

      {phase === "idle" && (
        <>
          <p className="mt-1 text-[12px] text-muted-foreground">Chưa có flashcard. AI sẽ sinh 8–12 card (~1 call Gemini) — bạn duyệt trước khi lưu.</p>
          <button onClick={generate} className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
            <Sparkles className="h-4 w-4" /> Sinh flashcard bằng AI
          </button>
        </>
      )}

      {phase === "generating" && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> AI đang tạo card từ nội dung tiểu mục…</p>
      )}

      {(phase === "review" || phase === "saving") && (
        <div className="mt-2">
          <p className="text-[12px] text-muted-foreground">AI sinh {gen.length} card — bỏ tick card không muốn giữ ({kept.size} chọn):</p>
          <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
            {gen.map((c, i) => {
              const meta = TYPE_META[c.type];
              const TypeIcon = meta.icon;
              const on = kept.has(i);
              return (
                <div key={i} className={`rounded-lg border p-2.5 ${on ? "bg-card" : "bg-muted/40 opacity-60"}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setKept((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <span className={`mb-1 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                        <TypeIcon className="h-2.5 w-2.5" /> {meta.label}
                      </span>
                      <p className="text-[12.5px] font-medium leading-snug">{c.front}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{c.back}</p>
                      {c.quote && <p className="mt-1 text-[11px] italic text-muted-foreground/80">“{c.quote}”</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={save}
              disabled={kept.size === 0 || phase === "saving"}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {phase === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu…</> : `Lưu ${kept.size} card`}
            </button>
            <button onClick={generate} disabled={phase === "saving"} className="rounded-lg border px-3 py-2 text-[13px] hover:bg-muted disabled:opacity-40">
              Sinh lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitCardGroup({
  title, cards, focused, onStudy,
}: {
  title: string; cards: FlashcardRow[]; focused: boolean; onStudy: (cards: FlashcardRow[]) => void;
}) {
  const [open, setOpen] = useState(focused);
  useEffect(() => { if (focused) setOpen(true); }, [focused]);
  return (
    <div className={`rounded-lg border ${focused ? "border-primary ring-2 ring-primary/30" : "border-border/50"}`}>
      {focused && <p className="px-3 pt-2 text-[10.5px] font-semibold text-primary">← TIỂU MỤC BẠN VỪA CHỌN</p>}
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</span>
          <span className="shrink-0 text-[10.5px] text-muted-foreground">{cards.length} card</span>
        </button>
        <button
          onClick={() => onStudy(cards)}
          className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
        >
          <Play className="h-2.5 w-2.5" /> Ôn bộ này
        </button>
      </div>
      {open && (
        <div className="space-y-1.5 border-t p-2">
          {cards.map((c) => <BrowseCard key={c._id} card={c} />)}
        </div>
      )}
    </div>
  );
}

function BrowseCard({ card }: { card: FlashcardRow }) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[card.type];
  const TypeIcon = meta.icon;
  const due = isDue(card);
  return (
    <div className="rounded-lg bg-muted/40">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2.5 p-2.5 text-left">
        {open ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <span className={`mb-1 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
            <TypeIcon className="h-2.5 w-2.5" /> {meta.label}
          </span>
          <p className="text-[12.5px] font-medium leading-snug">{card.front}</p>
        </div>
        {due ? (
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">đến hạn</span>
        ) : (
          <span className="shrink-0 text-[10px] text-muted-foreground">ôn lại sau {card.intervalDays}d</span>
        )}
      </button>
      {open && (
        <div className="border-t border-border/50 p-2.5">
          <p className="text-[12.5px] leading-relaxed">{card.back}</p>
          {card.quote && (
            <div className="mt-2 flex gap-2 rounded-lg bg-background p-2.5">
              <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[11.5px] italic leading-snug text-muted-foreground">{card.quote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phiên ôn (lật card, Quên/Nhớ) ───────────────────────────────────────────
function ReviewSession({
  cards, spaceId, titleByKey, onExit,
}: {
  cards: FlashcardRow[]; spaceId: string; titleByKey: Map<string, string>; onExit: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<("remembered" | "forgot")[]>([]);

  const total = cards.length;
  const done = idx >= total;
  const card = done ? null : cards[idx];

  function answer(r: "remembered" | "forgot") {
    const c = cards[idx];
    void reviewFlashcard(c, r).catch(() => toast.error("Không lưu được kết quả ôn"));
    setResults((prev) => [...prev, r]);
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  useEffect(() => {
    if (done && total > 0) {
      void logStudySession({ spaceId, activityType: "review", activeMinutes: Math.max(1, Math.round(total * 0.5)) }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (done) {
    const remembered = results.filter((r) => r === "remembered").length;
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-base font-semibold">Xong phiên ôn!</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Nhớ {remembered}/{total} card · card Quên quay lại <b>ngày mai</b>, card Nhớ giãn ra gấp đôi khoảng cách.
        </p>
        <button onClick={onExit} className="mt-4 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted">
          Về thư viện card
        </button>
      </div>
    );
  }

  const meta = TYPE_META[card!.type];
  const TypeIcon = meta.icon;
  const label = titleByKey.get(card!.unitKey) ?? card!.unitKey;

  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <button onClick={onExit} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted hover:text-foreground" aria-label="Về thư viện card">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1">Card {idx + 1}/{total}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(idx / total) * 100}%` }} />
      </div>

      <button
        onClick={() => setFlipped(!flipped)}
        className="mt-4 flex min-h-[260px] w-full flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition-shadow hover:shadow-md"
      >
        <span className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
          <TypeIcon className="h-3 w-3" /> {meta.label}
        </span>
        {!flipped ? (
          <>
            <p className="mt-4 flex-1 text-[15px] font-medium leading-relaxed">{card!.front}</p>
            <p className="mt-4 text-center text-[11.5px] text-muted-foreground">Chạm để xem đáp án</p>
          </>
        ) : (
          <>
            <p className="mt-4 text-[14px] leading-relaxed">{card!.back}</p>
            {card!.quote && (
              <div className="mt-4 flex gap-2 rounded-lg bg-muted/60 p-2.5">
                <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-[12px] italic leading-snug text-muted-foreground">{card!.quote}</p>
              </div>
            )}
          </>
        )}
      </button>

      {flipped ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => answer("forgot")}
            className="rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-[14px] font-semibold text-red-500 transition-colors hover:bg-red-500/20"
          >
            Quên<span className="block text-[10.5px] font-normal opacity-70">ôn lại ngày mai</span>
          </button>
          <button
            onClick={() => answer("remembered")}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-[14px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20"
          >
            Nhớ<span className="block text-[10.5px] font-normal opacity-70">gặp lại sau {card!.intervalDays * 2} ngày</span>
          </button>
        </div>
      ) : (
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Tự trả lời trong đầu trước rồi mới lật — đó mới là ôn tập thật.
        </p>
      )}
    </div>
  );
}
