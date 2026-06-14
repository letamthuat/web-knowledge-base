"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
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
import { List, X, Highlighter, StickyNote, Bookmark, Sparkles, Lightbulb, Info, AlertTriangle, AlertOctagon } from "lucide-react";
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
import { useHandbookResolver } from "@/components/handbook/HandbookResolverContext";
import { resolveRelative } from "@/lib/handbook/resolvePath";
import { CrossLinkHoverCard } from "@/components/handbook/CrossLinkHoverCard";

interface MarkdownViewerProps {
  doc: { _id: Id<"documents">; title: string; relPath?: string; handbookId?: Id<"handbooks"> };
  downloadUrl: string;
  highlightQuery?: string;
  typography?: { fontFamily: string; fontSize: number; lineHeight: number; colWidthClass: string };
}

type Resolver = NonNullable<ReturnType<typeof useHandbookResolver>>;

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

// LazySection: renders a placeholder until the section is near the viewport,
// then mounts ReactMarkdown. Prevents rendering thousands of DOM nodes upfront.
const LazySection = memo(function LazySection({
  content,
  components,
  scrollRoot,
}: {
  content: string;
  components: Components;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Estimate height from content length — avoids layout collapse after mount
  const estimatedHeight = Math.max(200, Math.round(content.length * 0.6));

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setMounted(true); observer.disconnect(); } },
      { root: scrollRoot.current, rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, scrollRoot]);

  return (
    <div ref={ref} style={!mounted ? { minHeight: estimatedHeight } : undefined}>
      {mounted && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeSlug, rehypeHighlight, rehypeKatex, rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      )}
    </div>
  );
});

// Split large markdown into sections at top-level headings (h1/h2).
// Each section is rendered independently so content-visibility:auto can skip off-screen ones.
// For small docs (<20KB) returns a single section to avoid overhead.
function splitIntoSections(markdown: string): string[] {
  if (markdown.length < 20_000) return [markdown];
  const lines = markdown.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock && /^#{1,2}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current.join("\n"));
  return sections.length > 0 ? sections : [markdown];
}

// ──────────────────────────────────────────────
// Callout/Alert Parser & Styling for Blockquotes
// ──────────────────────────────────────────────

interface CalloutStyle {
  bgClass: string;
  borderClass: string;
  borderLeftClass: string;
  textClass: string;
  iconColor: string;
  defaultEmoji: string;
  iconName: string;
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M17.71 9.88c-1.34-1.46-3.1-2.92-5.71-7.88-.36 0-.68.22-.8.56C10 6 8 8.23 6.29 9.88a7 7 0 00-2 5 7.7 7.7 0 0015.4 0 7 7 0 00-2-5z" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const CALLOUT_STYLES: Record<string, CalloutStyle> = {
  INSIGHT: {
    bgClass: "bg-[#edf8f9] dark:bg-[#0c2a2d]/80",
    borderClass: "border-[#cbe8e9] dark:border-[#194a4e]/85",
    borderLeftClass: "",
    textClass: "text-[#00828a] dark:text-[#4cd4dd]",
    iconColor: "text-[#00828a] dark:text-[#4cd4dd]",
    defaultEmoji: "💡",
    iconName: "LeafIcon",
  },
  TIP: {
    bgClass: "bg-[#edf8f9] dark:bg-[#0c2a2d]/80",
    borderClass: "border-[#cbe8e9] dark:border-[#194a4e]/85",
    borderLeftClass: "",
    textClass: "text-[#00828a] dark:text-[#4cd4dd]",
    iconColor: "text-[#00828a] dark:text-[#4cd4dd]",
    defaultEmoji: "💡",
    iconName: "LeafIcon",
  },
  NOTE: {
    bgClass: "bg-[#f0f4f9] dark:bg-[#0f1e2d]/80",
    borderClass: "border-[#d6e2f0] dark:border-[#19334e]/85",
    borderLeftClass: "",
    textClass: "text-[#005fb8] dark:text-[#60a5fa]",
    iconColor: "text-[#005fb8] dark:text-[#60a5fa]",
    defaultEmoji: "📝",
    iconName: "PencilIcon",
  },
  INFO: {
    bgClass: "bg-[#f0f4f9] dark:bg-[#0f1e2d]/80",
    borderClass: "border-[#d6e2f0] dark:border-[#19334e]/85",
    borderLeftClass: "",
    textClass: "text-[#005fb8] dark:text-[#60a5fa]",
    iconColor: "text-[#005fb8] dark:text-[#60a5fa]",
    defaultEmoji: "ℹ️",
    iconName: "PencilIcon",
  },
  WARNING: {
    bgClass: "bg-[#fef6ed] dark:bg-[#2d200f]/80",
    borderClass: "border-[#fbe4ce] dark:border-[#4e3619]/85",
    borderLeftClass: "",
    textClass: "text-[#b35b00] dark:text-[#f59e0b]",
    iconColor: "text-[#b35b00] dark:text-[#f59e0b]",
    defaultEmoji: "⚠️",
    iconName: "AlertTriangle",
  },
  CAUTION: {
    bgClass: "bg-[#fef6ed] dark:bg-[#2d200f]/80",
    borderClass: "border-[#fbe4ce] dark:border-[#4e3619]/85",
    borderLeftClass: "",
    textClass: "text-[#b35b00] dark:text-[#f59e0b]",
    iconColor: "text-[#b35b00] dark:text-[#f59e0b]",
    defaultEmoji: "⚠️",
    iconName: "AlertTriangle",
  },
  IMPORTANT: {
    bgClass: "bg-[#edf8f9] dark:bg-[#0c2a2d]/80",
    borderClass: "border-[#cbe8e9] dark:border-[#194a4e]/85",
    borderLeftClass: "",
    textClass: "text-[#00828a] dark:text-[#4cd4dd]",
    iconColor: "text-[#00828a] dark:text-[#4cd4dd]",
    defaultEmoji: "📌",
    iconName: "LeafIcon",
  },
  DANGER: {
    bgClass: "bg-[#fdf2f2] dark:bg-[#2d0f0f]/80",
    borderClass: "border-[#fcd2d2] dark:border-[#4e1919]/85",
    borderLeftClass: "",
    textClass: "text-[#c81e1e] dark:text-[#f87171]",
    iconColor: "text-[#c81e1e] dark:text-[#f87171]",
    defaultEmoji: "🚫",
    iconName: "AlertOctagon",
  },
  CRITICAL: {
    bgClass: "bg-[#fdf2f2] dark:bg-[#2d0f0f]/80",
    borderClass: "border-[#fcd2d2] dark:border-[#4e1919]/85",
    borderLeftClass: "",
    textClass: "text-[#c81e1e] dark:text-[#f87171]",
    iconColor: "text-[#c81e1e] dark:text-[#f87171]",
    defaultEmoji: "🚨",
    iconName: "AlertOctagon",
  },
};

function getFirstText(node: React.ReactNode): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const child of node) {
      const txt = getFirstText(child);
      if (txt) return txt;
    }
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getFirstText(el.props.children);
  }
  return "";
}

function parseCalloutStart(node: React.ReactNode) {
  const text = getFirstText(node).trim();
  
  // 1. Check Obsidian / GitHub style: [!NOTE]
  const obsidianMatch = text.match(/^\[!(\w+)\]/i);
  if (obsidianMatch) {
    return {
      type: obsidianMatch[1].toUpperCase(),
      isCallout: true as const,
      rawPrefix: obsidianMatch[0],
    };
  }
  
  // 2. Check emoji/keyword style: e.g. "💡 INSIGHT —"
  const keywordMatch = text.match(/^([^\w\n]*)\s*(INSIGHT|NOTE|TIP|WARNING|IMPORTANT|CAUTION|DANGER|INFO|CRITICAL)\s*(?:—|:|-)/i);
  if (keywordMatch) {
    return {
      type: keywordMatch[2].toUpperCase(),
      isCallout: true as const,
      rawPrefix: keywordMatch[0],
    };
  }
  
  return { isCallout: false as const };
}

function stripPrefix(node: React.ReactNode, prefix: string): React.ReactNode {
  if (!node) return node;
  if (typeof node === "string") {
    const trimmedNode = node.trimStart();
    if (trimmedNode.startsWith(prefix)) {
      return trimmedNode.slice(prefix.length).trimStart();
    }
    return node;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) return node;
    const firstCleaned = stripPrefix(node[0], prefix);
    if (firstCleaned === "") {
      return node.slice(1);
    }
    return [firstCleaned, ...node.slice(1)];
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    const children = el.props.children;
    const newChildren = stripPrefix(children, prefix);
    return React.cloneElement(el, { children: newChildren } as any);
  }
  return node;
}

function splitAtFirstNewline(node: React.ReactNode): { title: React.ReactNode; body: React.ReactNode } {
  if (!node) return { title: null, body: null };

  if (typeof node === "string") {
    const newlineIndex = node.indexOf("\n");
    if (newlineIndex !== -1) {
      const title = node.substring(0, newlineIndex);
      const body = node.substring(newlineIndex + 1);
      return { title, body };
    }
    return { title: node, body: null };
  }

  if (Array.isArray(node)) {
    const titleArray: React.ReactNode[] = [];
    const bodyArray: React.ReactNode[] = [];
    let splitFound = false;

    for (const child of node) {
      if (splitFound) {
        bodyArray.push(child);
      } else {
        const { title: childTitle, body: childBody } = splitAtFirstNewline(child);
        if (childTitle !== null) titleArray.push(childTitle);
        if (childBody !== null) {
          bodyArray.push(childBody);
          splitFound = true;
        }
      }
    }
    return {
      title: titleArray.length > 0 ? titleArray : null,
      body: bodyArray.length > 0 ? bodyArray : null,
    };
  }

  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    const children = el.props.children;
    const { title: titleChildren, body: bodyChildren } = splitAtFirstNewline(children);
    
    const titleEl = titleChildren !== null ? React.cloneElement(el, { children: titleChildren } as any) : null;
    const bodyEl = bodyChildren !== null ? React.cloneElement(el, { children: bodyChildren } as any) : null;
    
    return { title: titleEl, body: bodyEl };
  }

  return { title: node, body: null };
}

function renderCallout(type: string, titleNode: React.ReactNode, bodyNodes: React.ReactNode[]) {
  const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.NOTE;

  let IconComponent: React.ComponentType<{ className?: string }> = Info;
  if (style.iconName === "LeafIcon") IconComponent = LeafIcon;
  else if (style.iconName === "PencilIcon") IconComponent = PencilIcon;
  else if (style.iconName === "AlertTriangle") IconComponent = AlertTriangle;
  else if (style.iconName === "AlertOctagon") IconComponent = AlertOctagon;

  const hasTitle = getFirstText(titleNode).trim().length > 0;

  return (
    <div className={`my-6 p-5 rounded-xl border ${style.bgClass} ${style.borderClass} transition-all duration-200`}>
      <div className={`flex items-start gap-2.5 font-semibold text-sm mb-3 ${style.textClass} tracking-wide`}>
        <IconComponent className={`h-4.5 w-4.5 shrink-0 mt-0.5`} />
        {hasTitle ? (
          <div className="text-[14px] font-semibold leading-snug">{titleNode}</div>
        ) : (
          <span className="uppercase text-[11px] font-bold tracking-widest opacity-80">{type}</span>
        )}
      </div>
      {bodyNodes.length > 0 && (
        <div className="text-[14.5px] leading-relaxed text-foreground/90 select-text prose-p:my-2 prose-blockquote:my-0 not-italic font-normal">
          {bodyNodes}
        </div>
      )}
    </div>
  );
}

const P_COMPONENT: Components["p"] = function P({ children, ...props }: any) {
  const callout = parseCalloutStart(children);
  if (!callout.isCallout) {
    return <p {...props}>{children}</p>;
  }

  const cleanedChildren = stripPrefix(children, callout.rawPrefix);
  const { title: titlePart, body: bodyPart } = splitAtFirstNewline(cleanedChildren);
  
  let titleNode: React.ReactNode = null;
  if (titlePart !== null) {
    if (React.isValidElement(titlePart)) {
      titleNode = (titlePart as any).props.children;
    } else {
      titleNode = titlePart;
    }
  }

  const bodyNodes: React.ReactNode[] = [];
  if (bodyPart !== null) {
    bodyNodes.push(bodyPart);
  }

  return renderCallout(callout.type, titleNode, bodyNodes);
};

const BLOCKQUOTE_COMPONENT: Components["blockquote"] = function Blockquote({ children, ...props }: any) {
  const childrenArray = React.Children.toArray(children).filter((child) => {
    if (typeof child === "string" && child.trim() === "") return false;
    return true;
  });
  if (childrenArray.length === 0) {
    return (
      <blockquote className="my-6 border-l-4 border-muted/50 pl-4 italic text-muted-foreground bg-muted/10 py-2 pr-2 rounded-r-lg" {...props}>
        {children}
      </blockquote>
    );
  }

  const c0 = childrenArray[0];
  const callout = parseCalloutStart(c0);
  
  if (!callout.isCallout) {
    return (
      <blockquote className="my-6 border-l-4 border-muted/50 pl-4 italic text-muted-foreground bg-muted/10 py-2 pr-2 rounded-r-lg" {...props}>
        {children}
      </blockquote>
    );
  }

  const c0_cleaned = stripPrefix(c0, callout.rawPrefix);
  const { title: titlePart, body: bodyPart } = splitAtFirstNewline(c0_cleaned);
  
  let titleNode: React.ReactNode = null;
  let bodyNodes: React.ReactNode[] = [];
  
  if (titlePart !== null) {
    if (React.isValidElement(titlePart)) {
      titleNode = (titlePart as any).props.children;
    } else {
      titleNode = titlePart;
    }
    bodyNodes = childrenArray.slice(1);
  } else {
    titleNode = null;
    bodyNodes = childrenArray.slice(1);
  }

  if (bodyPart !== null) {
    bodyNodes = [bodyPart, ...bodyNodes];
  }

  return renderCallout(callout.type, titleNode, bodyNodes);
};

const TABLE_COMPONENTS = {
  table({ children, ...props }: any) {
    return (
      <div className="my-6 overflow-x-auto rounded-lg border border-border/80 shadow-sm">
        <table className="min-w-full divide-y divide-border border-collapse text-sm text-left" {...props}>
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }: any) {
    return <thead className="bg-muted/40 border-b border-border/80" {...props}>{children}</thead>;
  },
  tbody({ children, ...props }: any) {
    return <tbody className="divide-y divide-border/60 bg-card/5" {...props}>{children}</tbody>;
  },
  tr({ children, ...props }: any) {
    return <tr className="hover:bg-muted/10 transition-colors" {...props}>{children}</tr>;
  },
  th({ children, ...props }: any) {
    return <th className="px-4 py-3 font-semibold text-foreground border border-border/60" {...props}>{children}</th>;
  },
  td({ children, ...props }: any) {
    return <td className="px-4 py-2.5 border border-border/40 align-middle not-italic font-normal" {...props}>{children}</td>;
  }
};

const CODE_COMPONENT: Components["code"] = function Code({ className, children, ...props }) {
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];
  const code = String(children).replace(/\n$/, "");
  if (lang === "mermaid") return <MermaidBlock code={code} />;
  return <code className={className} {...props}>{children}</code>;
};

const MD_COMPONENTS: Components = {
  code: CODE_COMPONENT,
  blockquote: BLOCKQUOTE_COMPONENT,
  p: P_COMPONENT,
  ...TABLE_COMPONENTS
};

// Factory: khi doc thuộc handbook, override img/a để resolve relative link (12.4).
// onHoverLink(docId, x, y) để bật hover preview (13.3); null khi rời chuột.
function makeComponents(
  resolver: Resolver | null,
  baseRelPath: string,
  onHoverLink: (info: { docId: Id<"documents">; x: number; y: number } | null) => void,
): Components {
  if (!resolver || !baseRelPath) return MD_COMPONENTS;

  return {
    code: CODE_COMPONENT,
    blockquote: BLOCKQUOTE_COMPONENT,
    p: P_COMPONENT,
    ...TABLE_COMPONENTS,
    img({ src, alt, ...props }) {
      const original = typeof src === "string" ? src : "";
      const r = resolveRelative(baseRelPath, original);
      if (r.kind === "internal") {
        const url = resolver.getImageUrl(r.relPath);
        if (url) return <img src={url} alt={alt ?? ""} crossOrigin="anonymous" {...props} />;
      }
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={original} alt={alt ?? ""} crossOrigin="anonymous" {...props} />;
    },
    a({ href, children, ...props }) {
      const original = typeof href === "string" ? href : "";
      const r = resolveRelative(baseRelPath, original);

      if (r.kind === "internal") {
        const target = resolver.filesByPath.get(r.relPath);
        if (target) {
          return (
            <a
              href={`/reader/${target.docId}`}
              onClick={(e) => { e.preventDefault(); resolver.openInternal(target.docId, r.anchor); }}
              onMouseEnter={(e) => onHoverLink({ docId: target.docId, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => onHoverLink(null)}
              className="text-primary underline decoration-dotted underline-offset-2"
              {...props}
            >
              {children}
            </a>
          );
        }
        // Không khớp file nào — render link thường (no-op điều hướng)
        return <a className="text-muted-foreground underline decoration-dotted" {...props}>{children}</a>;
      }

      if (r.kind === "anchor") {
        return <a href={`#${r.anchor}`} {...props}>{children}</a>;
      }

      return <a href={original} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
  };
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

  // ── Handbook relative-link resolver (12.4) + cross-link hover (13.3) ──
  const resolver = useHandbookResolver();
  const baseRelPath = doc.relPath ?? "";
  const [linkHover, setLinkHover] = useState<{ docId: Id<"documents">; x: number; y: number } | null>(null);
  const onHoverLink = useCallback((info: { docId: Id<"documents">; x: number; y: number } | null) => {
    setLinkHover(info);
  }, []);
  const mdComponents = useMemo(
    () => makeComponents(resolver, baseRelPath, onHoverLink),
    [resolver, baseRelPath, onHoverLink]
  );

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
      .then((txt) => {
        setContent(txt);
        fetch("/api/debug-log", { method: "POST", body: txt }).catch(() => {});
      })
      .catch(() => setError("Không thể tải file Markdown"));
  }, [downloadUrl]);

  const toc = useMemo(() => (content ? extractToc(content) : []), [content]);
  const sections = useMemo(() => (content ? splitIntoSections(content) : []), [content]);

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

  // Track active heading via IntersectionObserver — only update ref, batch setActiveId via rAF
  const activeIdRafRef = useRef<number | undefined>(undefined);
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
          // Batch DOM update — skip if a frame is already scheduled
          if (activeIdRafRef.current === undefined) {
            activeIdRafRef.current = requestAnimationFrame(() => {
              activeIdRafRef.current = undefined;
              setActiveId(activeIdRef.current);
            });
          }
        }
      },
      { root: container, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => { observer.disconnect(); if (activeIdRafRef.current !== undefined) cancelAnimationFrame(activeIdRafRef.current); };
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

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Backdrop for floating TOC on mobile */}
      {hasToc && tocOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={toggleToc}
        />
      )}

      {/* ── TOC Sidebar — independent scroll ── */}
      {hasToc && tocOpen && (
        <aside className="absolute md:relative left-0 top-0 bottom-0 z-30 flex w-60 shrink-0 flex-col border-r bg-card h-full shadow-2xl md:shadow-none">
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
                  onClick={() => {
                    scrollToHeading(entry.id);
                    if (window.innerWidth < 768) {
                      setTocOpen(false);
                    }
                  }}
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
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 dark:bg-slate-950/70"
          style={{ WebkitOverflowScrolling: "touch", willChange: "scroll-position" } as React.CSSProperties}
          onScroll={handleScroll}
          onPointerUp={handleMouseUp}
        >
          <div className={`mx-auto px-4 py-10 sm:px-6 md:px-8 ${typography?.colWidthClass ?? "max-w-4xl"}`} style={{ zoom: scale }}>
            <div className="bg-card text-card-foreground border border-border/60 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] px-6 py-10 sm:px-12 sm:py-12 md:px-16 md:py-16" style={{ fontFamily: typography?.fontFamily, fontSize: typography?.fontSize, lineHeight: typography?.lineHeight }}>
              <article className="prose prose-neutral dark:prose-invert max-w-none">
                {sections.length === 1 ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeSlug, rehypeHighlight, rehypeKatex, rehypeRaw]}
                    components={mdComponents}
                  >
                    {sections[0]}
                  </ReactMarkdown>
                ) : (
                  sections.map((section, i) => (
                    <LazySection
                      key={i}
                      content={section}
                      components={mdComponents}
                      scrollRoot={contentRef}
                    />
                  ))
                )}
              </article>
            </div>
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

        {/* Cross-link hover preview (13.3) */}
        {linkHover && (
          <CrossLinkHoverCard docId={linkHover.docId} x={linkHover.x} y={linkHover.y} />
        )}
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
