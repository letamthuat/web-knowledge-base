const CONTEXT = 60;
const MAX_LEN = 140;

export function snippet(text: string, q: string): string {
  if (!text || !q) return text.slice(0, MAX_LEN);

  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lower.indexOf(lowerQ);

  if (idx === -1) {
    return escapeHtml(text.slice(0, MAX_LEN)) + (text.length > MAX_LEN ? "…" : "");
  }

  const start = Math.max(0, idx - CONTEXT);
  const end = Math.min(text.length, idx + q.length + CONTEXT);
  const before = (start > 0 ? "…" : "") + escapeHtml(text.slice(start, idx));
  const match = `<mark class="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0.5">${escapeHtml(text.slice(idx, idx + q.length))}</mark>`;
  const after = escapeHtml(text.slice(idx + q.length, end)) + (end < text.length ? "…" : "");

  return before + match + after;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
