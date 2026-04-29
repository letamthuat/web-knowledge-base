"use client";

import dynamic from "next/dynamic";

// Disable SSR để tránh hydration mismatch do auth/convex state
const ReaderPageInner = dynamic(() => import("./ReaderPageInner"), { ssr: false });

export default function ReaderPage() {
  return <ReaderPageInner />;
}
