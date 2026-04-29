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
import { List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidBlock } from "./MermaidBlock";
import { ZoomControls, useZoom } from "@/components/viewers/ZoomControls";
import type { Components } from "react-markdown";
import GithubSlugger from "github-slugger";

interface MarkdownViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
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

export function MarkdownViewer({ doc, downloadUrl }: MarkdownViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [activeId, setActiveId] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);
  const { savePosition, registerJump } = useReaderProgress();
  const { progress } = useReadingProgress(doc._id);
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1, 0.1, 0.5, 2);
  const restored = useRef(false);

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
      .then((r) => r.text())
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
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { root: container, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [content]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
      // Find the last heading that has scrolled past the top
      const headings = Array.from(el.querySelectorAll("h1,h2,h3,h4,h5,h6")) as HTMLElement[];
      let headingId: string | undefined;
      for (const h of headings) {
        if (h.offsetTop <= el.scrollTop + 8) headingId = h.id;
        else break;
      }
      savePosition({ type: "scroll_pct", pct: Math.min(1, Math.max(0, pct)), headingId });
    },
    [savePosition]
  );

  const scrollToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
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
              onClick={() => setTocOpen(false)}
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
        {/* Toolbar: TOC toggle + zoom */}
        <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
          <div>
            {hasToc && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setTocOpen((v) => !v)}>
                <List className="h-3.5 w-3.5" />
                {tocOpen ? "Ẩn mục lục" : "Mục lục"}
              </Button>
            )}
          </div>
          <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={2} />
        </div>

        {/* Content area */}
        <div ref={contentRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          <div className="mx-auto max-w-3xl px-6 py-8" style={{ zoom: scale }}>
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
      </div>
    </div>
  );
}
