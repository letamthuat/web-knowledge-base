const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;

async function handler(request: Request) {
  const url = new URL(request.url);
  const targetUrl = `${CONVEX_SITE_URL}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("accept-encoding", "application/json");

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
    // @ts-expect-error - Node.js fetch supports duplex
    duplex: "half",
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export const GET = handler;
export const POST = handler;
