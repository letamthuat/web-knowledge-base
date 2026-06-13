"use client";

import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { ReactNode, useEffect } from "react";
import { api } from "@/_generated/api";
import { useRouter, usePathname } from "next/navigation";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
  "/offline"
];

function SessionRedirectGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (isPending) return;

    if (!session && !isPublicRoute) {
      router.replace("/login");
    } else if (session && isPublicRoute && pathname !== "/offline") {
      router.replace("/library");
    }
  }, [session, isPending, pathname, router, isPublicRoute]);

  // While loading session on a protected route, show a loader to avoid flashing unauthenticated UI
  if (isPending && !isPublicRoute) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // While redirecting an unauthenticated user on a protected route, show the loader as well
  if (!session && !isPublicRoute) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

function UserExistenceGuard({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const me = useQuery((api as any).users?.queries?.me ?? (api as any)["users/queries"]?.me);

  useEffect(() => {
    // me === undefined = query loading; me === null = user not in DB → signout
    if (session && me === null) {
      signOut();
    }
  }, [session, me]);

  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <SessionRedirectGuard>
        <UserExistenceGuard>
          {children}
        </UserExistenceGuard>
      </SessionRedirectGuard>
    </ConvexBetterAuthProvider>
  );
}

