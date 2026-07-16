"use client";
// Client helper gọi route AI sinh nội dung học (on-demand). Truyền key Gemini của user.
import type { CardType } from "@/lib/api/study";

export type GenCard = { type: CardType; front: string; back: string; quote: string };

export async function requestGeneratedCards(input: {
  scopeText: string;
  unitLabel: string;
  geminiApiKey?: string | null;
  geminiModels?: string[] | null;
}): Promise<GenCard[]> {
  const res = await fetch("/api/study/generate-cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scopeText: input.scopeText,
      unitLabel: input.unitLabel,
      geminiApiKey: input.geminiApiKey ?? undefined,
      geminiModels: input.geminiModels ?? undefined,
    }),
  });
  const data = (await res.json()) as { cards?: GenCard[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Sinh card thất bại");
  return data.cards ?? [];
}
