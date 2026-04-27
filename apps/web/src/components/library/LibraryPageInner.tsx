"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen, LogOut, Settings, Trash2, Plus, Folder, FolderOpen,
  MoreVertical, Pencil, FolderPlus, ChevronRight, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../../convex/_generated/api";
import { Id } from "@/../../../convex/_generated/dataModel";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentGrid } from "@/components/library/DocumentGrid";
import { FilterBar, parseFilters, hasActiveFilters } from "@/components/library/FilterBar";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { labels } from "@/lib/i18n/labels";

const L = labels.library;
const N = labels.nav;

type ViewScope = "all" | Id<"folders">;

export function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scope, setScope] = useState<ViewScope>("all");
  const [renameFolderId, setRenameFolderId] = useState<Id<"folders"> | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const allDocs = useQuery(api.documents.queries.listByUser);
  const allFolders = useQuery(api.folders.queries.listByUser);
  const folderDocs = useQuery(
    api.folders.queries.listDocsInFolder,
    scope !== "all" ? { folderId: scope } : "skip"
  );

  const renameFolder = useMutation(api.folders.mutations.rename);
  const deleteFolder = useMutation(api.folders.mutations.deleteFolder);

  const docsToShow = useMemo(() => {
    if (scope !== "all") return folderDocs ?? undefined;
    if (!allDocs) return undefined;
    if (allDocs === null) return [];
    let docs = allDocs;
    if (filters.formats.length > 0) docs = docs.filter((d) => filters.formats.includes(d.format));
    if (filters.from) {
      const from = new Date(filters.from).getTime();
      docs = docs.filter((d) => d.createdAt >= from);
    }
    if (filters.to) {
      const to = new Date(filters.to).getTime() + 86400000;
      docs = docs.filter((d) => d.createdAt <= to);
    }
    return docs;
  }, [scope, folderDocs, allDocs, filters]);

  async function handleLogout() {
    await signOut();
    toast.success(labels.auth.success.logoutSuccess);
    router.replace("/login");
  }

  async function handleRenameFolder() {
    if (!renameFolderId || !renameFolderName.trim()) return;
    try {
      await renameFolder({ folderId: renameFolderId, name: renameFolderName.trim() });
      toast.success("Đã đổi tên folder");
    } catch {
      toast.error("Đổi tên thất bại");
    }
    setRenameFolderId(null);
  }

  async function handleDeleteFolder(folderId: Id<"folders">, name: string) {
    if (!confirm(`Xoá folder "${name}"? Tài liệu bên trong sẽ không bị xoá.`)) return;
    try {
      await deleteFolder({ folderId });
      if (scope === folderId) setScope("all");
      toast.success("Đã xoá folder");
    } catch {
      toast.error("Xoá folder thất bại");
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!session) return null;

  const currentFolder = allFolders?.find((f) => f._id === scope);
  const isFiltered = scope === "all" && hasActiveFilters(filters);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" aria-hidden />
            </div>
            <span className="font-semibold">Web Knowledge Base</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <Button variant="secondary" size="sm" aria-current={true}>{N.library}</Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/notes")}>{N.notes}</Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
              <Settings className="mr-1 h-4 w-4" aria-hidden />{N.settings}
            </Button>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{session.user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Đăng xuất">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="ml-1 hidden md:inline">{N.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-0 px-4 py-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 mr-6">
          <div className="sticky top-20 space-y-1">
            {/* All docs */}
            <button
              onClick={() => setScope("all")}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                scope === "all"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left truncate">Tất cả tài liệu</span>
              {allDocs && allDocs !== null && (
                <span className={`text-xs tabular-nums ${scope === "all" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {allDocs.length}
                </span>
              )}
            </button>

            {/* Divider + Folders label */}
            <div className="pt-3 pb-1 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</span>
              <button
                onClick={() => setUploadOpen(true)}
                className="rounded p-0.5 hover:bg-muted transition-colors"
                title="Tạo folder mới"
                aria-label="Tạo folder mới"
              >
                <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Folder list */}
            {(!allFolders || allFolders.length === 0) && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Chưa có folder nào</p>
            )}
            {allFolders?.map((folder) => {
              const isActive = scope === folder._id;
              return (
                <div key={folder._id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setScope(folder._id)}
                    className={`flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors min-w-0 ${
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {isActive
                      ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                      : <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    }
                    <span className="flex-1 truncate text-left">{folder.name}</span>
                    <ChevronRight className={`h-3 w-3 shrink-0 transition-opacity ${isActive ? "opacity-70" : "opacity-0 group-hover:opacity-50"}`} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition-all" aria-label="Tuỳ chọn folder">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => { setRenameFolderId(folder._id); setRenameFolderName(folder.name); }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Đổi tên
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteFolder(folder._id, folder.name)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            {/* Divider */}
            <div className="pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => router.push("/library/trash")}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Thùng rác
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">
                {scope === "all" ? L.title : currentFolder?.name ?? "Folder"}
              </h1>
              {scope === "all" && allDocs && allDocs !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">{allDocs.length} tài liệu</p>
              )}
            </div>
            <Button onClick={() => setUploadOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {L.uploadButton}
            </Button>
          </div>

          {/* Filter bar — chỉ khi xem "Tất cả" */}
          {scope === "all" && (
            <div className="mb-5">
              <FilterBar filters={filters} />
            </div>
          )}

          {/* Document grid */}
          <DocumentGrid
            docs={docsToShow}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUploadClick={() => setUploadOpen(true)}
            isFiltered={isFiltered}
          />
        </main>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.upload.title}</DialogTitle>
          </DialogHeader>
          <UploadDropzone onUploadComplete={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog open={!!renameFolderId} onOpenChange={(v) => !v && setRenameFolderId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Đổi tên folder</DialogTitle></DialogHeader>
          <input
            value={renameFolderName}
            onChange={(e) => setRenameFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(); }}
            placeholder="Tên folder..."
            maxLength={100}
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenameFolderId(null)}>Huỷ</Button>
            <Button size="sm" onClick={handleRenameFolder}>Lưu</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
