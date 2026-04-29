"use client";

import { useEffect, useRef } from "react";

interface MermaidBlockProps {
  code: string;
}

// Module-level SVG cache: code → svg string
const svgCache = new Map<string, string>();

// Singleton init promise
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

let diagCounter = 0;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether this instance has already rendered to avoid double-render in Strict Mode
  const doneRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If cached, inject immediately — no flash
    const cached = svgCache.get(code);
    if (cached) {
      el.innerHTML = cached;
      doneRef.current = true;
      return;
    }

    if (doneRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const mermaid = await getMermaid();
        if (cancelled || doneRef.current) return;

        const id = `mmd-${++diagCounter}`;
        const { svg, bindFunctions } = await mermaid.render(id, code.trim());

        if (cancelled) return;

        // Clean up the detached SVG element mermaid appends to <body>
        document.getElementById(id)?.remove();

        svgCache.set(code, svg);
        doneRef.current = true;
        el.innerHTML = svg;
        bindFunctions?.(el);
      } catch (e) {
        if (!cancelled && el) {
          const msg = e instanceof Error ? e.message : String(e);
          el.innerHTML = `<details class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
            <summary class="cursor-pointer px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400">Diagram lỗi — bấm để xem</summary>
            <pre class="px-3 pb-2 pt-1 text-xs text-red-500 whitespace-pre-wrap overflow-x-auto">${msg}</pre>
          </details>`;
          doneRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      // Do NOT reset doneRef on cleanup — Strict Mode runs cleanup+setup twice,
      // we want the second run to skip if first already succeeded
    };
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="my-4 flex min-h-[3rem] justify-center overflow-x-auto rounded-lg"
    />
  );
}
