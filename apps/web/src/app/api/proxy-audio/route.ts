import { NextRequest, NextResponse } from "next/server";

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

  console.log("[proxy-audio] url:", url, "hostname:", h, "allowed:", allowed);

  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed", hostname: h }, { status: 403 });
  }

  try {
    const fetchHeaders: HeadersInit = {};
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const upstream = await fetch(url, { headers: fetchHeaders });
    console.log("[proxy-audio] upstream status:", upstream.status);
    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text();
      console.log("[proxy-audio] upstream error body:", text.slice(0, 200));
      return NextResponse.json({ error: "Upstream error", status: upstream.status }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const body = await upstream.arrayBuffer();
    console.log("[proxy-audio] success, bytes:", body.byteLength);

    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=600",
      "Accept-Ranges": "bytes",
    };
    if (contentLength) resHeaders["Content-Length"] = contentLength;
    if (contentRange) resHeaders["Content-Range"] = contentRange;

    return new NextResponse(body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: resHeaders,
    });
  } catch (e) {
    console.log("[proxy-audio] fetch error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
