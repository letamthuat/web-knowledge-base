"use client";
// Popup "Đồng bộ lộ trình": liệt kê file markdown hiện tại của handbook (hoặc doc lẻ),
// TICK SẴN file đã thuộc không gian học, file mới để user tự tick thêm → reconcileSpace.
import { useEffect, useMemo, useState } from "react";
import { X, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useStudySpace } from "@/lib/api/study";
import { useHandbookFiles } from "@/lib/api/handbooks";
import { useLooseDocsWithProgress } from "@/lib/api/documents";
import { reconcileSpace, getSpaceSourceIds, isMetaFile, type SrcDoc } from "@/lib/study/materialize";

export function SyncSpaceModal({ spaceId, onClose, onDone }: { spaceId: string; onClose: () => void; onDone: () => void }) {
  const space = useStudySpace(spaceId);
  const handbookFiles = useHandbookFiles(space?.handbookId ?? undefined, space?.sourceType === "handbook" && !!space?.handbookId);
  const looseAll = useLooseDocsWithProgress(space?.sourceType === "docs");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Danh sách file markdown ứng viên (thống nhất shape)
  const files = useMemo<SrcDoc[]>(() => {
    if (space?.sourceType === "handbook") {
      return (handbookFiles ?? []).filter((f) => f.format === "markdown").map((f) => ({ docId: f.docId, relPath: f.relPath, title: f.title }))
        .sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
    }
    return (looseAll ?? []).filter((d) => d.format === "markdown").map((d) => ({ docId: d._id, relPath: d.relPath ?? d.title, title: d.title }));
  }, [space?.sourceType, handbookFiles, looseAll]);

  const loading = space === undefined || (space?.sourceType === "handbook" ? handbookFiles === undefined : looseAll === undefined);

  // Tick sẵn = các file đang thuộc không gian học (study_space_sources)
  useEffect(() => {
    if (loading || sourcesLoaded) return;
    getSpaceSourceIds(spaceId).then((ids) => {
      const set = new Set(ids.filter((id) => files.some((f) => f.docId === id)));
      setChecked(set);
      setSourcesLoaded(true);
    }).catch(() => setSourcesLoaded(true));
  }, [loading, sourcesLoaded, spaceId, files]);

  const toggle = (id: string) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setAll = (on: boolean) => setChecked(on ? new Set(files.map((f) => f.docId)) : new Set());

  async function apply() {
    setBusy(true);
    try {
      const selected = files.filter((f) => checked.has(f.docId));
      const diff = await reconcileSpace(spaceId, selected, true);
      if (diff.added === 0 && diff.changed === 0 && diff.removed === 0) toast.success("Lộ trình đã khớp — không có gì đổi");
      else toast.success(`Đã đồng bộ: +${diff.added} mục mới · ${diff.changed} mục nội dung đổi · ${diff.removed} mục gỡ`);
      onDone();
    } catch {
      toast.error("Đồng bộ thất bại — thử lại");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><RefreshCw className="h-4 w-4 text-primary" /> Đồng bộ lộ trình</h2>
          <button onClick={onClose} disabled={busy} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-[12px] text-muted-foreground">
            Tick file muốn học. File đã có trong lộ trình được tick sẵn; bỏ tick = gỡ (giữ tiến độ để tra cứu). Tiến độ đã học KHÔNG mất.
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground">File markdown ({checked.size}/{files.length} chọn)</span>
            <div className="flex items-center gap-2 text-[11px]">
              <button onClick={() => setAll(true)} className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10">Chọn tất cả</button>
              <button onClick={() => setAll(false)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted">Bỏ chọn</button>
            </div>
          </div>

          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nạp file…</p>
          ) : files.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">Không có file markdown để đồng bộ.</p>
          ) : (
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1.5">
              {files.map((f) => {
                const meta = isMetaFile(f.relPath);
                return (
                  <label key={f.docId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                    <input type="checkbox" checked={checked.has(f.docId)} onChange={() => toggle(f.docId)} className="accent-primary" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{f.relPath}</span>
                    {meta && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">phụ trợ</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted disabled:opacity-40">Huỷ</button>
          <button onClick={apply} disabled={busy || loading} className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang đồng bộ…</> : "Cập nhật lộ trình"}
          </button>
        </div>
      </div>
    </div>
  );
}
