"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen, LogOut, Settings, Trash2, Plus, Folder, FolderOpen,
  MoreVertical, Pencil, FolderPlus, ChevronRight, LayoutGrid,
  PanelLeftClose, PanelLeftOpen, ChevronDown, File as FileIcon, Menu, X,
  CheckSquare, FolderInput,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentGrid } from "@/components/library/DocumentGrid";
import { RecentHistory } from "@/components/library/RecentHistory";
import { FilterBar, parseFilters, hasActiveFilters } from "@/components/library/FilterBar";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { labels } from "@/lib/i18n/labels";

const L = labels.library;
const N = labels.nav;

type ViewScope = "all" | Id<"folders">;
interface Crumb { id: Id<"folders">; name: string }

export function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderParent, setCreateFolderParent] = useState<Id<"folders"> | undefined>();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Sidebar — desktop: open by default, mobile: closed by default
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const sidebarResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scope, setScope] = useState<ViewScope>("all");
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([]);
  const [renameFolderId, setRenameFolderId] = useState<Id<"folders"> | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFolderOpen, setBulkFolderOpen] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const allDocs = useQuery(api.documents.queries.listByUser);
  const allFolders = useQuery(api.folders.queries.listByUser);
  const allDocFolders = useQuery(api.folders.queries.listAllDocFolders);
  const folderDocs = useQuery(
    api.folders.queries.listDocsInFolder,
    scope !== "all" ? { folderId: scope } : "skip"
  );

  const subFolders = useMemo(
    () => scope !== "all" ? (allFolders?.filter((f: any) => f.parentFolderId === scope) ?? []) : [],
    [allFolders, scope]
  );

  const docsByFolder = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!allDocFolders || !allDocs) return map;
    for (const df of allDocFolders as any[]) {
      const doc = (allDocs as any[]).find((d) => d._id === df.docId && d.status === "ready");
      if (doc) {
        if (!map[df.folderId]) map[df.folderId] = [];
        map[df.folderId].push(doc);
      }
    }
    return map;
  }, [allDocFolders, allDocs]);

  const renameFolder = useMutation(api.folders.mutations.rename);
  const deleteFolder = useMutation(api.folders.mutations.deleteFolder);
  const createFolder = useMutation(api.folders.mutations.create);
  const trashDoc = useMutation(api.documents.mutations.trash);
  const assignDoc = useMutation(api.folders.mutations.assignDoc);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  // Sidebar resize (desktop only)
  const onSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizing.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!sidebarResizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = ev.clientX - rect.left;
      setSidebarWidth(Math.min(400, Math.max(160, w)));
    };
    const onUp = () => {
      sidebarResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const docsToShow = useMemo(() => {
    if (scope !== "all") return folderDocs ?? undefined;
    if (!allDocs) return undefined;
    let docs = allDocs;
    if (filters.formats.length > 0) docs = docs.filter((d: any) => filters.formats.includes(d.format));
    if (filters.from) {
      const from = new Date(filters.from).getTime();
      docs = docs.filter((d: any) => d.createdAt >= from);
    }
    if (filters.to) {
      const to = new Date(filters.to).getTime() + 86400000;
      docs = docs.filter((d: any) => d.createdAt <= to);
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
    } catch { toast.error("Đổi tên thất bại"); }
    setRenameFolderId(null);
  }

  async function handleDeleteFolder(folderId: Id<"folders">, name: string) {
    if (!confirm(`Xoá folder "${name}"? Tài liệu bên trong sẽ không bị xoá.`)) return;
    try {
      await deleteFolder({ folderId });
      if (scope === folderId) { setScope("all"); setBreadcrumbs([]); }
      toast.success("Đã xoá folder");
    } catch { toast.error("Xoá folder thất bại"); }
  }

  async function handleCreateFolder() {
    const name = createFolderName.trim();
    if (!name) return;
    setIsCreatingFolder(true);
    try {
      await createFolder({ name, parentFolderId: createFolderParent });
      toast.success(`Đã tạo folder "${name}"`);
      setCreateFolderName("");
      setCreateFolderOpen(false);
    } catch { toast.error("Tạo folder thất bại"); }
    finally { setIsCreatingFolder(false); }
  }

  async function handleBulkTrash() {
    if (!confirm(`Chuyển ${selectedIds.size} tài liệu vào thùng rác?`)) return;
    await Promise.all([...selectedIds].map(id => trashDoc({ docId: id as Id<"documents"> })));
    toast.success(`Đã chuyển ${selectedIds.size} tài liệu vào thùng rác`);
    clearSelection();
  }

  async function handleBulkAssignFolder(folderId: Id<"folders">) {
    await Promise.all([...selectedIds].map(id => assignDoc({ docId: id as Id<"documents">, folderId })));
    toast.success(`Đã chuyển ${selectedIds.size} tài liệu vào folder`);
    setBulkFolderOpen(false);
    clearSelection();
  }

  function navigateToFolder(folder: { _id: Id<"folders">; name: string }, parentId?: Id<"folders">) {
    setScope(folder._id);
    setMobileSidebarOpen(false);
    if (parentId) {
      const parentIndex = breadcrumbs.findIndex(c => c.id === parentId);
      if (parentIndex >= 0) {
        setBreadcrumbs([...breadcrumbs.slice(0, parentIndex + 1), { id: folder._id, name: folder.name }]);
      } else {
        const parent = allFolders?.find((f: any) => f._id === parentId);
        setBreadcrumbs(parent ? [{ id: parentId, name: parent.name }, { id: folder._id, name: folder.name }] : [{ id: folder._id, name: folder.name }]);
      }
    } else {
      setBreadcrumbs([{ id: folder._id, name: folder.name }]);
    }
  }

  function toggleExpanded(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!session) return null;

  const currentFolder = allFolders?.find((f: any) => f._id === scope);
  const isFiltered = scope === "all" && hasActiveFilters(filters);
  const rootFolders = allFolders?.filter((f: any) => !f.parentFolderId) ?? [];

  // Sidebar tree node
  function FolderNode({ folder, depth = 0 }: { folder: any; depth?: number }) {
    const isActive = scope === folder._id;
    const subfolders = allFolders?.filter((f: any) => f.parentFolderId === folder._id) ?? [];
    const docsInFolder = docsByFolder[folder._id] ?? [];
    const hasChildren = subfolders.length > 0 || docsInFolder.length > 0;
    const isExpanded = expandedFolders.has(folder._id);

    return (
      <div>
        <div className="group flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
          <button
            onClick={() => toggleExpanded(folder._id)}
            className={`shrink-0 rounded p-0.5 transition-colors ${hasChildren ? "hover:bg-muted text-muted-foreground" : "invisible"}`}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </button>

          <button
            onClick={() => navigateToFolder(folder, folder.parentFolderId)}
            className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors min-w-0 ${
              isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
            }`}
          >
            {isActive
              ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            }
            <span className="flex-1 truncate text-left text-xs">{folder.name}</span>
          </button>

          {/* 3-dot: visible always on mobile (no hover), hover on desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 rounded p-1 hover:bg-muted transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Tuỳ chọn folder"
            >
              <MoreVertical className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => { setCreateFolderParent(folder._id); setCreateFolderOpen(true); }}>
                <FolderPlus className="mr-2 h-3.5 w-3.5" /> Tạo subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRenameFolderId(folder._id); setRenameFolderName(folder.name); }}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Đổi tên
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDeleteFolder(folder._id, folder.name)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExpanded && (
          <>
            {subfolders.map((sub: any) => (
              <FolderNode key={sub._id} folder={sub} depth={depth + 1} />
            ))}
            {docsInFolder.map((doc: any) => (
              <button
                key={doc._id}
                onClick={() => { router.push(`/reader/${doc._id}`); setMobileSidebarOpen(false); }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted"
                style={{ paddingLeft: (depth + 1) * 16 + 16 }}
                title={doc.title}
              >
                <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">{doc.title}</span>
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  // Shared sidebar content
  const SidebarContent = () => (
    <div className="space-y-1">
      <button
        onClick={() => { setScope("all"); setBreadcrumbs([]); setMobileSidebarOpen(false); }}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          scope === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
        }`}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">Tất cả tài liệu</span>
        {allDocs && (
          <span className={`text-xs tabular-nums ${scope === "all" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {allDocs.length}
          </span>
        )}
      </button>

      <div className="pt-3 pb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</span>
        <button
          onClick={() => { setCreateFolderParent(undefined); setCreateFolderOpen(true); }}
          className="rounded p-0.5 hover:bg-muted transition-colors"
          title="Tạo folder mới"
        >
          <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {(!allFolders || allFolders.length === 0) && (
        <p className="px-3 py-2 text-xs text-muted-foreground">Chưa có folder nào</p>
      )}
      {rootFolders.map((folder: any) => (
        <FolderNode key={folder._id} folder={folder} />
      ))}

      <div className="pt-3">
        <Button
          variant="ghost" size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => { router.push("/library/trash"); setMobileSidebarOpen(false); }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Thùng rác
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar — full width */}
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            {/* Mobile: hamburger để mở drawer */}
            <button
              onClick={() => setMobileSidebarOpen(v => !v)}
              className="mr-1 rounded p-1.5 hover:bg-muted transition-colors md:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-4 w-4 text-muted-foreground" />
            </button>
            {/* Desktop: toggle sidebar */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="mr-1 rounded p-1.5 hover:bg-muted transition-colors hidden md:flex"
              aria-label={sidebarOpen ? "Ẩn sidebar" : "Hiện sidebar"}
            >
              {sidebarOpen
                ? <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                : <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Web Knowledge Base</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <Button variant="secondary" size="sm" aria-current={true}>{N.library}</Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/notes")}>{N.notes}</Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
              <Settings className="mr-1 h-4 w-4" />{N.settings}
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{session.user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="ml-1 hidden md:inline">{N.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar drawer overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-background border-r shadow-xl overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">Điều hướng</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded p-1.5 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main layout — full width */}
      <div ref={containerRef} className="flex px-4 md:px-6 py-6" style={{ gap: 0 }}>

        {/* Desktop sidebar */}
        {sidebarOpen && (
          <>
            <aside
              style={{ width: sidebarWidth, minWidth: sidebarWidth }}
              className="hidden md:block shrink-0 mr-0"
            >
              <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-6rem)]">
                <SidebarContent />
              </div>
            </aside>
            {/* Resize handle */}
            <div
              onMouseDown={onSidebarMouseDown}
              className="hidden md:block w-1.5 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors rounded-full mx-1"
            />
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Page header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {breadcrumbs.length > 0 ? (
                <div className="flex items-center gap-1 text-sm flex-wrap">
                  <button onClick={() => { setScope("all"); setBreadcrumbs([]); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    Thư viện
                  </button>
                  {breadcrumbs.map((crumb, i) => (
                    <span key={crumb.id} className="flex items-center gap-1">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {i === breadcrumbs.length - 1 ? (
                        <span className="font-semibold text-foreground">{crumb.name}</span>
                      ) : (
                        <button
                          onClick={() => { setScope(crumb.id); setBreadcrumbs(breadcrumbs.slice(0, i + 1)); }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {crumb.name}
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <h1 className="text-xl font-bold truncate">
                  {scope === "all" ? L.title : currentFolder?.name ?? "Folder"}
                </h1>
              )}
              {scope === "all" && allDocs && (
                <p className="text-xs text-muted-foreground mt-0.5">{allDocs.length} tài liệu</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline" size="sm"
                onClick={() => { setCreateFolderParent(scope !== "all" ? scope : undefined); setCreateFolderOpen(true); }}
                className="hidden sm:flex"
              >
                <FolderPlus className="mr-1.5 h-4 w-4" />
                Tạo folder
              </Button>
              <Button onClick={() => setUploadOpen(true)} size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">{L.uploadButton}</span>
                <span className="sm:hidden">Thêm</span>
              </Button>
            </div>
          </div>

          {/* Filter bar — scroll ngang trên mobile */}
          {scope === "all" && !isFiltered && <RecentHistory />}
          {scope === "all" && (
            <div className="mb-4 -mx-1 px-1 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max pb-1">
                <FilterBar filters={filters} />
              </div>
            </div>
          )}

          {/* Subfolders row */}
          {scope !== "all" && subFolders.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folder con</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {subFolders.map((sub: any) => (
                  <button
                    key={sub._id}
                    onClick={() => navigateToFolder(sub, scope)}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="flex-1 truncate text-sm font-medium">{sub.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <DocumentGrid
            docs={docsToShow}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUploadClick={() => setUploadOpen(true)}
            isFiltered={isFiltered}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </main>
      </div>

      {/* Bulk action toolbar — nổi ở bottom khi có selection */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border bg-background shadow-2xl px-4 py-3">
          <span className="text-sm font-medium text-foreground mr-1">
            {selectedIds.size} đã chọn
          </span>

          {/* Chuyển vào folder */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
              <FolderInput className="h-4 w-4" />
              Chuyển folder
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-48 max-h-64 overflow-y-auto">
              {(!allFolders || allFolders.length === 0) ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Chưa có folder nào</p>
              ) : (
                allFolders.map((f: any) => (
                  <DropdownMenuItem key={f._id} onClick={() => handleBulkAssignFolder(f._id)}>
                    <Folder className="mr-2 h-4 w-4 text-amber-500" />
                    {f.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Xoá vào thùng rác */}
          <Button variant="destructive" size="sm" onClick={handleBulkTrash}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Xoá
          </Button>

          {/* Bỏ chọn */}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.upload.title}</DialogTitle>
          </DialogHeader>
          <UploadDropzone
            onUploadComplete={() => setUploadOpen(false)}
            defaultFolderId={scope !== "all" ? scope : undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog open={createFolderOpen} onOpenChange={(v) => { setCreateFolderOpen(v); if (!v) setCreateFolderName(""); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {createFolderParent
                ? `Tạo subfolder trong "${allFolders?.find((f: any) => f._id === createFolderParent)?.name}"`
                : "Tạo folder mới"
              }
            </DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={createFolderName}
            onChange={(e) => setCreateFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
            placeholder="Tên folder..."
            maxLength={100}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(false)}>Huỷ</Button>
            <Button size="sm" disabled={!createFolderName.trim() || isCreatingFolder} onClick={handleCreateFolder}>
              <FolderPlus className="mr-1.5 h-4 w-4" />
              Tạo
            </Button>
          </div>
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
