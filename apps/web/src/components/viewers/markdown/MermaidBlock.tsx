"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidBlockProps {
  code: string;
}

let mermaidInitialized = false;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (!mermaidInitialized) {
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
        mermaidInitialized = true;
      }
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code.trim());
        el.innerHTML = svg;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi render diagram");
      }
    })();
  }, [code]);

  if (error) {
    return (
      <pre className="rounded bg-destructive/10 p-3 text-xs text-destructive whitespace-pre-wrap">
        {error}
      </pre>
    );
  }

  return <div ref={ref} className="my-4 flex justify-center overflow-x-auto" />;
}
