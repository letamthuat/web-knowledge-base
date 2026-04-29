"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidBlockProps {
  code: string;
}

// Singleton init promise — ensures mermaid.initialize() runs exactly once
let initPromise: Promise<typeof import("mermaid")["default"]> | null = null;

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

// Incrementing ID to avoid mermaid's internal ID cache collisions on re-render
let diagCounter = 0;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRendered(false);

    const el = containerRef.current;
    if (!el) return;

    (async () => {
      try {
        const mermaid = await getMermaid();
        if (cancelled) return;

        // Unique ID each render to avoid mermaid SVG ID conflicts
        const id = `mmd-${++diagCounter}`;

        // mermaid.render() attaches a temp element to document.body — clean it up after
        const { svg, bindFunctions } = await mermaid.render(id, code.trim());
        if (cancelled) return;

        el.innerHTML = svg;
        bindFunctions?.(el);
        setRendered(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Lỗi render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <details className="my-4 rounded-lg border border-destructive/30 bg-destructive/5">
        <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-destructive">
          Diagram lỗi — bấm để xem chi tiết
        </summary>
        <pre className="overflow-x-auto px-4 pb-3 pt-1 text-xs text-destructive/80 whitespace-pre-wrap">
          {error}
        </pre>
      </details>
    );
  }

  return (
    <div className="relative my-4">
      {!rendered && (
        <div className="flex h-16 items-center justify-center rounded-lg bg-muted/40">
          <span className="text-xs text-muted-foreground">Đang tải diagram…</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={[
          "flex justify-center overflow-x-auto rounded-lg",
          rendered ? "block" : "hidden",
        ].join(" ")}
      />
    </div>
  );
}
