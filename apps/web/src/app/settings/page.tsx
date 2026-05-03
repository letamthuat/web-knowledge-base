"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Database, HardDrive, FileText, StickyNote, Loader2, ArchiveIcon, Search } from "lucide-react";
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

// Free tier limits
const CONVEX_DB_LIMIT = 1 * 1024 * 1024 * 1024;       // 1 GB
const CONVEX_FILE_LIMIT = 1 * 1024 * 1024 * 1024;     // 1 GB
const R2_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;     // 10 GB

export default function SettingsPage() {
  const router = useRouter();
  const deleteAccount = useAction(api.users.actions.deleteAccount);
  const backfillExtractText = useAction(api.documents.actions.backfillExtractText);
  const stats = useQuery(api.documents.queries.getStorageStats);
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
              {/* Summary counts */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tài liệu</span>
                  </div>
                  <p className="text-xl font-bold">{stats.docCount}</p>
                  {stats.trashedCount > 0 && (
                    <p className="text-xs text-muted-foreground">{stats.trashedCount} trong thùng rác</p>
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
                {/* R2 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
                    Cloudflare R2 — File lớn (PDF, EPUB, video...)
                  </p>
                  <UsageBar used={stats.r2Bytes} total={R2_STORAGE_LIMIT} label="Dung lượng R2" />
                  <p className="text-xs text-muted-foreground">Free tier: 10 GB lưu trữ · 1M lượt upload · 10M lượt đọc /tháng</p>
                </div>

                <div className="border-t" />

                {/* Convex file storage */}
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

                {/* Convex DB */}
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
            Tải xuống toàn bộ tài liệu và ghi chú dưới dạng file ZIP. Bao gồm file gốc của tài liệu, tất cả ghi chú (.md) và highlights.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={downloadBackup} disabled={isDownloading} className="gap-2">
              {isDownloading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang chuẩn bị...</>
              ) : (
                <><ArchiveIcon className="h-4 w-4" /> Tải xuống toàn bộ</>
              )}
            </Button>
            {stats && (
              <span className="text-xs text-muted-foreground">
                {stats.docCount} tài liệu · {stats.noteCount} ghi chú
              </span>
            )}
          </div>
        </div>

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
