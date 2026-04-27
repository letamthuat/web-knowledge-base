export type { ReadingPosition, PositionType } from "./types";
export { toProgressPct } from "./types";

import type { ReadingPosition, PositionType } from "./types";

export function serialize(pos: ReadingPosition): string {
  return JSON.stringify(pos);
}

export function deserialize(s: string, expectedType: PositionType): ReadingPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    throw new Error(`Invalid position JSON: ${s}`);
  }
  if (typeof parsed !== "object" || parsed === null || (parsed as Record<string, unknown>).type !== expectedType) {
    throw new Error(`Position type mismatch: expected "${expectedType}", got "${(parsed as Record<string, unknown>)?.type}"`);
  }
  return parsed as ReadingPosition;
}
