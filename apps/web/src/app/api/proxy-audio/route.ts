import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Allow large file streaming — no body size limit
export const maxDuration = 300; // 5 min timeout for large files

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const h = parsed.hostname;
  const allowed =
    h.endsWith(".r2.cloudflarestorage.com") ||
    h.endsWith(".cloudflare.com") ||
    h.endsWith(".convex.cloud") ||
    h.endsWith(".convex.site") ||
    h.endsWith(".amazonaws.com");

  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed", hostname: h }, { status: 403 });
  }

  try {
    const fetchHeaders: HeadersInit = {};
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const upstream = await fetch(url, { headers: fetchHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "Upstream error", status: upstream.status }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=600",
      "Accept-Ranges": "bytes",
    };
    if (contentLength) resHeaders["Content-Length"] = contentLength;
    if (contentRange) resHeaders["Content-Range"] = contentRange;

    // Stream the response body directly — no buffering in memory
    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: resHeaders,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
