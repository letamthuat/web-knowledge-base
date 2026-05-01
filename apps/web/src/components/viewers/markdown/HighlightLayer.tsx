"use client";

import { useEffect } from "react";
import { Id } from "@/_generated/dataModel";
import type { HighlightColor, HighlightPosition } from "@/hooks/useHighlights";

interface Highlight {
  _id: Id<"highlights">;
  color: HighlightColor;
  positionValue: string;
  selectedText?: string;
}

interface HighlightLayerProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  highlights: Highlight[];
  onClickHighlight: (id: Id<"highlights">, color: HighlightColor, x: number, y: number) => void;
}

const COLOR_CLASS: Record<HighlightColor, string> = {
  yellow: "hl-yellow",
  green:  "hl-green",
  blue:   "hl-blue",
  pink:   "hl-pink",
};

function getNodeByXPath(xpath: string, root: HTMLElement): Node | null {
  try {
    const result = document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  } catch {
    return null;
  }
}

function wrapRange(range: Range, id: string, colorClass: string, onClick: (e: MouseEvent) => void): HTMLElement | null {
  try {
    const mark = document.createElement("mark");
    mark.className = colorClass;
    mark.dataset.highlightId = id;
    mark.style.cursor = "pointer";
    range.surroundContents(mark);
    mark.addEventListener("click", onClick);
    return mark;
  } catch {
    // surroundContents fails when range crosses element boundaries — skip
    return null;
  }
}

export function HighlightLayer({ contentRef, highlights, onClickHighlight }: HighlightLayerProps) {
  useEffect(() => {
    const el = contentRef.current;
    if (!el || highlights.length === 0) return;

    const marks: HTMLElement[] = [];

    for (const h of highlights) {
      let pos: HighlightPosition;
      try {
        pos = JSON.parse(h.positionValue) as HighlightPosition;
      } catch {
        continue;
      }

      // Find the text node via XPath relative to content root
      const anchorNode = getNodeByXPath(pos.xpath, el);
      if (!anchorNode) continue;

      // Walk text nodes to find the exact offset
      const walker = document.createTreeWalker(anchorNode, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let startNode: Text | null = null;
      let startOff = 0;
      let endNode: Text | null = null;
      let endOff = 0;

      let node = walker.nextNode() as Text | null;
      while (node) {
        const len = node.length;
        if (!startNode && offset + len > pos.startOffset) {
          startNode = node;
          startOff = pos.startOffset - offset;
        }
        if (startNode && offset + len >= pos.endOffset) {
          endNode = node;
          endOff = pos.endOffset - offset;
          break;
        }
        offset += len;
        node = walker.nextNode() as Text | null;
      }

      if (!startNode || !endNode) continue;

      // Verify text still matches
      const range = document.createRange();
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      if (range.toString().trim() !== pos.text.trim()) continue;

      const colorClass = COLOR_CLASS[h.color];
      const hId = h._id;
      const hColor = h.color;

      const mark = wrapRange(range, hId, colorClass, (e) => {
        e.stopPropagation();
        onClickHighlight(hId, hColor, e.clientX, e.clientY);
      });
      if (mark) marks.push(mark);
    }

    return () => {
      // Unwrap all marks we created
      for (const mark of marks) {
        const parent = mark.parentNode;
        if (!parent) continue;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
      }
    };
  }, [contentRef, highlights, onClickHighlight]);

  return null;
}
