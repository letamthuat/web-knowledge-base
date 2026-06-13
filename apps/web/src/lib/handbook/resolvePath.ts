export type ResolvedLink =
  | { kind: "external" }
  | { kind: "anchor"; anchor: string }
  | { kind: "internal"; relPath: string; anchor?: string };

const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:)?\/\//i; // http://, https://, //cdn
const SCHEME_RE = /^(mailto:|tel:|data:)/i;

/**
 * Chuẩn hóa 1 href tương đối (trong markdown) thành relPath của handbook.
 * baseRelPath = relPath của doc đang mở (vd "06-warehouse.md" hoặc "m06/sub.md").
 */
export function resolveRelative(baseRelPath: string, hrefRaw: string): ResolvedLink {
  const href = (hrefRaw ?? "").trim();
  if (!href) return { kind: "external" };
  if (EXTERNAL_RE.test(href) || SCHEME_RE.test(href)) return { kind: "external" };

  // Anchor thuần trong trang
  if (href.startsWith("#")) return { kind: "anchor", anchor: href.slice(1) };

  // Tách anchor + query
  let path = href;
  let anchor: string | undefined;
  const hashIdx = path.indexOf("#");
  if (hashIdx >= 0) { anchor = path.slice(hashIdx + 1); path = path.slice(0, hashIdx); }
  const qIdx = path.indexOf("?");
  if (qIdx >= 0) path = path.slice(0, qIdx);
  if (!path) return anchor ? { kind: "anchor", anchor } : { kind: "external" };

  // Base directory của doc hiện tại
  const baseSegs = baseRelPath.split("/").slice(0, -1);

  // Path bắt đầu bằng "/" → tương đối với gốc handbook
  const startSegs = path.startsWith("/") ? [] : baseSegs.slice();
  const parts = path.replace(/^\/+/, "").split("/");

  const stack = startSegs;
  for (const seg of parts) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { stack.pop(); continue; }
    stack.push(seg);
  }

  const relPath = stack.join("/");
  if (!relPath) return { kind: "external" };
  return { kind: "internal", relPath, anchor };
}
