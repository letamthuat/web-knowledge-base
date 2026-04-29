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
    const upstream = await fetch(url);
    console.log("[proxy-audio] upstream status:", upstream.status);
    if (!upstream.ok) {
      const text = await upstream.text();
      console.log("[proxy-audio] upstream error body:", text.slice(0, 200));
      return NextResponse.json({ error: "Upstream error", status: upstream.status }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();
    console.log("[proxy-audio] success, bytes:", body.byteLength);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (e) {
    console.log("[proxy-audio] fetch error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
