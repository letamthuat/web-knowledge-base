"use client";

import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { ReactNode, useEffect } from "react";
import { api } from "@/_generated/api";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

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
      <UserExistenceGuard>
        {children}
      </UserExistenceGuard>
    </ConvexBetterAuthProvider>
  );
}
