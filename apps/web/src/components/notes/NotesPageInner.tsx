"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Settings, StickyNote, List, Upload, Download, X, Menu } from "lucide-react";
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
import { labels } from "@/lib/i18n/labels";

const N = labels.nav;

export function NotesPageInner() {
  const router = useRouter();
  const { data: session } = useSession();
  const { notes, addNote, updateNote, removeNote } = useAllNotes();
  const [newNoteId, setNewNoteId] = useState<Id<"notes"> | null>(null);
  const { noteTabs, activeNoteId, openNoteTab, closeNoteTab, updateNoteTabTitle, setActiveNoteId } = useNoteTabs();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  // On desktop, default sidebar open
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);
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
    openNoteTab(id, note?.title ?? "");
    setActiveNoteId(id);
    setNoteSaveStatus("saved");
  }, [notes, openNoteTab, setActiveNoteId]);

  const handleNew = useCallback(async () => {
    try {
      const id = await addNote("[]", "");
      if (id) {
        const noteId = id as Id<"notes">;
        openNoteTab(noteId, "");
        setNewNoteId(noteId);
      }
    } catch {
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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
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
            <button onClick={() => { setNavDrawerOpen(false); router.push("/library"); }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <BookOpen className="h-4 w-4" /> {N.library}
            </button>
            <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-muted font-medium transition-colors">
              <StickyNote className="h-4 w-4" /> {N.notes}
            </button>
            <button onClick={() => { setNavDrawerOpen(false); router.push("/settings"); }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Settings className="h-4 w-4" /> {N.settings}
            </button>
          </aside>
        </div>
      )}

      {/* Navbar */}
      <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="md:hidden p-1.5" onClick={() => setNavDrawerOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold hidden md:inline">Web Knowledge Base</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")}>{N.library}</Button>
          <Button variant="secondary" size="sm" aria-current={true}>
            <StickyNote className="mr-1.5 h-3.5 w-3.5" />
            {N.notes}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
            <Settings className="mr-1 h-4 w-4" />{N.settings}
          </Button>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:inline">{session?.user?.email}</span>
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
          setActiveNoteId(id as Id<"notes">);
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
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar — overlay on mobile, inline on desktop */}
        {sidebarOpen && (
          <>
            <div className="absolute inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 z-30 h-full md:relative md:z-auto md:h-auto">
              <NoteList
                notes={notes}
                selectedId={activeNoteId as Id<"notes"> | null}
                onSelect={(id) => { handleSelect(id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                onNew={handleNew}
                onDelete={handleDelete}
              />
            </div>
          </>
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
    </div>
  );
}
