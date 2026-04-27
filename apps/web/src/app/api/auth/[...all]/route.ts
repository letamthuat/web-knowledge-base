const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;

async function handler(request: Request) {
  const url = new URL(request.url);
  const targetUrl = `${CONVEX_SITE_URL}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("accept-encoding", "identity");

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "manual",
    // @ts-expect-error - Node.js fetch supports duplex
    duplex: "half",
  });

  const responseHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return; // handle separately
    responseHeaders.set(key, value);
  });

  // Copy all Set-Cookie headers individually to avoid merging
  const setCookieValues = res.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookieValues) {
    responseHeaders.append("set-cookie", cookie);
  }

  // Handle redirects from Better Auth
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith("http")
        ? location
        : `${url.origin}${location}`;
      const redirectResponse = Response.redirect(redirectUrl, res.status);
      const finalHeaders = new Headers(redirectResponse.headers);
      for (const cookie of setCookieValues) {
        finalHeaders.append("set-cookie", cookie);
      }
      return new Response(null, { status: res.status, headers: finalHeaders });
    }
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
