import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { apiKey } = body;
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  let data: {
    models?: {
      name: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }[];
    error?: { message: string };
  };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { cache: "no-store" }
    );
    data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? `API error ${res.status}` },
        { status: res.status }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${e}` }, { status: 502 });
  }

  // Filter: has generateContent AND name contains "flash"
  const models = (data.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        m.name.toLowerCase().includes("flash")
    )
    .map((m) => m.name.replace("models/", ""));

  return NextResponse.json({ models });
}
