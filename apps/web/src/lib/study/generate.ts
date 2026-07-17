"use client";
// Client helper gọi route AI sinh nội dung học (on-demand). Truyền key Gemini của user.
import type { CardType, QuizQuestion, FeynmanRubric } from "@/lib/api/study";

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

export async function requestPreQuestions(input: { scopeText: string; unitLabel: string } & Key): Promise<string[]> {
  const res = await fetch("/api/study/generate-pre", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scopeText: input.scopeText,
      unitLabel: input.unitLabel,
      geminiApiKey: input.geminiApiKey ?? undefined,
      geminiModels: input.geminiModels ?? undefined,
    }),
  });
  const data = (await res.json()) as { questions?: string[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Sinh câu hỏi định hướng thất bại");
  return data.questions ?? [];
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

export async function requestFeynmanGrade(
  input: { audioBase64: string; mimeType: string; scopeText: string; unitLabels: string; isLinked: boolean } & Key,
): Promise<{ rubric: FeynmanRubric; transcript: string }> {
  const res = await fetch("/api/study/grade-feynman", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audioBase64: input.audioBase64,
      mimeType: input.mimeType,
      scopeText: input.scopeText,
      unitLabels: input.unitLabels,
      isLinked: input.isLinked,
      geminiApiKey: input.geminiApiKey ?? undefined,
      geminiModels: input.geminiModels ?? undefined,
    }),
  });
  const data = (await res.json()) as { rubric?: FeynmanRubric; transcript?: string; error?: string };
  if (!res.ok || !data.rubric) throw new Error(data.error ?? "Chấm Feynman thất bại");
  return { rubric: data.rubric, transcript: data.transcript ?? "" };
}
