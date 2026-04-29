"use client";

import { useEffect, useRef, useState } from "react";

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

export function MermaidBlock({ code }: MermaidBlockProps) {
  const key = code.trim();

  // If already cached, render synchronously — zero flicker on remount
  const [svg, setSvg] = useState<string | null>(() => svgCache.get(key) ?? null);
  const [error, setError] = useState<string | null>(() => errorCache.get(key) ?? null);
  const renderingRef = useRef(false);

  useEffect(() => {
    if (svg || error) return;          // already done
    if (renderingRef.current) return;  // already in-flight
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
        errorCache.set(key, msg);
        setError(msg);
      }
    })();
    // no cleanup — let it finish even if parent re-renders
  }, [key, svg, error]);

  if (error) {
    return (
      <details className="my-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
        <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          Diagram lỗi — bấm để xem
        </summary>
        <pre className="overflow-x-auto px-3 pb-2 pt-1 text-xs text-red-500 whitespace-pre-wrap">
          {error}
        </pre>
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
    <div
      className="my-4 flex justify-center overflow-x-auto rounded-lg"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
