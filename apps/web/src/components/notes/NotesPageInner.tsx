"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Settings, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/tabs/TabBar";
import { NoteList } from "@/components/notes/NoteList";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { useAllNotes } from "@/hooks/useNotes";
import { Id } from "@/_generated/dataModel";
import { labels } from "@/lib/i18n/labels";

const N = labels.nav;

export function NotesPageInner() {
  const router = useRouter();
  const { data: session } = useSession();
  const { notes, addNote, updateNote, removeNote } = useAllNotes();
  const [selectedId, setSelectedId] = useState<Id<"notes"> | null>(null);
  const [newNoteId, setNewNoteId] = useState<Id<"notes"> | null>(null);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleNew = useCallback(async () => {
    try {
      const id = await addNote("[]", "");
      if (id) {
        setSelectedId(id as Id<"notes">);
        setNewNoteId(id as Id<"notes">);
      }
    } catch {
      toast.error("Không thể tạo ghi chú");
    }
  }, [addNote]);

  const handleDelete = useCallback(async (id: Id<"notes">) => {
    try {
      await removeNote(id);
      if (selectedId === id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remaining = (notes as any[]).filter((n) => n._id !== id);
        setSelectedId(remaining[0]?._id ?? null);
      }
    } catch {
      toast.error("Không thể xoá ghi chú");
    }
  }, [removeNote, selectedId, notes]);

  const handleUpdate = useCallback(async (id: Id<"notes">, body: string, title: string) => {
    await updateNote(id, body, title);
  }, [updateNote]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedNote = (notes as any[]).find((n) => n._id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Navbar */}
      <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">Web Knowledge Base</span>
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
      <TabBar currentDocId={null} notesActive showAddButton activeNoteTitle={selectedNote?.title || null} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <NoteList
          notes={notes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={handleNew}
          onDelete={handleDelete}
        />

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
