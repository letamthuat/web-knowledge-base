/** URL trong app shell → id panel ("library" | "notes" | … | "reader:<docId>"); null = route ngoài shell. */
export function pathnameToPanel(pathname: string): string | null {
  if (pathname === "/library/trash") return "trash";
  if (pathname === "/library" || pathname.startsWith("/library/")) return "library";
  if (pathname === "/notes"   || pathname.startsWith("/notes/"))   return "notes";
  if (pathname === "/study"   || pathname.startsWith("/study/"))   return "study";
  if (pathname === "/settings"|| pathname.startsWith("/settings/"))return "settings";
  const m = pathname.match(/^\/reader\/([^/]+)/);
  if (m) return `reader:${m[1]}`;
  return null;
}
