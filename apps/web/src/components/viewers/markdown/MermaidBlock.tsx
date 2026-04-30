"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, ZoomIn, ZoomOut, X, RotateCcw } from "lucide-react";

interface MermaidBlockProps {
  code: string;
}

const svgCache = new Map<string, string>();
const errorCache = new Map<string, string>();

let initPromise: Promise<typeof import("mermaid")["default"]> | null = null;
let diagCounter = 0;

function getMermaid() {
  if (!initPromise) {
    initPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        fontFamily: "inherit",
      });
      return m.default;
    });
  }
  return initPromise;
}

const ER_RESERVED = new Set([
  "to", "po", "as", "at", "of", "in", "is", "on", "or", "by",
  "and", "for", "the", "has", "use", "via", "per", "do", "if",
]);

function sanitizeMermaid(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("erDiagram")) return raw;

  const reservedEntities = new Set<string>();
  const relLineRe = /^\s*(\w[\w_]*)\s+[\|o}{]{2,}[-–—]+[\|o}{]{2,}\s+(\w[\w_]*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = relLineRe.exec(raw)) !== null) {
    if (ER_RESERVED.has(m[1].toLowerCase())) reservedEntities.add(m[1]);
    if (ER_RESERVED.has(m[2].toLowerCase())) reservedEntities.add(m[2]);
  }

  let code = raw;
  for (const name of reservedEntities) {
    code = code.replace(new RegExp(`\\b${name}\\b`, "g"), `${name}_T`);
  }

  code = code.replace(
    /^(\s*\w[\w_]*\s+[\|o}{]{2,}[-–—]+[\|o}{]{2,}\s+\w[\w_]*\s*:\s*)([^\n"]+)/gm,
    (_, prefix, label) => {
      const t = label.trim();
      if (t.startsWith('"')) return prefix + label;
      const parts = t.split(/[_\s]+/);
      const needsQuote = parts.some((p: string) => ER_RESERVED.has(p.toLowerCase()));
      return needsQuote ? `${prefix}"${t}"` : prefix + label;
    }
  );

  return code;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const key = sanitizeMermaid(code.trim());

  const [svg, setSvg] = useState<string | null>(() => svgCache.get(key) ?? null);
  const [error, setError] = useState<string | null>(() => errorCache.get(key) ?? null);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const renderingRef = useRef(false);

  useEffect(() => {
    if (svg || error) return;
    if (renderingRef.current) return;
    renderingRef.current = true;

    (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `mmd-${++diagCounter}`;
        const { svg: rendered } = await mermaid.render(id, key);
        document.getElementById(id)?.remove();
        svgCache.set(key, rendered);
        setSvg(rendered);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[Mermaid] render failed:", msg, "\n---\n", key);
        errorCache.set(key, msg);
        setError(msg);
      }
    })();
  }, [key, svg, error]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const openFullscreen = useCallback(() => {
    setZoom(1);
    setFullscreen(true);
  }, []);

  const changeZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(5, Math.max(0.2, +(z + delta).toFixed(1))));
  }, []);

  if (error) {
    return (
      <details className="my-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
        <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          Diagram lỗi — bấm để xem chi tiết
        </summary>
        <div className="space-y-2 px-3 pb-3 pt-1">
          <pre className="whitespace-pre-wrap text-xs text-red-500">{error}</pre>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-muted-foreground">{key}</pre>
        </div>
      </details>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 flex h-12 items-center justify-center rounded-lg bg-muted/30">
        <span className="text-xs text-muted-foreground">Đang tải diagram…</span>
      </div>
    );
  }

  return (
    <>
      {/* Inline preview */}
      <div className="group relative my-4 overflow-hidden rounded-lg border bg-white dark:bg-neutral-900">
        {/* Toolbar */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => changeZoom(-0.2)}
            title="Thu nhỏ"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-white bg-black/60 rounded-md px-1 py-1 leading-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => changeZoom(0.2)}
            title="Phóng to"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Reset zoom"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={openFullscreen}
            title="Toàn màn hình"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* SVG inline — zoomable */}
        <div className="overflow-auto">
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}
            dangerouslySetInnerHTML={{ __html: svg }}
            className="flex justify-center p-4"
          />
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}
        >
          {/* Fullscreen toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="text-sm text-white/60">Diagram</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeZoom(-0.25)}
                title="Thu nhỏ"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[3.5rem] text-center text-sm text-white">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => changeZoom(0.25)}
                title="Phóng to"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                title="Reset zoom"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <div className="mx-2 h-5 w-px bg-white/20" />
              <button
                onClick={() => setFullscreen(false)}
                title="Đóng (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-red-500/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable SVG area */}
          <div className="flex-1 overflow-auto">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 0.15s",
                minHeight: "100%",
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
              className="flex min-h-full items-start justify-center p-8"
            />
          </div>

          {/* Hint */}
          <div className="shrink-0 py-2 text-center text-xs text-white/30">
            Nhấn Esc hoặc click ngoài để đóng · Cuộn để xem toàn bộ
          </div>
        </div>
      )}
    </>
  );
}
