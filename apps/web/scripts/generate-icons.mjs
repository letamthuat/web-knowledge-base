/**
 * Generates PWA icons for Web Knowledge Base.
 * Requires: sharp (already in deps)
 * Run: node apps/web/scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

function makeSvg(size, maskable = false) {
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.1);
  const inner = size - pad * 2;
  const fontSize = Math.round(inner * 0.38);
  const rx = maskable ? 0 : Math.round(size * 0.2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="#2563eb"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.36}"
    font-family="system-ui, -apple-system, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
  >WKB</text>
</svg>`;
}

const specs = [
  { name: "icon-192.png",          size: 192, maskable: false },
  { name: "icon-512.png",          size: 512, maskable: false },
  { name: "icon-192-maskable.png", size: 192, maskable: true  },
  { name: "icon-512-maskable.png", size: 512, maskable: true  },
  { name: "apple-touch-icon.png",  size: 180, maskable: false },
];

for (const { name, size, maskable } of specs) {
  const svg = Buffer.from(makeSvg(size, maskable));
  await sharp(svg).png().toFile(join(outDir, name));
  console.log(`✓ ${name}`);
}

console.log(`\nAll icons written to apps/web/public/icons/`);
