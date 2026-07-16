"use client";
// B2-UI — Wizard tạo Không gian học: tên + emoji + nguồn (handbook HOẶC tài liệu lẻ)
// → chọn file/doc học (cây thư mục, tri-state cha→con, chỉ file markdown) → createStudySpace +
// materialize (sinh lộ trình từ heading markdown). Xem SPEC-FEATURES §0.1.
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, BookOpen, FileText, Folder } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useHandbookFiles, type HandbookRow, type HandbookFile } from "@/lib/api/handbooks";
import { useLooseDocsWithProgress } from "@/lib/api/documents";
import { createStudySpace } from "@/lib/api/study";
import { materializeHandbookSpace, materializeDocsSpace, isMetaFile } from "@/lib/study/materialize";

const EMOJIS = ["📘", "📗", "📙", "📕", "📚", "🧠", "🎯", "🔬", "💡", "🗂️"];
type SourceType = "handbook" | "docs";

// ─── Cây thư mục từ relPath ────────────────────────────────────────────────────
type TreeNode = { name: string; path: string; docId?: string; children: TreeNode[] };

function buildFileTree(files: { docId: string; relPath: string }[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const f of files) {
    const parts = f.relPath.split("/").filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const isLeaf = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let node = cur.children.find((c) => c.name === parts[i] && (isLeaf ? !!c.docId : !c.docId));
      if (!node) {
        node = { name: parts[i], path, children: [] };
        if (isLeaf) node.docId = f.docId;
        cur.children.push(node);
      }
      cur = node;
    }
  }
  // Sort: folder trước, rồi theo tên (numeric)
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const fa = a.docId ? 1 : 0, fb = b.docId ? 1 : 0;
      if (fa !== fb) return fa - fb;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    for (const n of nodes) if (n.children.length) sortRec(n.children);
  };
  sortRec(root.children);
  return root.children;
}

function collectLeafIds(node: TreeNode): string[] {
  if (node.docId) return [node.docId];
  return node.children.flatMap(collectLeafIds);
}

function TriCheckbox({ state, onChange }: { state: "on" | "off" | "partial"; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "partial";
  }, [state]);
  return <input ref={ref} type="checkbox" checked={state === "on"} onChange={onChange} className="accent-primary" />;
}

function FileTreeNodes({
  nodes, depth, checked, onToggleLeaf, onToggleFolder,
}: {
  nodes: TreeNode[]; depth: number; checked: Set<string>;
  onToggleLeaf: (id: string) => void; onToggleFolder: (leafIds: string[], turnOn: boolean) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const pad = { paddingLeft: 8 + depth * 16 };
        if (node.docId) {
          const meta = isMetaFile(node.path);
          return (
            <label key={node.path} style={pad} className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted">
              <input type="checkbox" checked={checked.has(node.docId)} onChange={() => onToggleLeaf(node.docId!)} className="accent-primary" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{node.name}</span>
              {meta && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">phụ trợ</span>}
            </label>
          );
        }
        const leaves = collectLeafIds(node);
        const onCount = leaves.filter((id) => checked.has(id)).length;
        const state = onCount === 0 ? "off" : onCount === leaves.length ? "on" : "partial";
        return (
          <div key={node.path}>
            <label style={pad} className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted">
              <TriCheckbox state={state} onChange={() => onToggleFolder(leaves, state !== "on")} />
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{node.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{onCount}/{leaves.length}</span>
            </label>
            <FileTreeNodes nodes={node.children} depth={depth + 1} checked={checked} onToggleLeaf={onToggleLeaf} onToggleFolder={onToggleFolder} />
          </div>
        );
      })}
    </>
  );
}

export function CreateSpaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (spaceId: string) => void }) {
  const handbooks = useRealtimeQuery<HandbookRow>("handbooks", { order: { column: "order", ascending: true } });
  const activeHandbooks = useMemo(() => (handbooks ?? []).filter((h) => !h.trashedAt), [handbooks]);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [source, setSource] = useState<SourceType>("handbook");
  const [handbookId, setHandbookId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set()); // docId đã tick (dùng chung 2 nguồn)
  const [busy, setBusy] = useState(false);

  const filesRaw = useHandbookFiles(handbookId ?? undefined, source === "handbook" && !!handbookId);
  // CHỈ file markdown là học liệu — bỏ ảnh/asset (assets/img/*.png…).
  const mdFiles = useMemo<HandbookFile[]>(() => (filesRaw ?? []).filter((f) => f.format === "markdown"), [filesRaw]);
  const tree = useMemo(() => buildFileTree(mdFiles.map((f) => ({ docId: f.docId, relPath: f.relPath }))), [mdFiles]);

  const looseAll = useLooseDocsWithProgress(source === "docs");
  const looseDocs = useMemo(() => (looseAll ?? []).filter((d) => d.format === "markdown"), [looseAll]);

  // Handbook: auto-tick file markdown nội dung (bỏ tick phụ trợ) + gợi ý tên.
  useEffect(() => {
    if (source !== "handbook" || filesRaw === undefined) return;
    const next = new Set<string>();
    for (const f of mdFiles) if (!isMetaFile(f.relPath)) next.add(f.docId);
    setChecked(next);
    if (!name.trim()) {
      const hb = activeHandbooks.find((h) => h._id === handbookId);
      if (hb) setName(hb.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesRaw, handbookId, source]);

  // Tài liệu lẻ: mặc định tick hết doc markdown.
  useEffect(() => {
    if (source !== "docs" || !looseAll) return;
    setChecked(new Set(looseDocs.map((d) => d._id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looseAll, source]);

  const toggleLeaf = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleFolder = (leafIds: string[], turnOn: boolean) =>
    setChecked((prev) => {
      const n = new Set(prev);
      for (const id of leafIds) {
        if (turnOn) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  const allIds = source === "handbook" ? mdFiles.map((f) => f.docId) : looseDocs.map((d) => d._id);
  const setAll = (on: boolean) => setChecked(on ? new Set(allIds) : new Set());

  const switchSource = (s: SourceType) => {
    if (busy) return;
    setSource(s);
    setChecked(new Set());
  };

  const canCreate = name.trim().length > 0 && checked.size > 0 && !busy && (source === "docs" || !!handbookId);

  async function handleCreate() {
    setBusy(true);
    try {
      if (source === "handbook") {
        if (!handbookId) return;
        const selectedDocs = mdFiles
          .filter((f) => checked.has(f.docId))
          .map((f) => ({ docId: f.docId, relPath: f.relPath, title: f.title }))
          .sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
        const spaceId = await createStudySpace({ name: name.trim(), emoji, sourceType: "handbook", handbookId });
        const { unitCount, moduleCount } = await materializeHandbookSpace({ spaceId, handbookId, selectedDocs });
        toast.success(`Đã tạo "${name.trim()}" — ${moduleCount} module, ${unitCount} mục lộ trình`);
        onCreated(spaceId);
      } else {
        const selectedDocs = looseDocs
          .filter((d) => checked.has(d._id))
          .map((d) => ({ docId: d._id, title: d.title, relPath: d.relPath ?? d.title }));
        const spaceId = await createStudySpace({ name: name.trim(), emoji, sourceType: "docs" });
        const { unitCount, moduleCount } = await materializeDocsSpace({ spaceId, selectedDocs });
        toast.success(`Đã tạo "${name.trim()}" — ${moduleCount} tài liệu, ${unitCount} mục lộ trình`);
        onCreated(spaceId);
      }
    } catch (e) {
      console.error(e);
      toast.error("Tạo không gian học thất bại — thử lại");
      setBusy(false);
    }
  }

  const selectAllRow = (total: number) => (
    <div className="flex items-center justify-between">
      <label className="text-[12px] font-medium text-muted-foreground">
        {source === "handbook" ? "File học" : "Tài liệu"} ({checked.size}/{total} chọn)
      </label>
      <div className="flex items-center gap-2 text-[11px]">
        <button onClick={() => setAll(true)} className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10">Chọn tất cả</button>
        <button onClick={() => setAll(false)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted">Bỏ chọn</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
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

          {/* Toggle nguồn */}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground">Nguồn học liệu</label>
            <div className="mt-1 flex gap-1 rounded-lg bg-muted/60 p-1">
              <button
                onClick={() => switchSource("handbook")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${source === "handbook" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BookOpen className="h-3.5 w-3.5" /> Handbook
              </button>
              <button
                onClick={() => switchSource("docs")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition-colors ${source === "docs" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <FileText className="h-3.5 w-3.5" /> Tài liệu lẻ
              </button>
            </div>
          </div>

          {/* HANDBOOK: chọn handbook + cây file markdown */}
          {source === "handbook" && (
            <>
              <div>
                <label className="text-[12px] font-medium text-muted-foreground">Chọn handbook</label>
                {activeHandbooks.length === 0 ? (
                  <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">
                    Chưa có handbook nào. Tạo handbook trong Thư viện, hoặc chuyển sang "Tài liệu lẻ".
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

              {handbookId && (
                <div>
                  {selectAllRow(mdFiles.length)}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Chỉ file markdown · chọn thư mục = chọn cả nhóm · phụ trợ bỏ tick sẵn</p>
                  {filesRaw === undefined ? (
                    <p className="mt-1 flex items-center gap-2 py-3 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nạp file…</p>
                  ) : mdFiles.length === 0 ? (
                    <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">Handbook này chưa có file markdown để học.</p>
                  ) : (
                    <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border p-1">
                      <FileTreeNodes nodes={tree} depth={0} checked={checked} onToggleLeaf={toggleLeaf} onToggleFolder={toggleFolder} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TÀI LIỆU LẺ: chọn doc markdown */}
          {source === "docs" && (
            <div>
              {selectAllRow(looseDocs.length)}
              <p className="mt-0.5 text-[11px] text-muted-foreground">Mỗi tài liệu = 1 module</p>
              {looseAll === undefined ? (
                <p className="mt-1 flex items-center gap-2 py-3 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nạp tài liệu…</p>
              ) : looseDocs.length === 0 ? (
                <p className="mt-1 rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">
                  Chưa có tài liệu lẻ dạng markdown. Tải markdown lên Thư viện, hoặc dùng handbook.
                </p>
              ) : (
                <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1.5">
                  {looseDocs.map((d) => (
                    <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <input type="checkbox" checked={checked.has(d._id)} onChange={() => toggleLeaf(d._id)} className="accent-primary" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{d.title}</span>
                    </label>
                  ))}
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
