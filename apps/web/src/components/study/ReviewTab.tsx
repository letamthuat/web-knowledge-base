"use client";

// Tab Ôn tập — thư viện flashcard tổ chức theo lộ trình (module → tiểu mục).
// CHỈ hiện tiểu mục ĐÃ CÓ card (lịch sử); tiểu mục chưa học không xuất hiện.
// Nút "Ôn hôm nay" chạy phiên lật card với toàn bộ card đến hạn.
import { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Link2, Lightbulb, Play, Quote, RotateCcw, Wrench,
} from "lucide-react";
import {
  ALL_CARDS, DUE_CARDS, UNIT_TITLES, firstUnitKey, moduleKeyOf,
  type CardType, type Flashcard,
} from "./mock";

const TYPE_META: Record<CardType, { label: string; icon: typeof Lightbulb; cls: string }> = {
  concept: { label: "Khái niệm", icon: Lightbulb, cls: "bg-blue-500/10 text-blue-500" },
  apply:   { label: "Vận dụng",  icon: Wrench,    cls: "bg-purple-500/10 text-purple-500" },
  link:    { label: "Liên kết",  icon: Link2,     cls: "bg-teal-500/10 text-teal-600" },
};

export function ReviewTab({ focusUnitKey }: { focusUnitKey?: string | null }) {
  const [session, setSession] = useState<Flashcard[] | null>(null);

  // Điều phối mới từ checklist → quay về thư viện (đúng tiểu mục được highlight)
  useEffect(() => {
    setSession(null);
  }, [focusUnitKey]);

  if (session) return <ReviewSession cards={session} onExit={() => setSession(null)} />;
  return <CardLibrary focusUnitKey={focusUnitKey} onStudy={setSession} />;
}

// ─── Thư viện card theo lộ trình ─────────────────────────────────────────────

function CardLibrary({
  focusUnitKey,
  onStudy,
}: {
  focusUnitKey?: string | null;
  onStudy: (cards: Flashcard[]) => void;
}) {
  // Gom card theo tiểu mục → theo module (thứ tự theo số)
  const byUnit = new Map<string, Flashcard[]>();
  for (const c of ALL_CARDS) {
    const key = firstUnitKey(c.unitLabel);
    byUnit.set(key, [...(byUnit.get(key) ?? []), c]);
  }
  const unitKeys = [...byUnit.keys()].sort();
  const byModule = new Map<string, string[]>();
  for (const k of unitKeys) {
    const m = moduleKeyOf(k);
    byModule.set(m, [...(byModule.get(m) ?? []), k]);
  }

  return (
    <div>
      {/* Việc hôm nay */}
      <button
        onClick={() => onStudy(DUE_CARDS)}
        className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-left transition-all hover:shadow-sm"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Play className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">Ôn hôm nay — {DUE_CARDS.length} card đến hạn</p>
          <p className="text-[11px] text-muted-foreground">Trộn các tiểu mục theo lịch giãn cách · ~5 phút</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      </button>

      {/* Thư viện theo lộ trình — chỉ tiểu mục đã có card */}
      <h2 className="mt-5 text-[13px] font-semibold text-muted-foreground">THƯ VIỆN CARD ({ALL_CARDS.length})</h2>
      <div className="mt-2 space-y-3">
        {[...byModule.entries()].map(([mKey, keys]) => (
          <div key={mKey} className="rounded-xl border bg-card p-3">
            <p className="text-[13px] font-semibold">{UNIT_TITLES[mKey] ?? mKey}</p>
            <div className="mt-2 space-y-1.5">
              {keys.map((k) => (
                <UnitCardGroup
                  key={k}
                  unitKey={k}
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
    </div>
  );
}

function UnitCardGroup({
  unitKey,
  cards,
  focused,
  onStudy,
}: {
  unitKey: string;
  cards: Flashcard[];
  focused: boolean;
  onStudy: (cards: Flashcard[]) => void;
}) {
  const [open, setOpen] = useState(focused);
  useEffect(() => { if (focused) setOpen(true); }, [focused]);
  return (
    <div className={`rounded-lg border ${focused ? "border-primary ring-2 ring-primary/30" : "border-border/50"}`}>
      {focused && <p className="px-3 pt-2 text-[10.5px] font-semibold text-primary">← TIỂU MỤC BẠN VỪA CHỌN</p>}
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {UNIT_TITLES[unitKey] ?? unitKey}
          </span>
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
          {cards.map((c) => (
            <BrowseCard key={c.id} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrowseCard({ card }: { card: Flashcard }) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[card.type];
  const TypeIcon = meta.icon;
  return (
    <div className="rounded-lg bg-muted/40">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2.5 p-2.5 text-left">
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <span className={`mb-1 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
            <TypeIcon className="h-2.5 w-2.5" /> {meta.label}
          </span>
          <p className="text-[12.5px] font-medium leading-snug">{card.front}</p>
        </div>
        {card.due ? (
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">đến hạn</span>
        ) : (
          <span className="shrink-0 text-[10px] text-muted-foreground">ôn lại sau {card.intervalDays}d</span>
        )}
      </button>
      {open && (
        <div className="border-t border-border/50 p-2.5">
          <p className="text-[12.5px] leading-relaxed">{card.back}</p>
          <div className="mt-2 flex gap-2 rounded-lg bg-background p-2.5">
            <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-[11.5px] italic leading-snug text-muted-foreground">
              {card.quote}
              <span className="ml-1 cursor-pointer not-italic text-primary underline-offset-2 hover:underline">
                mở tài liệu →
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phiên ôn (lật card, Quên/Nhớ) ───────────────────────────────────────────

function ReviewSession({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<("remembered" | "forgot")[]>([]);

  const total = cards.length;
  const done = idx >= total;
  const card = done ? null : cards[idx];

  function answer(r: "remembered" | "forgot") {
    setResults((prev) => [...prev, r]);
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  if (done) {
    const remembered = results.filter((r) => r === "remembered").length;
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-base font-semibold">Xong phiên ôn!</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Nhớ {remembered}/{total} card · {total - remembered} card Quên sẽ quay lại <b>ngày mai</b>,
          card Nhớ giãn ra gấp đôi khoảng cách.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onExit}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted"
          >
            Về thư viện card
          </button>
          <button
            onClick={() => { setIdx(0); setResults([]); setFlipped(false); }}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Ôn lại (demo)
          </button>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[card!.type];
  const TypeIcon = meta.icon;

  return (
    <div>
      {/* Tiến độ phiên */}
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <button
          onClick={onExit}
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted hover:text-foreground"
          aria-label="Về thư viện card"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1">Card {idx + 1}/{total}</span>
        <span>{card!.unitLabel} · lần ôn cách đây {card!.intervalDays} ngày</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(idx / total) * 100}%` }} />
      </div>

      {/* Card */}
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
            <div className="mt-4 flex gap-2 rounded-lg bg-muted/60 p-2.5">
              <Quote className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[12px] italic leading-snug text-muted-foreground">
                {card!.quote}
                <span className="ml-1 cursor-pointer not-italic text-primary underline-offset-2 hover:underline">
                  mở tài liệu →
                </span>
              </p>
            </div>
          </>
        )}
      </button>

      {/* Nút chấm */}
      {flipped ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => answer("forgot")}
            className="rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-[14px] font-semibold text-red-500 transition-colors hover:bg-red-500/20"
          >
            Quên
            <span className="block text-[10.5px] font-normal opacity-70">ôn lại ngày mai</span>
          </button>
          <button
            onClick={() => answer("remembered")}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-[14px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20"
          >
            Nhớ
            <span className="block text-[10.5px] font-normal opacity-70">
              gặp lại sau {card!.intervalDays * 2} ngày
            </span>
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
