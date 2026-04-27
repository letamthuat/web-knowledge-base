"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Id } from "@/../../../convex/_generated/dataModel";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZoomControls, useZoom } from "@/components/viewers/ZoomControls";

interface DOCXViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

interface TocEntry { id: string; text: string; level: number }

function buildToc(container: HTMLElement): TocEntry[] {
  const entries: TocEntry[] = [];
  let counter = 0;
  container.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
    const level = parseInt(el.tagName[1]);
    const text = (el.textContent ?? "").trim();
    if (!text) return;
    const id = `docx-h-${counter++}`;
    el.id = id;
    entries.push({ id, text, level });
  });
  return entries;
}

export function DOCXViewer({ doc, downloadUrl }: DOCXViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [tocOpen, setTocOpen] = useState(true);
  const [activeId, setActiveId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { savePosition, registerJump } = useReaderProgress();
  const { progress } = useReadingProgress(doc._id);
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1, 0.1, 0.5, 2);
  const restored = useRef(false);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "scroll_pct" && scrollRef.current) {
        const el = scrollRef.current;
        const pct = (pos as { type: "scroll_pct"; pct: number }).pct;
        requestAnimationFrame(() => {
          el.scrollTop = pct * (el.scrollHeight - el.clientHeight);
        });
      }
    });
  }, [registerJump]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(downloadUrl);
        const arrayBuffer = await res.arrayBuffer();
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer }, {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
          ],
        });
        setHtml(result.value);
      } catch {
        setError("Không thể tải file DOCX.");
      }
    })();
  }, [downloadUrl]);

  // Build TOC after HTML renders into DOM
  useEffect(() => {
    if (!html || !scrollRef.current) return;
    const entries = buildToc(scrollRef.current);
    setToc(entries);
  }, [html]);

  // Restore scroll position after HTML renders
  useEffect(() => {
    if (restored.current || !html || !scrollRef.current || !progress) return;
    if (progress.positionType === "scroll_pct") {
      try {
        const pos = JSON.parse(progress.positionValue);
        if (typeof pos.pct === "number") {
          const el = scrollRef.current;
          requestAnimationFrame(() => {
            el.scrollTop = pos.pct * (el.scrollHeight - el.clientHeight);
          });
        }
      } catch {}
    }
    restored.current = true;
  }, [html, progress]);

  // Track active heading
  useEffect(() => {
    if (!toc.length || !scrollRef.current) return;
    const container = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { root: container, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    toc.forEach(({ id }) => {
      const el = container.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
    savePosition({ type: "scroll_pct", pct: Math.min(1, Math.max(0, pct)) });
  }, [savePosition]);

  const scrollToHeading = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`#${id}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); setActiveId(id); }
  }, []);

  const minLevel = useMemo(() =>
    toc.length ? Math.min(...toc.map((t) => t.level)) : 1, [toc]);

  if (error) return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{error}</div>;
  if (!html) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* TOC Sidebar */}
      {tocOpen && toc.length > 0 && (
        <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Mục lục</span>
          </div>
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
                    "flex w-full items-start py-1.5 pr-3 text-left text-[13px] leading-snug transition-colors",
                    isActive
                      ? "border-r-2 border-primary bg-primary/8 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="min-w-0 break-words">{entry.text}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
          <div>
            {toc.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setTocOpen((v) => !v)}>
                <List className="h-3.5 w-3.5" />
                {tocOpen ? "Ẩn mục lục" : "Mục lục"}
              </Button>
            )}
          </div>
          <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={2} />
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          <div className="mx-auto max-w-3xl px-8 py-10" style={{ zoom: scale }}>
            {/* Page-like wrapper */}
            <div className="min-h-[29.7cm] rounded-lg border border-border/50 bg-white px-16 py-12 shadow-sm dark:bg-zinc-900">
              <article
                className="prose prose-neutral dark:prose-invert max-w-none
                  prose-headings:font-semibold prose-headings:tracking-tight
                  prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                  prose-table:border-collapse prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5
                  prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50
                  prose-img:rounded-lg prose-img:shadow-sm"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
