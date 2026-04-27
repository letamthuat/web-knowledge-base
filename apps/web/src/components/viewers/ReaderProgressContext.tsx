"use client";

import { createContext, useContext } from "react";
import type { SaveStatus } from "@/hooks/useReadingProgress";
import type { ReadingPosition } from "@/lib/position";

interface ReaderProgressContextValue {
  saveStatus: SaveStatus;
  saveNow: () => void;
  /** Save position. Pass `total` so progressPct can be computed correctly. */
  savePosition: (pos: ReadingPosition, total?: number) => void;
  /** Jump to a position from history. Viewers subscribe via onJumpRef. */
  jumpTo: (pos: ReadingPosition) => void;
  /** Viewers register their jump handler here. */
  registerJump: (fn: (pos: ReadingPosition) => void) => void;
}

export const ReaderProgressContext = createContext<ReaderProgressContextValue>({
  saveStatus: "idle",
  saveNow: () => {},
  savePosition: () => {},
  jumpTo: () => {},
  registerJump: () => {},
});

export function useReaderProgress() {
  return useContext(ReaderProgressContext);
}
