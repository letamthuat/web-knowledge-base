import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const filePath = "c:\\1. FOR STUDY\\8. WEB KNOWLEDGE BASE\\doc_raw.md";
    fs.writeFileSync(filePath, body, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
