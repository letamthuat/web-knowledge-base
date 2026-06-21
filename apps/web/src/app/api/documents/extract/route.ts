// POST { docId } → trích xuất text cho FTS, ghi vào documents.extractedText.
// Thay convex internal action documents.actions.extractText.
// Gọi fire-and-forget từ finalizeUpload/finalizeImport (lib/api).
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

async function fetchR2Bytes(storageKey: string): Promise<Buffer> {
  const r2 = getR2Client();
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docId } = (await request.json()) as { docId?: string };
  if (!docId) return NextResponse.json({ error: "Missing docId" }, { status: 400 });

  // RLS đảm bảo chỉ doc của user.
  const { data: doc } = await supabase
    .from("documents")
    .select("_id, title, format, storageKey, extractedText, clippedContent")
    .eq("_id", docId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.extractedText) return NextResponse.json({ skipped: true });

  const format = doc.format as string;
  let text = doc.title as string; // fallback

  try {
    if (format === "audio" || format === "video" || format === "image") {
      text = doc.title;
    } else if (format === "web_clip" && doc.clippedContent) {
      text = stripHtml(doc.clippedContent as string);
    } else {
      const buffer = await fetchR2Bytes(doc.storageKey as string);
      if (format === "markdown") {
        text = new TextDecoder("utf-8").decode(buffer);
      } else if (format === "web_clip") {
        text = stripHtml(new TextDecoder("utf-8").decode(buffer));
      } else if (format === "pdf") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs" as never)) as any;
        pdfjs.GlobalWorkerOptions.workerSrc = "";
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parts.push(content.items.map((it: any) => ("str" in it ? it.str : "")).join(" "));
        }
        text = parts.join("\n");
      } else if (format === "docx") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mammoth = (await import("mammoth" as never)) as any;
        const result = await mammoth.extractRawText({ buffer });
        text = result.value ?? doc.title;
      } else if (format === "epub") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const JSZipMod = (await import("jszip" as never)) as any;
        const JSZip = JSZipMod.default ?? JSZipMod;
        const zip = await JSZip.loadAsync(buffer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const htmlFiles: any[] = [];
        zip.forEach((path: string, file: unknown) => {
          if (/\.x?html?$/.test(path)) htmlFiles.push(file);
        });
        const htmlParts = await Promise.all(htmlFiles.map((f) => f.async("string")));
        text = htmlParts.map((h: string) => stripHtml(h)).join("\n");
      }
      // pptx và định dạng khác → giữ fallback title
    }
  } catch {
    text = doc.title;
  }

  const { error } = await supabase.from("documents").update({ extractedText: text }).eq("_id", docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, length: text.length });
}
