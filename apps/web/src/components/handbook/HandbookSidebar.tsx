"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Id } from "@/_generated/dataModel";
import { useDomains, createDomain as apiCreateDomain, renameDomain as apiRenameDomain, removeDomain as apiRemoveDomain } from "@/lib/api/domains";
import {
  useHandbooks, useHandbookFiles,
  createHandbook as apiCreateHandbook, renameHandbook as apiRenameHandbook, removeHandbook as apiRemoveHandbook,
  addEmptyFolder as apiAddEmptyFolder, removeFolder as apiRemoveHbFolder,
  renameFolder as apiRenameHbFolder, renameHandbookFile as apiRenameHandbookFile,
  finalizeImport as apiFinalizeImport,
} from "@/lib/api/handbooks";
import {
  useFoldersList, useAllDocFolders,
  createFolder as apiCreateFolder, deleteFolder as apiDeleteFolder,
  renameFolder as apiRenameDocFolder, assignDocToFolder as apiAssignDoc,
} from "@/lib/api/folders";
import {
  useLooseDocsWithProgress, deletePermanent as apiDeletePermanent,
  renameDocument as apiRenameDoc, requestUploadUrl as apiRequestUploadUrl, finalizeUpload as apiFinalizeUpload,
} from "@/lib/api/documents";
import { useTabSync } from "@/hooks/useTabSync";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { toast } from "sonner";
import {
  ChevronRight, Plus, Layers, BookText, FolderArchive, MoreHorizontal,
  Trash2, Pencil, FilePlus2, FolderPlus, FileText, Files,
  Image as ImageIcon, FileAudio, FileVideo, Presentation, BookOpen,
  Circle, CheckCircle2, CircleDot, Folder, FolderOpen, SplitSquareHorizontal,
  AlertTriangle, X, Check,
} from "lucide-react";
import { HandbookTree } from "./HandbookTree";
import { ImportZipDialog } from "./ImportZipDialog";
import type { HandbookFile } from "@/lib/handbook/buildTree";
import { extToFormat } from "@/lib/handbook/zipImport";

// ─── Portal Modal Wrappers ────────────────────────────────────────────────────

function PortalRenameModal({
  open, title, label, initialValue, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      // slight delay so the input is mounted before focus
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [open, initialValue]);

  const handleConfirm = () => {
    const t = value.trim();
    if (t) onConfirm(t);
    else onCancel();
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.5)" }}
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          width: "100%",
          maxWidth: 400,
          borderRadius: 12,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ borderBottom: "1px solid hsl(var(--border))", padding: "12px 16px" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "hsl(var(--foreground))" }}>{title}</h3>
        </div>
        <div style={{ padding: "16px" }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {label}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleConfirm(); }
              if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid hsl(var(--border))", padding: "12px 16px" }}>
          <button
            onClick={onCancel}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))",
              background: "transparent", color: "hsl(var(--muted-foreground))", cursor: "pointer",
            }}
          >
            <X size={14} /> Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim()}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              fontSize: 12, borderRadius: 6, border: "none",
              background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))",
              cursor: value.trim() ? "pointer" : "not-allowed",
              opacity: value.trim() ? 1 : 0.5,
            }}
          >
            <Check size={14} /> Xác nhận
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function PortalConfirmModal({
  open, title, description, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.5)" }}
        onClick={onCancel}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          width: "100%",
          maxWidth: 400,
          borderRadius: 12,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid hsl(var(--border))", padding: "12px 16px" }}>
          <AlertTriangle size={16} color="hsl(var(--destructive))" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "hsl(var(--foreground))" }}>{title}</h3>
        </div>
        <div style={{ padding: "16px" }}>
          <p style={{ margin: 0, fontSize: 14, color: "hsl(var(--muted-foreground))" }}>{description}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid hsl(var(--border))", padding: "12px 16px" }}>
          <button
            onClick={onCancel}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))",
              background: "transparent", color: "hsl(var(--muted-foreground))", cursor: "pointer",
            }}
          >
            <X size={14} /> Hủy
          </button>
          <button
            onClick={onConfirm}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              fontSize: 12, borderRadius: 6, border: "none",
              background: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))",
              cursor: "pointer",
            }}
          >
            <Trash2 size={14} /> Xóa
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Dialog state types ───────────────────────────────────────────────────────

type RenameDialogState = {
  open: false;
} | {
  open: true;
  title: string;
  label: string;
  initialValue: string;
  onConfirm: (v: string) => void;
};

type ConfirmDialogState = {
  open: false;
} | {
  open: true;
  title: string;
  description: string;
  onConfirm: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDTH_KEY = "hb-sidebar-width";

// ─── Root ─────────────────────────────────────────────────────────────────────

export function HandbookSidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const router = useRouter();
  const domains = useDomains();
  const { openTab } = useTabSync();
  const { activePanel, setActivePanel, openSecondary } = useActiveTab();
  const createDomain = (a: { name: string; color?: string }) => apiCreateDomain(a.name, a.color);

  const [renameDialog, setRenameDialog] = useState<RenameDialogState>({ open: false });

  const activeDocId = activePanel?.startsWith("reader:") ? activePanel.slice("reader:".length) : null;

  const openDoc = useCallback((docId: Id<"documents">) => {
    openTab(docId).catch(() => {});
    setActivePanel(`reader:${docId}`);
    window.history.pushState(null, "", `/reader/${docId}`);
    if (onLinkClick) onLinkClick();
  }, [openTab, setActivePanel, onLinkClick]);

  const handleCreateDomain = useCallback(() => {
    setRenameDialog({
      open: true,
      title: "Tạo Domain mới",
      label: "Tên Domain",
      initialValue: "",
      onConfirm: async (name) => {
        setRenameDialog({ open: false });
        try { await createDomain({ name }); toast.success("Tạo Domain thành công"); }
        catch { toast.error("Không tạo được domain"); }
      },
    });
  }, [createDomain]);

  return (
    <div className="flex h-full flex-col">
      {renameDialog.open && (
        <PortalRenameModal
          open={renameDialog.open}
          title={renameDialog.title}
          label={renameDialog.label}
          initialValue={renameDialog.initialValue}
          onConfirm={renameDialog.onConfirm}
          onCancel={() => setRenameDialog({ open: false })}
        />
      )}

      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Layers className="h-4 w-4" /> Thư viện</span>
        <button onClick={handleCreateDomain} title="Thêm Domain" className="rounded p-1 hover:bg-muted">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {domains === undefined && <p className="px-3 py-2 text-xs text-muted-foreground">Đang tải…</p>}
        {domains && domains.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Chưa có Domain. Bấm + để tạo.</p>
        )}
        {domains?.map((d: any) => (
          <DomainNode key={d._id} domainId={d._id} name={d.name} activeDocId={activeDocId} onOpenFile={openDoc} onOpenSecondary={openSecondary} />
        ))}

        <LooseDocsSection activeDocId={activeDocId} onOpenFile={openDoc} onOpenSecondary={openSecondary} />

        <div className="border-t border-border/40 mt-2 pt-2 px-2">
          <button
            onClick={() => {
              router.push("/library/trash");
              if (onLinkClick) onLinkClick();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0 text-destructive" />
            <span>Thùng rác</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function HandbookSidebar() {
  const { sidebarOpen } = useActiveTab();
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 280;
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved >= 220 && saved <= 480 ? saved : 280;
  });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(480, Math.max(220, ev.clientX));
      setWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setWidth((w) => { try { localStorage.setItem(WIDTH_KEY, String(w)); } catch {} return w; });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div
      className={`relative hidden h-full shrink-0 flex-col bg-card xl:flex transition-[width,border-color] duration-300 ease-in-out overflow-hidden ${
        sidebarOpen ? "border-r border-border" : "border-r border-transparent"
      }`}
      style={{ width: sidebarOpen ? width : 0 }}
    >
      <div className="h-full w-full min-w-[220px]">
        <HandbookSidebarContent />
      </div>
      {sidebarOpen && (
        <div
          onMouseDown={onMouseDown}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
        />
      )}
    </div>
  );
}


// ─── DomainNode ───────────────────────────────────────────────────────────────

function DomainNode({ domainId, name, activeDocId, onOpenFile, onOpenSecondary }: {
  domainId: Id<"domains">; name: string; activeDocId: string | null;
  onOpenFile: (id: Id<"documents">) => void; onOpenSecondary: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const handbooks = useHandbooks(domainId, open);
  const createHandbook = (a: { domainId: string; name: string; color?: string }) => apiCreateHandbook(a.domainId, a.name, a.color);
  const renameDomain = (a: { domainId: string; name: string }) => apiRenameDomain(a.domainId, a.name);
  const removeDomain = (a: { domainId: string }) => apiRemoveDomain(a.domainId);

  const [renameDialog, setRenameDialog] = useState<RenameDialogState>({ open: false });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ open: false });

  return (
    <div>
      {renameDialog.open && (
        <PortalRenameModal
          open={renameDialog.open}
          title={renameDialog.title}
          label={renameDialog.label}
          initialValue={renameDialog.initialValue}
          onConfirm={renameDialog.onConfirm}
          onCancel={() => setRenameDialog({ open: false })}
        />
      )}
      {confirmDialog.open && (
        <PortalConfirmModal
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ open: false })}
        />
      )}

      <div className="group flex min-w-0 items-center">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1 text-left text-[13px] font-medium hover:bg-muted/60">
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <BookText className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{name}</span>
        </button>
        <button
          onClick={() => {
            setRenameDialog({
              open: true,
              title: "Tạo Handbook mới",
              label: "Tên Handbook",
              initialValue: "",
              onConfirm: async (n) => {
                setRenameDialog({ open: false });
                try { await createHandbook({ domainId, name: n }); }
                catch { toast.error("Không tạo được handbook"); }
              },
            });
          }}
          title="Thêm Handbook"
          className="rounded p-1 opacity-0 hover:bg-muted group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <RowMenu items={[
          {
            label: "Đổi tên Domain",
            icon: <Pencil className="h-3.5 w-3.5" />,
            onClick: () => {
              setRenameDialog({
                open: true,
                title: "Đổi tên Domain",
                label: "Tên mới",
                initialValue: name,
                onConfirm: async (n) => {
                  setRenameDialog({ open: false });
                  try {
                    await renameDomain({ domainId, name: n });
                    toast.success("Đổi tên Domain thành công");
                  } catch (err: any) {
                    toast.error(err.message || "Không đổi được tên Domain");
                  }
                },
              });
            },
          },
          {
            label: "Xóa Domain",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            danger: true,
            onClick: () => {
              setConfirmDialog({
                open: true,
                title: "Xóa Domain",
                description: `Xóa Domain "${name}" và toàn bộ Handbook bên trong?`,
                onConfirm: async () => {
                  setConfirmDialog({ open: false });
                  try {
                    await removeDomain({ domainId });
                    toast.success("Xóa Domain thành công");
                  } catch (err: any) {
                    toast.error(err.message || "Không xóa được Domain");
                  }
                },
              });
            },
          },
        ]} />
      </div>
      {open && (
        <div className="ml-3 border-l border-border/40">
          {handbooks?.map((h: any) => (
            <HandbookNode
              key={h._id}
              handbookId={h._id}
              name={h.name}
              emptyFolders={h.emptyFolders ?? []}
              activeDocId={activeDocId}
              onOpenFile={onOpenFile}
              onOpenSecondary={onOpenSecondary}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HandbookNode ─────────────────────────────────────────────────────────────

function HandbookNode({ handbookId, name, emptyFolders, activeDocId, onOpenFile, onOpenSecondary }: {
  handbookId: Id<"handbooks">; name: string; emptyFolders: string[]; activeDocId: string | null;
  onOpenFile: (id: Id<"documents">) => void; onOpenSecondary: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadPrefix, setUploadPrefix] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [renameDialog, setRenameDialog] = useState<RenameDialogState>({ open: false });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ open: false });

  const files = useHandbookFiles(handbookId, open);
  const renameHb = (a: { handbookId: string; name: string }) => apiRenameHandbook(a.handbookId, a.name);
  const removeHb = (a: { handbookId: string }) => apiRemoveHandbook(a.handbookId);
  const addEmptyFolder = (a: { handbookId: string; prefix: string }) => apiAddEmptyFolder(a.handbookId, a.prefix);
  const removeFolder = (a: { handbookId: string; prefix: string }) => apiRemoveHbFolder(a.handbookId, a.prefix);
  const deleteDoc = (a: { docId: string }) => apiDeletePermanent(a.docId);
  const renameFolder = (a: { handbookId: string; oldPrefix: string; newPrefix: string }) => apiRenameHbFolder(a.handbookId, a.oldPrefix, a.newPrefix);
  const renameHandbookFile = (a: { docId: string; newName: string }) => apiRenameHandbookFile(a.docId, a.newName);
  const requestUploadUrl = (a: { fileName: string; fileSizeBytes?: number; format?: string; mimeType?: string }) => apiRequestUploadUrl(a.fileName);
  const finalizeImport = (a: { handbookId: string; files: Parameters<typeof apiFinalizeImport>[1] }) => apiFinalizeImport(a.handbookId, a.files);

  const fileList: HandbookFile[] = useMemo(
    () => (files ?? []).map((f: any) => ({ ...f })) as HandbookFile[],
    [files]
  );

  return (
    <div>
      {renameDialog.open && (
        <PortalRenameModal
          open={renameDialog.open}
          title={renameDialog.title}
          label={renameDialog.label}
          initialValue={renameDialog.initialValue}
          onConfirm={renameDialog.onConfirm}
          onCancel={() => setRenameDialog({ open: false })}
        />
      )}
      {confirmDialog.open && (
        <PortalConfirmModal
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ open: false })}
        />
      )}

      <div className="group flex min-w-0 items-center">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1 text-left text-[13px] hover:bg-muted/60">
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <FolderArchive className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="truncate">{name}</span>
        </button>
        <RowMenu items={[
          { label: "Import ZIP", icon: <FilePlus2 className="h-3.5 w-3.5" />, onClick: () => setImportOpen(true) },
          {
            label: "Thêm file",
            icon: <FilePlus2 className="h-3.5 w-3.5" />,
            onClick: () => { setUploadPrefix(""); fileInputRef.current?.click(); },
          },
          {
            label: "Import Thư mục",
            icon: <FolderPlus className="h-3.5 w-3.5" />,
            onClick: () => { setUploadPrefix(""); folderInputRef.current?.click(); },
          },
          {
            label: "Tạo folder",
            icon: <FolderPlus className="h-3.5 w-3.5" />,
            onClick: () => {
              setRenameDialog({
                open: true,
                title: "Tạo folder mới",
                label: "Đường dẫn folder (vd: assets/img)",
                initialValue: "",
                onConfirm: async (p) => {
                  setRenameDialog({ open: false });
                  try {
                    await addEmptyFolder({ handbookId, prefix: p });
                    toast.success("Tạo folder thành công");
                    if (!open) setOpen(true);
                  } catch (err: any) { toast.error(err.message || "Không tạo được folder"); }
                },
              });
            },
          },
          {
            label: "Đổi tên",
            icon: <Pencil className="h-3.5 w-3.5" />,
            onClick: () => {
              setRenameDialog({
                open: true,
                title: "Đổi tên Handbook",
                label: "Tên mới",
                initialValue: name,
                onConfirm: async (n) => {
                  setRenameDialog({ open: false });
                  try {
                    await renameHb({ handbookId, name: n });
                    toast.success("Đổi tên Handbook thành công");
                  } catch (err: any) { toast.error(err.message || "Không đổi được tên Handbook"); }
                },
              });
            },
          },
          {
            label: "Xóa Handbook",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            danger: true,
            onClick: () => {
              setConfirmDialog({
                open: true,
                title: "Xóa Handbook",
                description: `Xóa Handbook "${name}" và toàn bộ file bên trong?`,
                onConfirm: async () => {
                  setConfirmDialog({ open: false });
                  try {
                    await removeHb({ handbookId });
                    toast.success("Xóa Handbook thành công");
                  } catch (err: any) { toast.error(err.message || "Không xóa được Handbook"); }
                },
              });
            },
          },
        ]} />
      </div>
      {open && (
        <div className="ml-3 border-l border-border/40">
          {files === undefined ? (
            <p className="px-4 py-1 text-xs text-muted-foreground">Đang tải…</p>
          ) : (
            <HandbookTree
              handbookId={handbookId}
              files={fileList}
              emptyFolders={emptyFolders}
              activeDocId={activeDocId}
              onOpenFile={onOpenFile}
              onOpenSecondary={(id) => onOpenSecondary(id)}
              onDeleteFile={(docId, title) => {
                setConfirmDialog({
                  open: true,
                  title: "Xóa file",
                  description: `Xóa file "${title}"?`,
                  onConfirm: async () => {
                    setConfirmDialog({ open: false });
                    await deleteDoc({ docId }).catch(() => {});
                  },
                });
              }}
              onDeleteFolder={(prefix) => {
                setConfirmDialog({
                  open: true,
                  title: "Xóa folder",
                  description: `Xóa folder "${prefix}" và mọi file bên trong?`,
                  onConfirm: async () => {
                    setConfirmDialog({ open: false });
                    await removeFolder({ handbookId, prefix }).catch(() => {});
                  },
                });
              }}
              onAddFile={(prefix) => {
                setUploadPrefix(prefix);
                fileInputRef.current?.click();
              }}
              onAddFolder={(prefix) => {
                setUploadPrefix(prefix);
                folderInputRef.current?.click();
              }}
              onAddEmptyFolder={(prefix) => {
                setRenameDialog({
                  open: true,
                  title: "Tạo folder con",
                  label: "Tên folder con mới",
                  initialValue: "",
                  onConfirm: async (n) => {
                    setRenameDialog({ open: false });
                    await addEmptyFolder({ handbookId, prefix: `${prefix}/${n}` }).catch(() => {
                      toast.error("Không tạo được folder con");
                    });
                  },
                });
              }}
              onRenameFile={(docId, currentName) => {
                setRenameDialog({
                  open: true,
                  title: "Đổi tên file",
                  label: "Tên file mới (giữ nguyên đuôi mở rộng)",
                  initialValue: currentName,
                  onConfirm: async (n) => {
                    setRenameDialog({ open: false });
                    try {
                      await renameHandbookFile({ docId, newName: n });
                      toast.success("Đổi tên file thành công");
                    } catch (err: any) { toast.error(err.message || "Không đổi được tên file"); }
                  },
                });
              }}
              onRenameFolder={(prefix, currentName) => {
                setRenameDialog({
                  open: true,
                  title: "Đổi tên folder",
                  label: "Tên folder mới",
                  initialValue: currentName,
                  onConfirm: async (n) => {
                    setRenameDialog({ open: false });
                    const lastSlashIdx = prefix.lastIndexOf("/");
                    const parentPrefix = lastSlashIdx !== -1 ? prefix.slice(0, lastSlashIdx) : "";
                    const newPrefix = parentPrefix ? `${parentPrefix}/${n}` : n;
                    try {
                      await renameFolder({ handbookId, oldPrefix: prefix, newPrefix });
                      toast.success("Đổi tên folder thành công");
                    } catch (err: any) { toast.error(err.message || "Không đổi được tên folder"); }
                  },
                });
              }}
            />
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          const toastId = toast.loading(`Đang tải lên "${file.name}"…`);
          try {
            const format = extToFormat(file.name);
            if (!format) throw new Error("Định dạng file không được hỗ trợ");
            const { uploadUrl, storageKey } = await requestUploadUrl({
              fileSizeBytes: file.size,
              format,
              fileName: file.name,
              mimeType: file.type,
            });

            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.addEventListener("progress", (evt) => {
                if (evt.lengthComputable) {
                  const pct = Math.round((evt.loaded / evt.total) * 100);
                  toast.loading(`Đang tải lên "${file.name}": ${evt.loaded === evt.total ? 100 : pct}%`, { id: toastId });
                }
              });
              xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error(`Tải lên thất bại (HTTP ${xhr.status})`));
              });
              xhr.addEventListener("error", () => reject(new Error("Lỗi mạng khi tải lên")));
              xhr.open("PUT", uploadUrl);
              xhr.send(file);
            });

            const relPath = uploadPrefix ? `${uploadPrefix}/${file.name}` : file.name;
            await finalizeImport({
              handbookId,
              files: [{
                relPath,
                storageKey,
                format: format as any,
                fileSizeBytes: file.size,
                mimeType: file.type,
              }]
            });
            toast.success(`Đã thêm file "${file.name}"`, { id: toastId });
            if (!open) setOpen(true);
          } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Lỗi tải lên file", { id: toastId });
          } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        disabled={uploading}
        multiple
        {...({
          webkitdirectory: "",
          directory: ""
        } as any)}
        onChange={async (e) => {
          const filesList = Array.from(e.target.files ?? []);
          if (filesList.length === 0) return;
          setUploading(true);
          const toastId = toast.loading(`Đang xử lý thư mục và chuẩn bị tải lên…`);
          try {
            const manifest: {
              relPath: string;
              storageKey: string;
              format: string;
              fileSizeBytes?: number;
              mimeType?: string;
            }[] = [];
            let skipped = 0;
            let uploadedCount = 0;

            const validFiles = filesList.filter(f => {
              const base = f.name;
              if (base === ".DS_Store" || base === "Thumbs.db" || base.startsWith("._")) {
                skipped++;
                return false;
              }
              const fmt = extToFormat(base);
              if (!fmt) {
                skipped++;
                return false;
              }
              return true;
            });

            if (validFiles.length === 0) {
              throw new Error("Không tìm thấy file hợp lệ/được hỗ trợ trong thư mục");
            }

            for (let i = 0; i < validFiles.length; i++) {
              const file = validFiles[i];
              toast.loading(`Đang tải lên thư mục (${i + 1}/${validFiles.length}): ${file.name}…`, { id: toastId });

              const format = extToFormat(file.name)!;
              const { uploadUrl, storageKey } = await requestUploadUrl({
                fileSizeBytes: file.size,
                format,
                fileName: file.name,
                mimeType: file.type,
              });

              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (evt) => {
                  if (evt.lengthComputable) {
                    const filePct = Math.round((evt.loaded / evt.total) * 100);
                    toast.loading(`Đang tải lên (${i + 1}/${validFiles.length}): ${file.name} (${filePct}%)`, { id: toastId });
                  }
                });
                xhr.addEventListener("load", () => {
                  if (xhr.status >= 200 && xhr.status < 300) resolve();
                  else reject(new Error(`Tải lên thất bại (HTTP ${xhr.status})`));
                });
                xhr.addEventListener("error", () => reject(new Error("Lỗi mạng khi tải lên")));
                xhr.open("PUT", uploadUrl);
                xhr.send(file);
              });

              const relativePath = file.webkitRelativePath || file.name;
              const relPath = uploadPrefix ? `${uploadPrefix}/${relativePath}` : relativePath;

              manifest.push({
                relPath,
                storageKey,
                format,
                fileSizeBytes: file.size,
                mimeType: file.type,
              });
              uploadedCount++;
            }

            toast.loading(`Đang đồng bộ hóa cơ sở dữ liệu…`, { id: toastId });
            const res = await finalizeImport({
              handbookId,
              files: manifest as any,
            });

            const successMsg = `Tải lên thư mục thành công! Đã thêm ${res.created} file.` + 
              (skipped > 0 ? ` (Bỏ qua ${skipped} file không được hỗ trợ)` : "");
            toast.success(successMsg, { id: toastId });
            if (!open) setOpen(true);
          } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Lỗi tải lên thư mục", { id: toastId });
          } finally {
            setUploading(false);
            if (folderInputRef.current) folderInputRef.current.value = "";
          }
        }}
      />
      {importOpen && (
        <ImportZipDialog handbookId={handbookId} handbookName={name} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

// ─── Format / Status icons ────────────────────────────────────────────────────

interface LooseTreeNode {
  type: "folder" | "file";
  id: string;
  name: string;
  children?: LooseTreeNode[];
  doc?: any;
}

function formatIcon(format: string) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (format) {
    case "pdf": return <FileText className={`${cls} text-red-500`} />;
    case "image": return <ImageIcon className={`${cls} text-emerald-500`} />;
    case "audio": return <FileAudio className={`${cls} text-violet-500`} />;
    case "video": return <FileVideo className={`${cls} text-blue-500`} />;
    case "pptx": return <Presentation className={`${cls} text-orange-500`} />;
    case "epub": return <BookOpen className={`${cls} text-amber-600`} />;
    default: return <FileText className={`${cls} text-muted-foreground`} />;
  }
}

function statusIcon(format: string, pct: number | null) {
  if (format === "image" || format === "audio" || format === "video") return null;
  if (pct == null || pct <= 0) return <Circle className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-label="Chưa đọc" />;
  if (pct >= 0.95) return <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" aria-label="Đã đọc xong" />;
  return <CircleDot className="h-3 w-3 shrink-0 text-amber-500" aria-label="Đang đọc dở" />;
}

// ─── LooseDocsSection ─────────────────────────────────────────────────────────

function LooseDocsSection({ activeDocId, onOpenFile, onOpenSecondary }: {
  activeDocId: string | null;
  onOpenFile: (id: Id<"documents">) => void;
  onOpenSecondary?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [renameDialog, setRenameDialog] = useState<RenameDialogState>({ open: false });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ open: false });

  const docs = useLooseDocsWithProgress(open);
  const folders = useFoldersList(open);
  const docFolders = useAllDocFolders(open);

  const createFolder = (a: { name: string; parentFolderId?: string }) => apiCreateFolder(a.name, a.parentFolderId);
  const deleteFolder = (a: { folderId: string }) => apiDeleteFolder(a.folderId);
  const renameFolder = (a: { folderId: string; name: string }) => apiRenameDocFolder(a.folderId, a.name);
  const assignDoc = (a: { docId: string; folderId: string }) => apiAssignDoc(a.docId, a.folderId);
  const renameDoc = (a: { docId: string; newTitle: string }) => apiRenameDoc(a.docId, a.newTitle);
  const deleteDoc = (a: { docId: string }) => apiDeletePermanent(a.docId);
  const requestUploadUrl = (a: { fileName: string; fileSizeBytes?: number; format?: string; mimeType?: string }) => apiRequestUploadUrl(a.fileName);
  const finalizeUpload = apiFinalizeUpload;

  const toggleFolder = useCallback((folderId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  }, []);

  const tree = useMemo(() => {
    if (!folders || !docs) return [];

    const subfolders = new Map<string, any[]>();
    const rootFolders: any[] = [];
    for (const f of folders) {
      if (f.parentFolderId) {
        if (!subfolders.has(f.parentFolderId)) subfolders.set(f.parentFolderId, []);
        subfolders.get(f.parentFolderId)!.push(f);
      } else {
        rootFolders.push(f);
      }
    }

    const folderOfDoc = new Map<string, string>();
    for (const df of docFolders ?? []) {
      folderOfDoc.set(df.docId as string, df.folderId as string);
    }

    const docsInFolder = new Map<string, any[]>();
    const rootDocs: any[] = [];
    for (const d of docs) {
      const fid = folderOfDoc.get(d._id as string);
      if (fid) {
        if (!docsInFolder.has(fid)) docsInFolder.set(fid, []);
        docsInFolder.get(fid)!.push(d);
      } else {
        rootDocs.push(d);
      }
    }

    function buildFolderNode(f: any): LooseTreeNode {
      const childFolders = subfolders.get(f._id) ?? [];
      const childDocs = docsInFolder.get(f._id) ?? [];
      const children: LooseTreeNode[] = [
        ...childFolders.map(buildFolderNode),
        ...childDocs.map((d) => ({ type: "file" as const, id: d._id, name: d.title, doc: d })),
      ];
      children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });
      return { type: "folder", id: f._id, name: f.name, children };
    }

    const rootNodes: LooseTreeNode[] = [
      ...rootFolders.map(buildFolderNode),
      ...rootDocs.map((d) => ({ type: "file" as const, id: d._id, name: d.title, doc: d })),
    ];
    rootNodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    return rootNodes;
  }, [folders, docs, docFolders]);

  const renderLooseTree = (nodes: LooseTreeNode[], depth: number) => (
    <ul>
      {nodes.map((node) => {
        const pad = depth * 12;
        if (node.type === "folder") {
          const isExpanded = expanded.has(node.id);
          return (
            <li key={`folder:${node.id}`}>
              <div className="group flex min-w-0 items-center">
                <button
                  onClick={() => toggleFolder(node.id)}
                  style={{ paddingLeft: pad }}
                  className="flex min-w-0 flex-1 items-center gap-1 py-1 pr-2 text-left text-[13px] text-foreground/90 hover:bg-muted/60"
                >
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  {isExpanded
                    ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <span className="truncate">{node.name}</span>
                </button>
                <RowMenu items={[
                  {
                    label: "Thêm file", icon: <FilePlus2 className="h-3.5 w-3.5" />,
                    onClick: () => { setUploadFolderId(node.id); fileInputRef.current?.click(); },
                  },
                  {
                    label: "Import Thư mục", icon: <FolderPlus className="h-3.5 w-3.5" />,
                    onClick: () => { setUploadFolderId(node.id); folderInputRef.current?.click(); },
                  },
                  {
                    label: "Tạo folder con", icon: <FolderPlus className="h-3.5 w-3.5" />,
                    onClick: () => {
                      setRenameDialog({
                        open: true, title: "Tạo folder con", label: "Tên folder con mới", initialValue: "",
                        onConfirm: async (n) => {
                          setRenameDialog({ open: false });
                          try {
                            await createFolder({ name: n, parentFolderId: node.id as any });
                            toast.success("Tạo folder con thành công");
                            setExpanded((prev) => { const next = new Set(prev); next.add(node.id); return next; });
                          } catch { toast.error("Không tạo được folder con"); }
                        },
                      });
                    },
                  },
                  {
                    label: "Đổi tên folder", icon: <Pencil className="h-3.5 w-3.5" />,
                    onClick: () => {
                      setRenameDialog({
                        open: true, title: "Đổi tên folder", label: "Tên mới", initialValue: node.name,
                        onConfirm: async (n) => {
                          setRenameDialog({ open: false });
                          try {
                            await renameFolder({ folderId: node.id as any, name: n });
                            toast.success("Đổi tên folder thành công");
                          } catch { toast.error("Không đổi được tên folder"); }
                        },
                      });
                    },
                  },
                  {
                    label: "Xóa folder", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true,
                    onClick: () => {
                      setConfirmDialog({
                        open: true, title: "Xóa folder",
                        description: `Xóa folder "${node.name}" và TOÀN BỘ tài liệu/thư mục con bên trong? Hành động này không thể hoàn tác.`,
                        onConfirm: async () => {
                          setConfirmDialog({ open: false });
                          try {
                            await deleteFolder({ folderId: node.id as any });
                            toast.success("Xóa folder thành công");
                          } catch { toast.error("Không xóa được folder"); }
                        },
                      });
                    },
                  },
                ]} />
              </div>
              {isExpanded && node.children && renderLooseTree(node.children, depth + 1)}
            </li>
          );
        }

        const d = node.doc;
        const isActive = d._id === activeDocId;
        return (
          <li key={`file:${d._id}`}>
            <div className="group flex min-w-0 items-center">
              <button
                onClick={() => onOpenFile(d._id)}
                style={{ paddingLeft: pad + 14 }}
                className={[
                  "flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-left text-[13px]",
                  isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted/60",
                ].join(" ")}
              >
                {formatIcon(d.format)}
                <span className="truncate">{d.title}</span>
                <span className="ml-auto shrink-0">{statusIcon(d.format, d.progressPct)}</span>
              </button>
              <RowMenu items={[
                ...(onOpenSecondary ? [{ label: "Mở sang phải", icon: <SplitSquareHorizontal className="h-3.5 w-3.5" />, onClick: () => onOpenSecondary(d._id) }] : []),
                {
                  label: "Đổi tên file", icon: <Pencil className="h-3.5 w-3.5" />,
                  onClick: () => {
                    setRenameDialog({
                      open: true, title: "Đổi tên file", label: "Tên mới", initialValue: d.title,
                      onConfirm: async (n) => {
                        setRenameDialog({ open: false });
                        try {
                          await renameDoc({ docId: d._id, newTitle: n });
                          toast.success("Đổi tên file thành công");
                        } catch { toast.error("Không đổi được tên file"); }
                      },
                    });
                  },
                },
                {
                  label: "Xóa file", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true,
                  onClick: () => {
                    setConfirmDialog({
                      open: true, title: "Xóa file", description: `Xóa file "${d.title}"?`,
                      onConfirm: async () => {
                        setConfirmDialog({ open: false });
                        try {
                          await deleteDoc({ docId: d._id });
                          toast.success("Xóa file thành công");
                        } catch { toast.error("Không xóa được file"); }
                      },
                    });
                  },
                },
              ]} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="mt-2 border-t pt-1">
      {renameDialog.open && (
        <PortalRenameModal
          open={renameDialog.open}
          title={renameDialog.title}
          label={renameDialog.label}
          initialValue={renameDialog.initialValue}
          onConfirm={renameDialog.onConfirm}
          onCancel={() => setRenameDialog({ open: false })}
        />
      )}
      {confirmDialog.open && (
        <PortalConfirmModal
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ open: false })}
        />
      )}

      <div className="group flex min-w-0 items-center">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1 text-left text-[13px] font-medium hover:bg-muted/60">
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <Files className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">Tài liệu lẻ</span>
        </button>
        <RowMenu items={[
          {
            label: "Tải file lẻ", icon: <FilePlus2 className="h-3.5 w-3.5" />,
            onClick: () => { setUploadFolderId(null); fileInputRef.current?.click(); },
          },
          {
            label: "Import Thư mục", icon: <FolderPlus className="h-3.5 w-3.5" />,
            onClick: () => { setUploadFolderId(null); folderInputRef.current?.click(); },
          },
          {
            label: "Tạo folder", icon: <FolderPlus className="h-3.5 w-3.5" />,
            onClick: () => {
              setRenameDialog({
                open: true, title: "Tạo folder mới", label: "Tên folder", initialValue: "",
                onConfirm: async (n) => {
                  setRenameDialog({ open: false });
                  try {
                    await createFolder({ name: n });
                    toast.success("Tạo folder thành công");
                    if (!open) setOpen(true);
                  } catch { toast.error("Không tạo được folder"); }
                },
              });
            },
          },
        ]} />
      </div>
      {open && (
        <div className="ml-2">
          {folders === undefined || docs === undefined ? (
            <p className="px-3 py-1 text-xs text-muted-foreground">Đang tải…</p>
          ) : tree.length === 0 ? (
            <p className="px-3 py-1 text-xs text-muted-foreground">Không có tài liệu lẻ.</p>
          ) : (
            renderLooseTree(tree, 0)
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          const toastId = toast.loading(`Đang tải lên "${file.name}"…`);
          try {
            const format = extToFormat(file.name);
            if (!format) throw new Error("Định dạng file không được hỗ trợ");
            const { uploadUrl, storageKey } = await requestUploadUrl({
              fileSizeBytes: file.size,
              format,
              fileName: file.name,
              mimeType: file.type,
            });

            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.addEventListener("progress", (evt) => {
                if (evt.lengthComputable) {
                  const pct = Math.round((evt.loaded / evt.total) * 100);
                  toast.loading(`Đang tải lên "${file.name}": ${evt.loaded === evt.total ? 100 : pct}%`, { id: toastId });
                }
              });
              xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error(`Tải lên thất bại (HTTP ${xhr.status})`));
              });
              xhr.addEventListener("error", () => reject(new Error("Lỗi mạng khi tải lên")));
              xhr.open("PUT", uploadUrl);
              xhr.send(file);
            });

            const docId = await finalizeUpload({
              title: file.name.replace(/\.[^/.]+$/, "") || file.name,
              format: format as any,
              fileSizeBytes: file.size,
              storageBackend: "r2",
              storageKey,
            });

            if (uploadFolderId) {
              await assignDoc({ docId, folderId: uploadFolderId as any });
            }

            toast.success(`Đã thêm file "${file.name}"`, { id: toastId });
            if (!open) setOpen(true);
          } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Lỗi tải lên file", { id: toastId });
          } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        disabled={uploading}
        multiple
        {...({
          webkitdirectory: "",
          directory: ""
        } as any)}
        onChange={async (e) => {
          const filesList = Array.from(e.target.files ?? []);
          if (filesList.length === 0) return;
          setUploading(true);
          const toastId = toast.loading(`Đang xử lý thư mục tài liệu lẻ…`);
          try {
            let skipped = 0;
            const validFiles = filesList.filter((f: File) => {
              const base = f.name;
              if (base === ".DS_Store" || base === "Thumbs.db" || base.startsWith("._")) {
                skipped++;
                return false;
              }
              const fmt = extToFormat(base);
              if (!fmt) {
                skipped++;
                return false;
              }
              return true;
            });

            if (validFiles.length === 0) {
              throw new Error("Không tìm thấy file hợp lệ/được hỗ trợ trong thư mục");
            }

            const pathCache = new Map<string, string>();
            const getOrCreateFolder = async (relPath: string): Promise<string | null> => {
              const parts = relPath.split("/");
              parts.pop(); // remove filename
              if (parts.length === 0) return uploadFolderId;

              let parentId = uploadFolderId;
              let currentPath = "";

              for (const name of parts) {
                currentPath = currentPath ? `${currentPath}/${name}` : name;
                if (pathCache.has(currentPath)) {
                  parentId = pathCache.get(currentPath)!;
                } else {
                  const cleanName = name.trim();
                  const existingFolder = folders?.find(
                    (f: any) => f.name === cleanName && f.parentFolderId === (parentId || undefined)
                  );

                  if (existingFolder) {
                    parentId = existingFolder._id;
                    pathCache.set(currentPath, parentId as string);
                  } else {
                    const newFolderId = await createFolder({
                      name: cleanName,
                      parentFolderId: parentId ? (parentId as any) : undefined,
                    });
                    parentId = newFolderId;
                    pathCache.set(currentPath, newFolderId);
                  }
                }
              }
              return parentId;
            };

            for (let i = 0; i < validFiles.length; i++) {
              const file = validFiles[i];
              toast.loading(`Đang tải lên thư mục (${i + 1}/${validFiles.length}): ${file.name}…`, { id: toastId });

              const destFolderId = await getOrCreateFolder(file.webkitRelativePath || file.name);

              const format = extToFormat(file.name)!;
              const { uploadUrl, storageKey } = await requestUploadUrl({
                fileSizeBytes: file.size,
                format,
                fileName: file.name,
                mimeType: file.type,
              });

              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (evt) => {
                  if (evt.lengthComputable) {
                    const filePct = Math.round((evt.loaded / evt.total) * 100);
                    toast.loading(`Đang tải lên (${i + 1}/${validFiles.length}): ${file.name} (${filePct}%)`, { id: toastId });
                  }
                });
                xhr.addEventListener("load", () => {
                  if (xhr.status >= 200 && xhr.status < 300) resolve();
                  else reject(new Error(`Tải lên thất bại (HTTP ${xhr.status})`));
                });
                xhr.addEventListener("error", () => reject(new Error("Lỗi mạng khi tải lên")));
                xhr.open("PUT", uploadUrl);
                xhr.send(file);
              });

              const docId = await finalizeUpload({
                title: file.name.replace(/\.[^/.]+$/, "") || file.name,
                format: format as any,
                fileSizeBytes: file.size,
                storageBackend: "r2",
                storageKey,
              });

              if (destFolderId) {
                await assignDoc({ docId, folderId: destFolderId as any });
              }
            }

            const successMsg = `Đã tải lên thư mục thành công!` + 
              (skipped > 0 ? ` (Bỏ qua ${skipped} file không được hỗ trợ)` : "");
            toast.success(successMsg, { id: toastId });
            if (!open) setOpen(true);
          } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Lỗi tải lên thư mục tài liệu lẻ", { id: toastId });
          } finally {
            setUploading(false);
            if (folderInputRef.current) folderInputRef.current.value = "";
          }
        }}
      />
    </div>
  );
}

// ─── RowMenu ──────────────────────────────────────────────────────────────────

function RowMenu({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 min-w-[150px] rounded-md border bg-popover p-1 shadow-md">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick();
                }}
                className={[
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                  it.danger ? "text-destructive" : "text-foreground",
                ].join(" ")}
              >
                {it.icon}{it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
