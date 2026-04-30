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

// Mermaid v11 erDiagram reserved words — cannot be used as entity names or labels unquoted
const ER_RESERVED = new Set([
  "to", "po", "as", "at", "of", "in", "is", "on", "or", "by",
  "and", "for", "the", "has", "use", "via", "per", "do", "if",
]);

/**
 * Sanitize erDiagram code for mermaid v11:
 * 1. Entity names that are reserved words → rename with _T suffix globally
 * 2. Relationship labels containing reserved segments → wrap in quotes
 */
function sanitizeMermaid(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("erDiagram")) return raw;

  // Collect reserved entity names from relationship lines
  const reservedEntities = new Set<string>();
  const relLineRe = /^\s*(\w[\w_]*)\s+[\|o}{]{2,}[-–—]+[\|o}{]{2,}\s+(\w[\w_]*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = relLineRe.exec(raw)) !== null) {
    if (ER_RESERVED.has(m[1].toLowerCase())) reservedEntities.add(m[1]);
    if (ER_RESERVED.has(m[2].toLowerCase())) reservedEntities.add(m[2]);
  }

  let code = raw;

  // Rename reserved entity names with _T suffix (whole-word replacement)
  for (const name of reservedEntities) {
    code = code.replace(new RegExp(`\\b${name}\\b`, "g"), `${name}_T`);
  }

  // Wrap relationship labels that contain reserved word segments
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
        // Log code để debug syntax errors
        console.warn("[Mermaid] render failed:", msg, "\n---\n", key);
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
          Diagram lỗi — bấm để xem chi tiết
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <pre className="text-xs text-red-500 whitespace-pre-wrap">{error}</pre>
          <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{key}</pre>
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
    <div
      className="my-4 flex justify-center overflow-x-auto rounded-lg"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
