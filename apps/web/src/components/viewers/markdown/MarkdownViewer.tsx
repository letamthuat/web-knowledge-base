"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import { Id } from "@/_generated/dataModel";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { List, X, Highlighter, StickyNote, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidBlock } from "./MermaidBlock";
import { HighlightMenu } from "./HighlightMenu";
import { HighlightLayer } from "./HighlightLayer";
import { NotePopover } from "./NotePopover";
import { AnnotationPanel } from "./AnnotationPanel";
import { NoteHoverCard } from "./NoteHoverCard";
import { DocNotePopover } from "./DocNotePopover";
import { ZoomControls, useZoom } from "@/components/viewers/ZoomControls";
import { NotesSidePanel } from "@/components/notes/NotesSidePanel";
import { useHighlights, type HighlightColor, type HighlightPosition } from "@/hooks/useHighlights";
import { useNotes } from "@/hooks/useNotes";
import type { Components } from "react-markdown";
import GithubSlugger from "github-slugger";

interface MarkdownViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
  highlightQuery?: string;
  typography?: { fontFamily: string; fontSize: number; lineHeight: number; colWidthClass: string };
}

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split("\n");
  const entries: TocEntry[] = [];
  const slugger = new GithubSlugger();
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[*_`[\]]/g, "").trim();
    const id = slugger.slug(text);
    entries.push({ id, text, level });
  }
  return entries;
}

export function MarkdownViewer({ doc, downloadUrl, highlightQuery, typography }: MarkdownViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [activeId, setActiveId] = useState<string>("");
  const activeIdRef = useRef<string>("");

  const toggleToc = useCallback(() => {
    const el = contentRef.current;
    const pinnedId = activeIdRef.current || undefined;
    setTocOpen((v) => !v);
    if (el && pinnedId) {
      requestAnimationFrame(() => {
        const heading = el.querySelector(`#${CSS.escape(pinnedId)}`) as HTMLElement | null;
        if (heading) el.scrollTop = heading.offsetTop;
      });
    }
  }, []);
  const contentRef = useRef<HTMLDivElement>(null);
  const { savePosition, registerJump } = useReaderProgress();
  const { progress } = useReadingProgress(doc._id);
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1, 0.1, 0.5, 2);
  const restored = useRef(false);

  // ── Highlight state ──
  const { highlights, addHighlight, removeHighlight, updateNote, addBookmark } = useHighlights(doc._id);
  const [hlMenu, setHlMenu] = useState<{
    x: number; y: number;
    existingId?: Id<"highlights">; existingColor?: HighlightColor;
    pendingPos?: HighlightPosition;
  } | null>(null);
  const [notePopover, setNotePopover] = useState<{
    x: number; y: number;
    highlightId: Id<"highlights">;
    initialNote: string;
  } | null>(null);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [noteCard, setNoteCard] = useState<{
    x: number; y: number;
    highlightId: Id<"highlights">;
  } | null>(null);

  // ── Doc notes (free-form, not tied to highlight) ──
  const { notes: docNotes, addNote, updateNote: updateDocNote, removeNote } = useNotes(doc._id);
  const [docNotePopover, setDocNotePopover] = useState<{
    noteId?: Id<"notes">;
    initialBody: string;
    initialTitle?: string;
  } | null>(null);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const text = range.toString().trim();
    if (!text) return;

    // Must be inside the prose content area
    const el = contentRef.current;
    if (!el || !el.contains(range.commonAncestorContainer)) return;

    // Compute XPath of the common ancestor relative to content root
    function getXPath(node: Node, root: Node): string {
      if (node === root) return ".";
      const parts: string[] = [];
      let cur: Node | null = node;
      while (cur && cur !== root) {
        if (cur.nodeType === Node.ELEMENT_NODE) {
          const el = cur as Element;
          const tag = el.tagName.toLowerCase();
          let idx = 1;
          let sib = el.previousElementSibling;
          while (sib) { if (sib.tagName === el.tagName) idx++; sib = sib.previousElementSibling; }
          parts.unshift(`${tag}[${idx}]`);
        }
        cur = cur.parentNode;
      }
      return parts.length ? parts.join("/") : ".";
    }

    const ancestor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode!
      : range.commonAncestorContainer;
    const xpath = getXPath(ancestor, el);

    // Calculate offsets within the ancestor's text content
    const anchorText = ancestor.textContent ?? "";
    const startOffset = range.startOffset + (range.startContainer !== ancestor
      ? (ancestor.textContent ?? "").indexOf(range.startContainer.textContent ?? "")
      : 0);

    const pos: HighlightPosition = {
      xpath,
      startOffset: Math.max(0, startOffset),
      endOffset: Math.max(0, startOffset + text.length),
      text,
    };

    setHlMenu({ x: e.clientX, y: e.clientY, pendingPos: pos });
    sel.removeAllRanges();
  }, []);

  const handleClickHighlight = useCallback(
    (id: Id<"highlights">, color: HighlightColor, x: number, y: number) => {
      setHlMenu({ x, y, existingId: id, existingColor: color });
    },
    []
  );

  const openNotePopover = useCallback((highlightId: Id<"highlights">, x: number, y: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = highlights.find((hl: any) => hl._id === highlightId);
    setNotePopover({ x, y, highlightId, initialNote: (h?.note as string | undefined) ?? "" });
  }, [highlights]);

  const scrollToHighlight = useCallback((highlightId: Id<"highlights">) => {
    const el = contentRef.current;
    if (!el) return;

    // Check if it's a bookmark — scroll by saved position instead of mark element
    const hl = (highlights as any[]).find((h) => h._id === highlightId);
    if (hl?.type === "bookmark") {
      try {
        const pos = JSON.parse(hl.positionValue);
        if (typeof pos.pct === "number") {
          // Try heading first for precision
          if (pos.headingId) {
            const heading = el.querySelector(`#${CSS.escape(pos.headingId)}`) as HTMLElement | null;
            if (heading) { heading.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
          }
          el.scrollTo({ top: pos.pct * (el.scrollHeight - el.clientHeight), behavior: "smooth" });
        }
      } catch { /* ignore */ }
      return;
    }

    const mark = el.querySelector(`mark[data-highlight-id="${highlightId}"]`) as HTMLElement | null;
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      mark.style.outline = "2px solid #7c3aed";
      mark.style.outlineOffset = "2px";
      setTimeout(() => { mark.style.outline = ""; mark.style.outlineOffset = ""; }, 1200);
    }
  }, [highlights]);

  const handleClickNoteHighlight = useCallback((id: Id<"highlights">, x: number, y: number) => {
    setNoteCard({ x, y, highlightId: id });
  }, []);

  // Ctrl/Cmd+N — open note for the last-clicked highlight
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n" && hlMenu?.existingId) {
        e.preventDefault();
        openNotePopover(hlMenu.existingId, hlMenu.x, hlMenu.y);
        setHlMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hlMenu, openNotePopover]);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "scroll_pct" && contentRef.current) {
        const el = contentRef.current;
        const pct = (pos as { type: "scroll_pct"; pct: number }).pct;
        requestAnimationFrame(() => {
          el.scrollTop = pct * (el.scrollHeight - el.clientHeight);
        });
      }
    });
  }, [registerJump]);

  useEffect(() => {
    fetch(downloadUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => new TextDecoder("utf-8").decode(buf))
      .then(setContent)
      .catch(() => setError("Không thể tải file Markdown"));
  }, [downloadUrl]);

  const toc = useMemo(() => (content ? extractToc(content) : []), [content]);

  // Restore scroll position after content renders
  useEffect(() => {
    if (restored.current || !content || !contentRef.current || !progress) return;
    if (progress.positionType !== "scroll_pct") return;
    let pct: number;
    let headingId: string | undefined;
    try {
      const pos = JSON.parse(progress.positionValue);
      if (typeof pos.pct !== "number") return;
      pct = pos.pct;
      headingId = typeof pos.headingId === "string" ? pos.headingId : undefined;
    } catch {
      return;
    }
    restored.current = true;

    const el = contentRef.current;
    let attempts = 0;
    const tryScroll = () => {
      // Prefer heading-based restore for cross-device accuracy
      if (headingId) {
        const heading = el.querySelector(`#${CSS.escape(headingId)}`) as HTMLElement | null;
        if (heading) {
          el.scrollTop = heading.offsetTop;
          return;
        }
      }
      // Fallback: pct-based, retry until scrollHeight stabilises
      const h = el.scrollHeight - el.clientHeight;
      if (h > 10) el.scrollTop = pct * h;
      if (attempts++ < 8) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);
  }, [content, progress]);

  // Jump to first occurrence of highlightQuery after content renders
  useEffect(() => {
    if (!highlightQuery || !content || !contentRef.current) return;
    const container = contentRef.current;
    const lower = highlightQuery.toLowerCase();

    // Small delay to let DOM settle after markdown render
    const timer = setTimeout(() => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent ?? "";
        const idx = text.toLowerCase().indexOf(lower);
        if (idx === -1) continue;

        // Split text node around the match and wrap in <mark>
        const before = node.splitText(idx);
        before.splitText(lower.length);
        const mark = document.createElement("mark");
        mark.className = "search-jump";
        mark.style.cssText = "background:#fef08a;border-radius:2px;padding:0 1px;color:inherit";
        before.parentNode?.insertBefore(mark, before);
        mark.appendChild(before);
        mark.scrollIntoView({ behavior: "smooth", block: "center" });

        // Remove highlight after 3s
        setTimeout(() => {
          mark.replaceWith(...Array.from(mark.childNodes));
        }, 3000);
        break;
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [highlightQuery, content]);

  // Track active heading via IntersectionObserver on the content scroll area
  useEffect(() => {
    if (!content || !contentRef.current) return;
    const container = contentRef.current;
    const headings = Array.from(
      container.querySelectorAll("h1,h2,h3,h4,h5,h6")
    ) as HTMLElement[];
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
        activeIdRef.current = visible[0].target.id;
        setActiveId(visible[0].target.id);
      }
      },
      { root: container, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [content]);

  // Cached heading list — rebuilt only when content changes (not on every scroll)
  const headingsCacheRef = useRef<HTMLElement[]>([]);
  const scrollRafRef = useRef<number | undefined>(undefined);
  useEffect(() => () => { if (scrollRafRef.current !== undefined) cancelAnimationFrame(scrollRafRef.current); }, []);

  useEffect(() => {
    if (!content || !contentRef.current) return;
    // Small delay to let ReactMarkdown finish painting
    const timer = setTimeout(() => {
      headingsCacheRef.current = Array.from(
        contentRef.current!.querySelectorAll("h1,h2,h3,h4,h5,h6")
      ) as HTMLElement[];
    }, 200);
    return () => clearTimeout(timer);
  }, [content]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      // Throttle via rAF — skip if a frame is already pending
      if (scrollRafRef.current !== undefined) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = undefined;
        const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
        // Use cached headings instead of querying DOM each scroll
        let headingId: string | undefined;
        for (const h of headingsCacheRef.current) {
          if (h.offsetTop <= el.scrollTop + 8) headingId = h.id;
          else break;
        }
        savePosition({ type: "scroll_pct", pct: Math.min(1, Math.max(0, pct)), headingId });
      });
    },
    [savePosition]
  );

  const scrollToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      activeIdRef.current = id;
      setActiveId(id);
    }
  }, []);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive text-sm">
        {error}
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const minLevel = toc.length > 0 ? Math.min(...toc.map((t) => t.level)) : 1;
  const hasToc = toc.length > 0;

  const mdComponents: Components = {
    code({ className, children, ...props }) {
      const lang = /language-(\w+)/.exec(className ?? "")?.[1];
      const code = String(children).replace(/\n$/, "");
      if (lang === "mermaid") return <MermaidBlock code={code} />;
      return <code className={className} {...props}>{children}</code>;
    },
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── TOC Sidebar — independent scroll ── */}
      {hasToc && tocOpen && (
        <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
          {/* Sidebar header */}
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Mục lục</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={toggleToc}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Sidebar TOC — its own scroll */}
          <nav className="flex-1 overflow-y-auto py-2">
            {toc.map((entry, i) => {
              const indent = (entry.level - minLevel) * 12;
              const isActive = activeId === entry.id;
              return (
                <button
                  key={`${entry.id}-${i}`}
                  onClick={() => scrollToHeading(entry.id)}
                  style={{ paddingLeft: `${indent + 16}px` }}
                  className={[
                    "flex w-full items-start gap-1 py-1.5 pr-3 text-left text-[13px] leading-snug transition-colors",
                    isActive
                      ? "border-r-2 border-primary bg-primary/8 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")}
                >
                  {entry.level <= 2 && (
                    <span className="mt-px shrink-0 text-[10px] opacity-35 font-mono">
                      {"#".repeat(entry.level)}
                    </span>
                  )}
                  <span className="min-w-0 break-words">{entry.text}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* ── Main content — independent scroll ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar: TOC toggle + zoom + notes */}
        <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
          <div>
            {hasToc && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={toggleToc}>
                <List className="h-3.5 w-3.5" />
                {tocOpen ? "Ẩn mục lục" : "Mục lục"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Annotation panel toggle */}
            {/* Annotation panel toggle */}
            <button
              onClick={() => setNotePanelOpen((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                notePanelOpen
                  ? "bg-amber-100 text-amber-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              title="Highlights & Ghi chú"
            >
              <Highlighter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Highlights</span>
              {highlights.length > 0 && (
                <span className={[
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                  notePanelOpen ? "bg-amber-600 text-white" : "bg-amber-500 text-white",
                ].join(" ")}>
                  {highlights.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setNotesPanelOpen((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                notesPanelOpen
                  ? "bg-violet-100 text-violet-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              title="Ghi chú cá nhân"
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ghi chú</span>
            </button>
            <button
              onClick={() => {
                const el = contentRef.current;
                if (!el) return;
                const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
                const headings = Array.from(el.querySelectorAll("h1,h2,h3,h4,h5,h6")) as HTMLElement[];
                let headingId: string | undefined;
                for (const h of headings) {
                  if (h.offsetTop <= el.scrollTop + 8) headingId = h.id;
                  else break;
                }
                addBookmark(Math.min(1, Math.max(0, pct)), headingId).catch(() => {});
              }}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Thêm bookmark tại vị trí này"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bookmark</span>
            </button>
            <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={2} />
          </div>
        </div>

        {/* Content area */}
        <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={handleScroll} onPointerUp={handleMouseUp}>
          <div className={`mx-auto px-4 py-8 sm:px-6 ${typography?.colWidthClass ?? "max-w-3xl"}`} style={{ zoom: scale, fontFamily: typography?.fontFamily, fontSize: typography?.fontSize, lineHeight: typography?.lineHeight }}>
            <article className="prose prose-neutral dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeSlug, rehypeHighlight, rehypeKatex, rehypeRaw]}
                components={mdComponents}
              >
                {content}
              </ReactMarkdown>
            </article>
          </div>
        </div>

        {/* Highlight layer — re-anchors saved highlights onto DOM */}
        <HighlightLayer
          contentRef={contentRef}
          highlights={(highlights as any[]).map((h) => ({ ...h, customColor: h.customColor }))}
          onClickHighlight={handleClickHighlight}
          onClickNoteHighlight={handleClickNoteHighlight}
        />

        {/* Floating highlight menu */}
        {hlMenu && (
          <HighlightMenu
            x={hlMenu.x}
            y={hlMenu.y}
            existingId={hlMenu.existingId}
            existingColor={hlMenu.existingColor}
            onSelectColor={(color, customColor) => {
              if (hlMenu.pendingPos) {
                addHighlight(color, hlMenu.pendingPos, customColor).catch(() => {});
              }
            }}
            onNoteAction={hlMenu.pendingPos ? () => {
              // Create purple highlight then immediately open note popover
              if (hlMenu.pendingPos) {
                addHighlight("purple", hlMenu.pendingPos)
                  .then((id) => {
                    if (id) setNotePopover({ x: hlMenu.x, y: hlMenu.y, highlightId: id as any, initialNote: "" });
                  })
                  .catch(() => {});
              }
            } : undefined}
            onOpenNote={hlMenu.existingId
              ? () => openNotePopover(hlMenu.existingId!, hlMenu.x, hlMenu.y)
              : undefined}
            onDelete={hlMenu.existingId ? () => removeHighlight(hlMenu.existingId!).catch(() => {}) : undefined}
            onClose={() => setHlMenu(null)}
          />
        )}

        {/* Note popover */}
        {notePopover && (
          <NotePopover
            x={notePopover.x}
            y={notePopover.y}
            initialNote={notePopover.initialNote}
            onSave={(note) => updateNote(notePopover.highlightId, note || undefined).catch(() => {})}
            onClose={() => setNotePopover(null)}
          />
        )}

        {/* Note card — shown on click, closed on outside click */}
        {noteCard && (() => {
          const h = (highlights as any[]).find((hl) => hl._id === noteCard.highlightId);
          if (!h?.note) return null;
          return (
            <NoteHoverCard
              x={noteCard.x}
              y={noteCard.y}
              selectedText={h.selectedText ?? ""}
              note={h.note}
              color={h.color}
              onEdit={() => {
                setNoteCard(null);
                openNotePopover(noteCard.highlightId, noteCard.x, noteCard.y);
              }}
              onClose={() => setNoteCard(null)}
            />
          );
        })()}
      </div>

      {/* Notes side panel — personal notes workspace */}
      {notesPanelOpen && (
        <NotesSidePanel onClose={() => setNotesPanelOpen(false)} />
      )}

      {/* Annotation panel — right sidebar (highlights + notes tabs) */}
      {notePanelOpen && (
        <AnnotationPanel
          highlights={(highlights as any[]).map((h) => ({
            _id: h._id,
            color: h.color,
            customColor: h.customColor,
            selectedText: h.selectedText,
            note: h.note,
            type: h.type,
            createdAt: h.createdAt ?? 0,
          }))}
          docNotes={(docNotes as any[]).map((n) => ({
            _id: n._id,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt ?? 0,
          }))}
          onClose={() => setNotePanelOpen(false)}
          onScrollTo={scrollToHighlight}
          onEditHighlightNote={(id) => openNotePopover(id, window.innerWidth / 2, window.innerHeight / 2)}
          onDeleteHighlight={(id) => removeHighlight(id).catch(() => {})}
          onDeleteHighlightNote={(id) => updateNote(id, undefined).catch(() => {})}
          onDeleteHighlightRecord={(id) => removeHighlight(id).catch(() => {})}
          onAddDocNote={() => setDocNotePopover({ initialBody: "", initialTitle: "" })}
          onEditDocNote={(id) => {
            const n = (docNotes as any[]).find((n) => n._id === id);
            if (n) setDocNotePopover({ noteId: id, initialBody: n.body, initialTitle: n.title });
          }}
          onDeleteDocNote={(id) => removeNote(id).catch(() => {})}
        />
      )}

      {/* Doc note popover */}
      {docNotePopover && (
        <DocNotePopover
          noteId={docNotePopover.noteId}
          initialBody={docNotePopover.initialBody}
          initialTitle={docNotePopover.initialTitle}
          onSave={(body, title) => {
            if (docNotePopover.noteId) {
              updateDocNote(docNotePopover.noteId, body, title).catch(() => {});
            } else {
              addNote(body, title).catch(() => {});
            }
          }}
          onDelete={docNotePopover.noteId
            ? () => removeNote(docNotePopover.noteId!).catch(() => {})
            : undefined}
          onClose={() => setDocNotePopover(null)}
        />
      )}
    </div>
  );
}
