"use client";
// Tạo series podcast: nguồn = 1 handbook (chọn file markdown) HOẶC 1 tài liệu lẻ (markdown/PDF)
// → đọc nguồn → chia tập theo lượng kiến thức (lib/podcast/plan) → lưu series + tập "Chưa tạo".
// Kịch bản chỉ sinh khi bấm từng tập (giữ $0).
import { useEffect, useMemo, useState } from "react";
import { X, Loader2, BookOpen, FileText, Podcast, Search } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useHandbookFiles, type HandbookRow, type HandbookFile } from "@/lib/api/handbooks";
import { useLooseDocsWithProgress, getDownloadUrl } from "@/lib/api/documents";
import { isMetaFile } from "@/lib/study/materialize";
import { buildFileTree, FileTreeNodes } from "@/components/study/CreateSpaceModal";
import { getPdfReflow } from "@/lib/pdf/reflow";
import { planMarkdownEpisodes, planPdfEpisodes, DEFAULT_TARGET_CHARS, type PlannedEpisode } from "@/lib/podcast/plan";
import { createSeries } from "@/lib/api/podcast";

const EMOJIS = ["🎙️", "🎧", "📻", "🧠", "📚", "💡", "🎯", "🚀", "🔬", "☕"];
type SourceType = "handbook" | "doc";
const PODCAST_FORMATS = new Set(["markdown", "pdf"]);

export function CreateSeriesModal({ onClose, onCreated }: { onClose: () => void; onCreated: (seriesId: string) => void }) {
  const handbooks = useRealtimeQuery<HandbookRow>("handbooks", { order: { column: "order", ascending: true } });
  const activeHandbooks = useMemo(() => (handbooks ?? []).filter((h) => !h.trashedAt), [handbooks]);

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎙️");
  const [source, setSource] = useState<SourceType>("handbook");
  const [handbookId, setHandbookId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [docId, setDocId] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filesRaw = useHandbookFiles(handbookId ?? undefined, source === "handbook" && !!handbookId);
  const mdFiles = useMemo<HandbookFile[]>(() => (filesRaw ?? []).filter((f) => f.format === "markdown"), [filesRaw]);
  const tree = useMemo(() => buildFileTree(mdFiles.map((f) => ({ docId: f.docId, relPath: f.relPath }))), [mdFiles]);

  const looseAll = useLooseDocsWithProgress(source === "doc");
  const looseDocs = useMemo(() => {
    const q = docFilter.trim().toLowerCase();
    return (looseAll ?? []).filter((d) => PODCAST_FORMATS.has(d.format) && (!q || d.title.toLowerCase().includes(q)));
  }, [looseAll, docFilter]);

  // Handbook: tick sẵn file nội dung (bỏ phụ trợ) + gợi ý tên
  useEffect(() => {
    if (source !== "handbook" || filesRaw === undefined) return;
    setChecked(new Set(mdFiles.filter((f) => !isMetaFile(f.relPath)).map((f) => f.docId)));
    const hb = activeHandbooks.find((h) => h._id === handbookId);
    if (hb && !title.trim()) setTitle(hb.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesRaw, handbookId, source]);

  const toggleLeaf = (id: string) => setChecked((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleFolder = (ids: string[], on: boolean) => setChecked((prev) => {
    const n = new Set(prev);
    for (const id of ids) { if (on) n.add(id); else n.delete(id); }
    return n;
  });

  const canCreate = !busy && title.trim().length > 0 && (source === "handbook" ? !!handbookId && checked.size > 0 : !!docId);

  async function handleCreate() {
    try {
      let episodes: PlannedEpisode[] = [];
      let docIds: string[] = [];
      if (source === "handbook") {
        const files = mdFiles
          .filter((f) => checked.has(f.docId))
          .sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
        docIds = files.map((f) => f.docId);
        const docs: { docId: string; title: string; markdown: string }[] = [];
        for (let i = 0; i < files.length; i++) {
          setBusy(`Đang đọc file ${i + 1}/${files.length}…`);
          const res = await fetch(await getDownloadUrl(files[i].docId));
          if (!res.ok) throw new Error(`Không tải được ${files[i].title}`);
          docs.push({ docId: files[i].docId, title: files[i].title, markdown: await res.text() });
        }
        setBusy("Đang chia tập…");
        episodes = planMarkdownEpisodes(docs, DEFAULT_TARGET_CHARS);
      } else {
        const doc = (looseAll ?? []).find((d) => d._id === docId);
        if (!doc) return;
        docIds = [doc._id];
        const url = await getDownloadUrl(doc._id);
        if (doc.format === "pdf") {
          setBusy("Đang trích chữ từ PDF…");
          const pages = await getPdfReflow(doc._id, url);
          episodes = planPdfEpisodes(doc._id, pages, DEFAULT_TARGET_CHARS);
          if (!episodes.length) throw new Error("PDF này là ảnh scan — không có chữ để làm podcast");
        } else {
          setBusy("Đang đọc tài liệu…");
          const res = await fetch(url);
          if (!res.ok) throw new Error("Không tải được tài liệu");
          episodes = planMarkdownEpisodes([{ docId: doc._id, title: doc.title, markdown: await res.text() }], DEFAULT_TARGET_CHARS);
        }
      }
      if (!episodes.length) throw new Error("Không tìm thấy nội dung để chia tập");
      setBusy("Đang lưu series…");
      const seriesId = await createSeries({
        title, emoji, sourceType: source, handbookId: source === "handbook" ? handbookId : null,
        docIds, targetChars: DEFAULT_TARGET_CHARS, episodes,
      });
      toast.success(`Đã tạo "${title.trim()}" — ${episodes.length} tập`);
      onCreated(seriesId);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Tạo series thất bại");
      setBusy(null);
    }
  }

  const switchSource = (s: SourceType) => { if (!busy) { setSource(s); setChecked(new Set()); setDocId(null); } };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Podcast className="h-4 w-4 text-primary" /> Series podcast mới
          </h2>
          <button onClick={onClose} disabled={!!busy} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Tên series</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Supply Chain 360 — bản nghe"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:border-primary sm:text-[14px]"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${emoji === e ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-muted"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Nguồn</label>
            <div className="mt-1 flex gap-1 rounded-lg bg-muted/60 p-1">
              {([["handbook", BookOpen, "Handbook"], ["doc", FileText, "Tài liệu lẻ"]] as const).map(([k, Icon, label]) => (
                <button key={k} onClick={() => switchSource(k)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${source === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {source === "handbook" && (
            <>
              <div>
                <label className="text-[12px] font-medium text-muted-foreground">Chọn handbook</label>
                {activeHandbooks.length === 0 ? (
                  <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">Chưa có handbook nào — chuyển sang "Tài liệu lẻ".</p>
                ) : (
                  <select value={handbookId ?? ""} onChange={(e) => setHandbookId(e.target.value || null)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:border-primary sm:text-[14px]">
                    <option value="">— Chọn handbook —</option>
                    {activeHandbooks.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                )}
              </div>
              {handbookId && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-muted-foreground">File ({checked.size}/{mdFiles.length} chọn)</label>
                    <div className="flex gap-2 text-[11px]">
                      <button onClick={() => setChecked(new Set(mdFiles.map((f) => f.docId)))} className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10">Chọn tất cả</button>
                      <button onClick={() => setChecked(new Set())} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted">Bỏ chọn</button>
                    </div>
                  </div>
                  {filesRaw === undefined ? (
                    <p className="mt-1 flex items-center gap-2 py-3 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nạp file…</p>
                  ) : (
                    <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border p-1">
                      <FileTreeNodes nodes={tree} depth={0} checked={checked} onToggleLeaf={toggleLeaf} onToggleFolder={toggleFolder} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {source === "doc" && (
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Chọn 1 tài liệu (Markdown hoặc PDF)</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={docFilter} onChange={(e) => setDocFilter(e.target.value)} placeholder="Lọc theo tên…"
                  className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-3 text-base outline-none focus:border-primary sm:text-[13px]" />
              </div>
              {looseAll === undefined ? (
                <p className="mt-1 flex items-center gap-2 py-3 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nạp tài liệu…</p>
              ) : looseDocs.length === 0 ? (
                <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">Không có tài liệu Markdown/PDF phù hợp.</p>
              ) : (
                <div className="mt-1 max-h-56 space-y-0.5 overflow-y-auto rounded-lg border p-1.5">
                  {looseDocs.map((d) => (
                    <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <input type="radio" name="podcast-doc" checked={docId === d._id}
                        onChange={() => { setDocId(d._id); if (!title.trim()) setTitle(d.title); }} className="accent-primary" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{d.title}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{d.format === "markdown" ? "md" : d.format}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            App chia tập theo <b>lượng kiến thức</b> (~{Math.round(DEFAULT_TARGET_CHARS / 1000)}k ký tự nguồn/tập), không tóm tắt cho vừa thời lượng — tiểu mục dài được tách thành nhiều phần. Kịch bản chỉ được viết khi bạn bấm nghe từng tập.
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3" style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}>
          <button onClick={onClose} disabled={!!busy} className="rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted disabled:opacity-40">Huỷ</button>
          <button onClick={handleCreate} disabled={!canCreate}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {busy}</> : "Tạo & chia tập"}
          </button>
        </div>
      </div>
    </div>
  );
}
