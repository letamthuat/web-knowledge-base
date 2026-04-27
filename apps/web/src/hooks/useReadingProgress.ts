"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { serialize, toProgressPct } from "@/lib/position";
import type { ReadingPosition } from "@/lib/position";

function uuidv7(): string {
  const now = Date.now();
  const hi = Math.floor(now / 0x1000);
  const lo = now & 0xfff;
  const rand = crypto.getRandomValues(new Uint8Array(10));
  const hex = [
    hi.toString(16).padStart(8, "0"),
    (((lo << 4) | (rand[0] & 0xf)) >>> 0).toString(16).padStart(4, "0"),
    ((0x7000 | (rand[1] & 0xfff)) >>> 0).toString(16).padStart(4, "0"),
    ((0x8000 | (rand[2] & 0x3fff)) >>> 0).toString(16).padStart(4, "0"),
    Array.from(rand.slice(3, 9)).map((b) => b.toString(16).padStart(2, "0")).join(""),
  ];
  return hex.join("-");
}

const THROTTLE_MS = 5000;

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export function useReadingProgress(docId: Id<"documents">) {
  const progress = useQuery(api.reading_progress.queries.getByDoc, { docId });
  const upsertMutation = useMutation(api.reading_progress.mutations.upsert);

  const pendingRef = useRef<{ pos: ReadingPosition; total?: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
  }, []);

  const flush = useCallback(
    async (pos: ReadingPosition, total?: number) => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timer);
        pendingRef.current = null;
      }
      setSaveStatus("saving");
      const now = Date.now();
      try {
        await upsertMutation({
          docId,
          positionType: pos.type,
          positionValue: serialize(pos),
          progressPct: toProgressPct(pos, total) ?? undefined,
          clientMutationId: uuidv7(),
          updatedAt: now,
        });
        markSaved();
      } catch {
        setSaveStatus("error");
      }
    },
    [docId, upsertMutation, markSaved]
  );

  // savePosition now accepts optional total at call site
  const savePosition = useCallback(
    (pos: ReadingPosition, total?: number) => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer);
      setSaveStatus("pending");
      const timer = setTimeout(() => flush(pos, total), THROTTLE_MS);
      pendingRef.current = { pos, total, timer };
    },
    [flush]
  );

  const saveNow = useCallback(() => {
    if (pendingRef.current) {
      flush(pendingRef.current.pos, pendingRef.current.total);
    }
  }, [flush]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && pendingRef.current) {
        flush(pendingRef.current.pos, pendingRef.current.total);
      }
    };
    const handleBeforeUnload = () => {
      if (pendingRef.current) flush(pendingRef.current.pos, pendingRef.current.total);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (pendingRef.current) clearTimeout(pendingRef.current.timer);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, [flush]);

  return { progress, savePosition, saveNow, saveStatus };
}
