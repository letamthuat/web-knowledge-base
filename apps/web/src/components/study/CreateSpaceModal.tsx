"use client";
// B2-UI — Wizard tạo Không gian học: tên + emoji + chọn handbook + tick file học
// (auto bỏ tick file phụ trợ) → createStudySpace + materializeHandbookSpace. Xem SPEC-FEATURES §0.1.
import { useEffect, useMemo, useState } from "react";
import { X, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useHandbookFiles, type HandbookRow } from "@/lib/api/handbooks";
import { createStudySpace } from "@/lib/api/study";
import { materializeHandbookSpace, isMetaFile } from "@/lib/study/materialize";

const EMOJIS = ["📘", "📗", "📙", "📕", "📚", "🧠", "🎯", "🔬", "💡", "🗂️"];

export function CreateSpaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (spaceId: string) => void }) {
  const handbooks = useRealtimeQuery<HandbookRow>("handbooks", { order: { column: "order", ascending: true } });
  const activeHandbooks = useMemo(() => (handbooks ?? []).filter((h) => !h.trashedAt), [handbooks]);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [handbookId, setHandbookId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const files = useHandbookFiles(handbookId ?? undefined, !!handbookId);

  // Khi chọn handbook / file nạp xong → auto-tick file nội dung, bỏ tick file phụ trợ.
  useEffect(() => {
    if (!files) return;
    const next = new Set<string>();
    for (const f of files) if (!isMetaFile(f.relPath)) next.add(f.docId);
    setChecked(next);
    // gợi ý tên theo handbook nếu user chưa nhập
    if (!name.trim()) {
      const hb = activeHandbooks.find((h) => h._id === handbookId);
      if (hb) setName(hb.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, handbookId]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const canCreate = name.trim().length > 0 && !!handbookId && checked.size > 0 && !busy;

  async function handleCreate() {
    if (!handbookId || !files) return;
    setBusy(true);
    try {
      const selectedDocs = files
        .filter((f) => checked.has(f.docId))
        .map((f) => ({ docId: f.docId, relPath: f.relPath, title: f.title }))
        .sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
      const spaceId = await createStudySpace({ name: name.trim(), emoji, sourceType: "handbook", handbookId });
      const { unitCount, moduleCount } = await materializeHandbookSpace({ spaceId, handbookId, selectedDocs });
      toast.success(`Đã tạo "${name.trim()}" — ${moduleCount} module, ${unitCount} mục lộ trình`);
      onCreated(spaceId);
    } catch (e) {
      console.error(e);
      toast.error("Tạo không gian học thất bại — thử lại");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> Không gian học mới
          </h2>
          <button onClick={onClose} disabled={busy} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Tên + emoji */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Tên không gian học</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Ôn Supply Chain 360"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-[14px] outline-none focus:border-primary"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${emoji === e ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-muted"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Chọn handbook */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Nguồn học liệu (handbook)</label>
            {activeHandbooks.length === 0 ? (
              <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">
                Chưa có handbook nào. Tạo handbook trong Thư viện trước.
              </p>
            ) : (
              <select
                value={handbookId ?? ""}
                onChange={(e) => setHandbookId(e.target.value || null)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-[14px] outline-none focus:border-primary"
              >
                <option value="">— Chọn handbook —</option>
                {activeHandbooks.map((h) => (
                  <option key={h._id} value={h._id}>{h.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Chọn file học */}
          {handbookId && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-muted-foreground">File học ({checked.size} chọn)</label>
                <span className="text-[11px] text-muted-foreground">Bỏ tick sẵn mục lục / glossary</span>
              </div>
              {files === undefined ? (
                <p className="mt-1 flex items-center gap-2 py-3 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nạp file…</p>
              ) : files.length === 0 ? (
                <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">Handbook này chưa có file.</p>
              ) : (
                <div className="mt-1 max-h-52 space-y-1 overflow-y-auto rounded-lg border p-1.5">
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
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted disabled:opacity-40">
            Huỷ
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo lộ trình…</> : "Tạo & sinh lộ trình"}
          </button>
        </div>
      </div>
    </div>
  );
}
