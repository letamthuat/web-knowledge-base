// Middleware cho auth routing
// Better Auth session check được thực hiện client-side ở library/page.tsx
// Middleware này chỉ thêm security headers bổ sung (CSP đã trong next.config.ts)
import { type NextRequest, NextResponse } from "next/server";

// Danh sách public routes (không cần auth)
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/verify-email", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cho phép public routes, static assets, và API routes qua
  if (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip internal Next.js paths và static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
