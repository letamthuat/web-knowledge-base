"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, LogOut, Settings, StickyNote, List, Upload, Download, X, Menu, Search } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/tabs/TabBar";
import { NoteList } from "@/components/notes/NoteList";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ProgressSaveIndicator } from "@/components/viewers/ProgressSaveIndicator";
import { useAllNotes } from "@/hooks/useNotes";
import { useNoteTabs } from "@/hooks/useNoteTabs";
import type { SaveStatus } from "@/hooks/useReadingProgress";
import { Id } from "@/_generated/dataModel";
import { SearchModal } from "@/components/search/SearchModal";
import { labels } from "@/lib/i18n/labels";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { useAppTypography } from "@/components/AppSettingsPanel";
import { BottomSheet } from "@/components/ui/BottomSheet";

const N = labels.nav;

export function NotesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const { notes, addNote, updateNote, removeNote } = useAllNotes();
  const [newNoteId, setNewNoteId] = useState<Id<"notes"> | null>(null);
  const [pendingNoteId, setPendingNoteId] = useState<Id<"notes"> | null>(null);
  const { noteTabs, activeNoteId: convexActiveNoteId, openNoteTab, closeNoteTab, updateNoteTabTitle, setActiveNoteId } = useNoteTabs();
  // Use pendingNoteId as optimistic active note while Convex reactive query catches up
  const activeNoteId = pendingNoteId ?? convexActiveNoteId;
  // Clear pending once Convex reflects the change
  useEffect(() => {
    if (pendingNoteId && convexActiveNoteId === pendingNoteId) {
      setPendingNoteId(null);
    }
  }, [convexActiveNoteId, pendingNoteId]);
  const { setActivePanel } = useActiveTab();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const typography = useAppTypography();

  // On desktop, default sidebar open; track mobile
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    if (!mq.matches) setSidebarOpen(true);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Cmd/Ctrl+K
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

  // Auto-select note from ?note=id URL param (navigated from search result)
  useEffect(() => {
    const noteId = searchParams.get("note");
    if (!noteId || !(notes as any[]).length) return;
    const note = (notes as any[]).find((n: any) => n._id === noteId);
    if (note) {
      openNoteTab(note._id as Id<"notes">, note.title ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, (notes as any[]).length]);
  const [noteSaveStatus, setNoteSaveStatus] = useState<SaveStatus>("saved");
  const noteSaveNowRef = useRef<(() => void) | null>(null);
  const noteImportRef = useRef<HTMLInputElement | null>(null);
  const noteExportRef = useRef<(() => void) | null>(null);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleSelect = useCallback((id: Id<"notes">) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = (notes as any[]).find((n) => n._id === id);
    setPendingNoteId(id);
    openNoteTab(id, note?.title ?? "");
    setNoteSaveStatus("saved");
  }, [notes, openNoteTab]);

  const handleNew = useCallback(async () => {
    console.log("[handleNew] called");
    try {
      const id = await addNote("[]", "");
      console.log("[handleNew] addNote returned:", id);
      if (id) {
        const noteId = id as Id<"notes">;
        setNewNoteId(noteId);
        setPendingNoteId(noteId);
        openNoteTab(noteId, "");
        console.log("[handleNew] openNoteTab called for", noteId);
      } else {
        console.warn("[handleNew] addNote returned falsy:", id);
      }
    } catch (err) {
      console.error("[handleNew] error:", err);
      toast.error("Không thể tạo ghi chú");
    }
  }, [addNote, openNoteTab]);

  const handleDelete = useCallback(async (id: Id<"notes">) => {
    try {
      await removeNote(id);
      closeNoteTab(id);
    } catch {
      toast.error("Không thể xoá ghi chú");
    }
  }, [removeNote, closeNoteTab]);

  const handleUpdate = useCallback(async (id: Id<"notes">, body: string, title: string) => {
    await updateNote(id, body, title);
    updateNoteTabTitle(id, title);
  }, [updateNote, updateNoteTabTitle]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedNote = (notes as any[]).find((n) => n._id === activeNoteId) ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Mobile nav drawer */}
      {navDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-background border-r shadow-xl flex flex-col p-4 gap-1">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Menu</span>
              <button onClick={() => setNavDrawerOpen(false)} className="rounded p-1.5 hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => { setNavDrawerOpen(false); setActivePanel("library"); window.history.pushState(null, "", "/library"); }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <BookOpen className="h-4 w-4" /> {N.library}
            </button>
            <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-muted font-medium transition-colors">
              <StickyNote className="h-4 w-4" /> {N.notes}
            </button>
            <button onClick={() => { setNavDrawerOpen(false); setSearchOpen(true); }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Search className="h-4 w-4" /> Tìm kiếm
            </button>
            <button onClick={() => { setNavDrawerOpen(false); setActivePanel("settings"); window.history.pushState(null, "", "/settings"); }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Settings className="h-4 w-4" /> {N.settings}
            </button>
          </aside>
        </div>
      )}

      {/* Navbar */}
      <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-2" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="md:hidden p-1.5" onClick={() => setNavDrawerOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <AppLogo size={32} />
          <span className="font-semibold hidden md:inline">Web Knowledge Base</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" onMouseEnter={() => router.prefetch("/library")} onClick={() => { setActivePanel("library"); window.history.pushState(null, "", "/library"); }}>{N.library}</Button>
          <Button variant="secondary" size="sm" aria-current={true}>
            <StickyNote className="mr-1.5 h-3.5 w-3.5" />
            {N.notes}
          </Button>
          <Button variant="ghost" size="sm" onMouseEnter={() => router.prefetch("/settings")} onClick={() => { setActivePanel("settings"); window.history.pushState(null, "", "/settings"); }}>
            <Settings className="mr-1 h-4 w-4" />{N.settings}
          </Button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            Tìm kiếm
            <kbd className="ml-1 rounded border bg-background px-1 py-px text-[10px]">⌘K</kbd>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:inline">{session?.user?.email}</span>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex md:hidden items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Tìm kiếm"
          >
            <Search className="h-4 w-4" />
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="ml-1 hidden md:inline">{N.logout}</span>
          </Button>
        </div>
      </header>

      {/* Tab bar */}
      <TabBar
        currentDocId={null}
        showAddButton
        notesActive
        noteTabs={noteTabs}
        activeNoteId={activeNoteId}
        onSelectNoteTab={(id) => {
          const note = (notes as any[]).find((n) => n._id === id);
          setPendingNoteId(id as Id<"notes">);
          openNoteTab(id as Id<"notes">, note?.title ?? "");
        }}
        onCloseNoteTab={(id) => {
          closeNoteTab(id as Id<"notes">);
        }}
      />

      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
        <div>
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setSidebarOpen(v => !v)}>
            <List className="h-3.5 w-3.5" />
            {sidebarOpen ? "Ẩn danh sách" : "Danh sách"}
          </Button>
        </div>
        {selectedNote && (
          <div className="flex items-center gap-1">
            <ProgressSaveIndicator status={noteSaveStatus} onSaveNow={() => noteSaveNowRef.current?.()} />
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => noteImportRef.current?.click()} title="Nhập từ .md">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">.md</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => noteExportRef.current?.()} title="Xuất .md">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">.md</span>
            </Button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative flex flex-1 min-h-0 pb-14 md:pb-0">
        {/* Sidebar — BottomSheet on mobile, inline on desktop */}
        {isMobile ? (
          <BottomSheet open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="Danh sách ghi chú">
            <NoteList
              notes={notes}
              selectedId={activeNoteId as Id<"notes"> | null}
              onSelect={(id) => { handleSelect(id); setSidebarOpen(false); }}
              onNew={handleNew}
              onDelete={handleDelete}
            />
          </BottomSheet>
        ) : (
          sidebarOpen && (
            <NoteList
              notes={notes}
              selectedId={activeNoteId as Id<"notes"> | null}
              onSelect={handleSelect}
              onNew={handleNew}
              onDelete={handleDelete}
            />
          )
        )}

        {!selectedNote && activeNoteId && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {selectedNote ? (
          <NoteEditor
            key={selectedNote._id}
            noteId={selectedNote._id}
            initialTitle={selectedNote.title ?? ""}
            initialBody={selectedNote.body}
            docTitle={selectedNote.docTitle}
            docId={selectedNote.docId ?? null}
            onUpdate={handleUpdate}
            autoFocusTitle={newNoteId === selectedNote._id}
            onSaveStateChange={setNoteSaveStatus}
            importRef={noteImportRef}
            onExport={noteExportRef}
            saveNowRef={noteSaveNowRef}
            typography={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize, lineHeight: typography.lineHeight, colWidthClass: typography.colWidthClass }}
            colorScheme={typography.colorScheme}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <StickyNote className="h-12 w-12 opacity-20" />
            <p className="text-sm">Chọn một ghi chú hoặc tạo mới</p>
            <Button variant="outline" size="sm" onClick={handleNew}>
              + Ghi chú mới
            </Button>
          </div>
        )}
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
