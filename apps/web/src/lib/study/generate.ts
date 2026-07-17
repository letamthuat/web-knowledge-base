"use client";
// Client helper gọi route AI sinh nội dung học (on-demand). Truyền key Gemini của user.
import type { CardType, QuizQuestion } from "@/lib/api/study";

export type GenCard = { type: CardType; front: string; back: string; quote: string };
export type EssayGrade = { credit: number; good: string[]; missing: string[] };
type Key = { geminiApiKey?: string | null; geminiModels?: string[] | null };

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

export async function requestGeneratedQuiz(input: { scopeText: string; unitLabel: string } & Key): Promise<QuizQuestion[]> {
  const res = await fetch("/api/study/generate-quiz", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scopeText: input.scopeText,
      unitLabel: input.unitLabel,
      geminiApiKey: input.geminiApiKey ?? undefined,
      geminiModels: input.geminiModels ?? undefined,
    }),
  });
  const data = (await res.json()) as { questions?: QuizQuestion[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Sinh đề quiz thất bại");
  return data.questions ?? [];
}

export async function requestEssayGrades(
  input: { items: { q: string; answer: string; feedbackGood: string[]; feedbackMissing: string[] }[] } & Key,
): Promise<EssayGrade[]> {
  const res = await fetch("/api/study/grade-essays", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: input.items,
      geminiApiKey: input.geminiApiKey ?? undefined,
      geminiModels: input.geminiModels ?? undefined,
    }),
  });
  const data = (await res.json()) as { grades?: EssayGrade[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Chấm tự luận thất bại");
  return data.grades ?? [];
}
