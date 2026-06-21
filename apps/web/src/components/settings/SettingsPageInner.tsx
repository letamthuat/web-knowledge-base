"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/_generated/api";
import { useAiSettings, saveAiSettings } from "@/lib/api/ai-settings";
import { useStorageStats } from "@/lib/api/documents";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Database, HardDrive, FileText, StickyNote, Loader2, ArchiveIcon, Search, Bot, Eye, EyeOff } from "lucide-react";
import { useBackupDownload } from "@/hooks/useBackupDownload";
import { SearchModal } from "@/components/search/SearchModal";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function UsageBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatBytes(used)} <span className="text-muted-foreground font-normal">/ {formatBytes(total)}</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}% đã sử dụng</p>
    </div>
  );
}

const CONVEX_DB_LIMIT = 1 * 1024 * 1024 * 1024;
const CONVEX_FILE_LIMIT = 1 * 1024 * 1024 * 1024;
const R2_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

function AiSettingsSection() {
  const aiSettings = useAiSettings();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const dragIndex = useRef<number | null>(null);

  // Populate from saved settings once loaded
  useEffect(() => {
    if (aiSettings === undefined) return; // still loading
    if (aiSettings) {
      setApiKey(aiSettings.geminiApiKey ?? "");
      setModels(aiSettings.geminiModels ?? []);
    }
  }, [aiSettings]);

  async function handleFetchModels() {
    if (!apiKey.trim()) {
      toast.error("Vui lòng nhập API key trước");
      return;
    }
    setFetchingModels(true);
    try {
      const res = await fetch("/api/gemini-list-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
      const fetched: string[] = data.models ?? [];
      setAvailableModels(fetched);
      // Keep existing order for already-selected models, append new ones
      const newModels = fetched.filter((m) => !models.includes(m));
      setModels((prev) => [...prev.filter((m) => fetched.includes(m)), ...newModels]);
      toast.success(`Tìm thấy ${fetched.length} models`);
    } catch (e: any) {
      toast.error("Không thể lấy models: " + e.message);
    } finally {
      setFetchingModels(false);
    }
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setModels((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setModels((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function toggleModel(model: string) {
    setModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  }

  function toggleSelect(model: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(model) ? next.delete(model) : next.add(model);
      return next;
    });
  }

  function deleteSelected() {
    setModels((prev) => prev.filter((m) => !selected.has(m)));
    setSelected(new Set());
  }

  function onDragStart(i: number) {
    dragIndex.current = i;
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    setModels((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(i, 0, item);
      return next;
    });
    dragIndex.current = i;
  }

  function onDragEnd() {
    dragIndex.current = null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveAiSettings({
        geminiApiKey: apiKey.trim() || undefined,
        geminiModels: models.length > 0 ? models : undefined,
      });
      toast.success("Đã lưu cài đặt AI");
    } catch (e: any) {
      toast.error("Lưu thất bại: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const isConfigured = !!(aiSettings?.geminiApiKey);

  return (
    <div className="mb-6 rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Trợ lý AI
        </h2>
        {aiSettings !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isConfigured ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
            {isConfigured ? `Đã cấu hình · ${aiSettings.geminiModels?.length ?? 0} models` : "Chưa cấu hình"}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Nhập Gemini API key của bạn để sử dụng tính năng tạo transcript. Key lưu trên server của bạn, không chia sẻ với bên thứ ba.
      </p>

      {/* API Key input */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Gemini API Key</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            variant="outline"
            disabled={fetchingModels}
            onClick={handleFetchModels}
            className="shrink-0"
          >
            {fetchingModels ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Đang kiểm tra...</> : "Kiểm tra & lấy models"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lấy API key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a>
        </p>
      </div>

      {/* Models list */}
      {models.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Thứ tự fallback models</label>
            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                className="text-xs text-destructive hover:underline"
              >
                Xóa {selected.size} đã chọn
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">Kéo thả để sắp xếp. Tích chọn nhiều rồi xóa cùng lúc.</p>
            <button
              onClick={() => setSelected(selected.size === models.length ? new Set() : new Set(models))}
              className="text-xs text-muted-foreground hover:underline shrink-0"
            >
              {selected.size === models.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          </div>
          <div className="space-y-1.5">
            {models.map((model, i) => (
              <div
                key={model}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${selected.has(model) ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(model)}
                  onChange={() => toggleSelect(model)}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                <span className="flex-1 text-sm font-mono">{model}</span>
                <button
                  onClick={() => { setModels((p) => p.filter((m) => m !== model)); setSelected((p) => { const n = new Set(p); n.delete(model); return n; }); }}
                  className="text-xs text-destructive hover:underline shrink-0"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
          {/* Show available models not yet in list */}
          {availableModels.filter((m) => !models.includes(m)).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Models chưa được thêm:</p>
              {availableModels
                .filter((m) => !models.includes(m))
                .map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleModel(m)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-xs border rounded px-1">+</span>
                    <span className="font-mono">{m}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : "Lưu cài đặt AI"}
      </Button>
    </div>
  );
}

export function SettingsPageInner() {
  const router = useRouter();
  const deleteAccount = useAction(api.users.actions.deleteAccount);
  const backfillExtractText = useAction(api.documents.actions.backfillExtractText);
  const stats = useStorageStats();
  const { downloadBackup, isDownloading } = useBackupDownload();
  const [confirm, setConfirm] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const CONFIRM_WORD = "XÓA TÀI KHOẢN";

  async function handleDelete() {
    if (input !== CONFIRM_WORD) return;
    setLoading(true);
    try {
      await deleteAccount({});
      await signOut();
      toast.success("Tài khoản đã được xóa hoàn toàn");
      router.replace("/login");
    } catch (e: any) {
      toast.error("Xóa thất bại: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-14 md:pb-0">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-8" onClick={() => router.push("/library")}>
          ← Quay lại thư viện
        </Button>

        <h1 className="mb-8 text-2xl font-bold">Cài đặt tài khoản</h1>

        {/* Storage stats */}
        <div className="mb-6 rounded-xl border bg-card p-6 space-y-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Dung lượng lưu trữ
          </h2>
          {stats === undefined ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : stats === null ? (
            <p className="text-sm text-muted-foreground">Không thể tải dữ liệu</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tài liệu</span>
                  </div>
                  <p className="text-xl font-bold">{stats.docCount}</p>
                  {stats.trashedCount > 0 && (
                    <button
                      onClick={() => router.push("/library/trash")}
                      className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors mt-0.5"
                    >
                      {stats.trashedCount} trong thùng rác (xem)
                    </button>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Ghi chú</span>
                  </div>
                  <p className="text-xl font-bold">{stats.noteCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tổng file</span>
                  </div>
                  <p className="text-xl font-bold">{formatBytes(stats.r2Bytes + stats.convexFileBytes)}</p>
                </div>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
                    Cloudflare R2 — File lớn (PDF, EPUB, video...)
                  </p>
                  <UsageBar used={stats.r2Bytes} total={R2_STORAGE_LIMIT} label="Dung lượng R2" />
                  <p className="text-xs text-muted-foreground">Free tier: 10 GB lưu trữ · 1M lượt upload · 10M lượt đọc /tháng</p>
                </div>
                <div className="border-t" />
                {stats.convexFileBytes > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                      Convex File Storage — File nhỏ (≤ 5 MB)
                    </p>
                    <UsageBar used={stats.convexFileBytes} total={CONVEX_FILE_LIMIT} label="File storage" />
                    <p className="text-xs text-muted-foreground">Free tier: 1 GB</p>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
                    Convex Database — Ghi chú & metadata
                  </p>
                  <UsageBar used={stats.convexDbBytes} total={CONVEX_DB_LIMIT} label="Database" />
                  <p className="text-xs text-muted-foreground">Free tier: 1 GB · Ước tính từ nội dung ghi chú</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Search re-index */}
        <div className="mb-6 rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Tìm kiếm
          </h2>
          <p className="text-sm text-muted-foreground">
            Tài liệu upload trước khi tính năng tìm kiếm được bật cần được index lại. Bấm nút bên dưới để index tất cả tài liệu chưa được index.
          </p>
          <Button
            variant="outline"
            disabled={reindexing}
            className="gap-2"
            onClick={async () => {
              setReindexing(true);
              try {
                const { scheduled, total } = await backfillExtractText({});
                if (scheduled === 0) {
                  toast.success(`Tất cả ${total} tài liệu đã được index`);
                } else {
                  toast.success(`Đang index ${scheduled}/${total} tài liệu — kết quả sẽ xuất hiện sau vài giây`);
                }
              } catch {
                toast.error("Không thể index tài liệu");
              } finally {
                setReindexing(false);
              }
            }}
          >
            {reindexing ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang index...</> : <><Search className="h-4 w-4" /> Re-index tài liệu</>}
          </Button>
        </div>

        {/* Backup */}
        <div className="mb-6 rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ArchiveIcon className="h-4 w-4 text-muted-foreground" />
            Sao lưu dữ liệu
          </h2>
          <p className="text-sm text-muted-foreground">
            Export toàn bộ tài liệu, ghi chú và highlights dưới dạng ZIP tương thích Obsidian. Bao gồm file gốc, highlights.md per tài liệu, notes với frontmatter, và data.json.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={downloadBackup} disabled={isDownloading} className="gap-2">
              {isDownloading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang chuẩn bị...</>
              ) : (
                <><ArchiveIcon className="h-4 w-4" /> Export ZIP (Obsidian)</>
              )}
            </Button>
            {stats && (
              <span className="text-xs text-muted-foreground">
                {stats.docCount} tài liệu · {stats.noteCount} ghi chú
              </span>
            )}
          </div>
        </div>

        {/* AI Settings */}
        <AiSettingsSection />

        {/* Danger zone */}
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-semibold">Vùng nguy hiểm</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ tài liệu, ghi chú, transcript, lịch sử đọc và mọi dữ liệu liên quan. <strong>Không thể khôi phục.</strong>
          </p>
          {!confirm ? (
            <Button variant="destructive" onClick={() => setConfirm(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa tài khoản
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Gõ <span className="font-mono text-destructive">{CONFIRM_WORD}</span> để xác nhận:
              </p>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={input !== CONFIRM_WORD || loading}
                  onClick={handleDelete}
                >
                  {loading ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
                <Button variant="ghost" onClick={() => { setConfirm(false); setInput(""); }}>
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
