// Chuyển nội dung note BlockNote (JSON cột `body`) → Markdown.
// Dùng: node tools/blocknote-to-md.mjs <file.json> > "ten-note.md"
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) { console.error("Thiếu đường dẫn file JSON. Vd: node tools/blocknote-to-md.mjs note-body.json > note.md"); process.exit(1); }

let blocks = JSON.parse(readFileSync(path, "utf8"));
if (!Array.isArray(blocks)) blocks = blocks.blocks ?? blocks.content ?? [];

// Inline: text + styles (bold/italic/code/strike/highlight).
function inline(content) {
  if (!Array.isArray(content)) return "";
  return content.map((n) => {
    if (n.type === "link") return `[${inline(n.content)}](${n.href})`;
    let t = n.text ?? "";
    if (!t) return "";
    const s = n.styles ?? {};
    if (s.code) t = "`" + t + "`";
    if (s.bold) t = `**${t}**`;
    if (s.italic) t = `*${t}*`;
    if (s.strike) t = `~~${t}~~`;
    if (s.backgroundColor && s.backgroundColor !== "default") t = `==${t}==`; // highlight (Obsidian)
    return t;
  }).join("");
}

function tableToMd(block) {
  const rows = block.content?.rows ?? [];
  if (!rows.length) return "";
  const render = (cells) => "| " + cells.map((c) => inline(c.content).replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ") + " |";
  const out = [render(rows[0].cells)];
  out.push("| " + rows[0].cells.map(() => "---").join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) out.push(render(rows[i].cells));
  return out.join("\n");
}

const lines = [];
function walk(list, depth) {
  for (const b of list) {
    const indent = "  ".repeat(depth);
    const txt = inline(b.content);
    switch (b.type) {
      case "heading":
        lines.push("#".repeat(b.props?.level ?? 1) + " " + txt, "");
        break;
      case "paragraph":
        lines.push(txt, "");
        break;
      case "bulletListItem":
        lines.push(indent + "- " + txt);
        break;
      case "numberedListItem":
        lines.push(indent + "1. " + txt);
        break;
      case "checkListItem":
        lines.push(indent + `- [${b.props?.checked ? "x" : " "}] ` + txt);
        break;
      case "quote":
        lines.push("> " + txt, "");
        break;
      case "codeBlock":
        lines.push("```" + (b.props?.language ?? ""), txt, "```", "");
        break;
      case "table":
        lines.push(tableToMd(b), "");
        break;
      case "divider":
        lines.push("---", "");
        break;
      case "image":
        lines.push(`![${b.props?.caption ?? ""}](${b.props?.url ?? ""})`, "");
        break;
      case "file": case "video": case "audio":
        lines.push(`[${b.type}: ${b.props?.name ?? b.props?.url ?? ""}](${b.props?.url ?? ""})`, "");
        break;
      default:
        if (txt) lines.push(indent + txt);
    }
    if (Array.isArray(b.children) && b.children.length) walk(b.children, depth + 1);
  }
}

walk(blocks, 0);
// Gộp dòng trống thừa
process.stdout.write(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n");
