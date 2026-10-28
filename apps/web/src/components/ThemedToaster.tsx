"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Toaster theo theme đọc của app (html.rm-dark) — sonner mặc định luôn sáng. */
export function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setTheme(html.classList.contains("rm-dark") || html.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
      richColors
      position="top-right"
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
