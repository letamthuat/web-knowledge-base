import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'apps/web/public/logo.svg');
const svg = readFileSync(svgPath);

const sizes = [
  { file: 'apps/web/public/icons/icon-192.png', size: 192 },
  { file: 'apps/web/public/icons/icon-512.png', size: 512 },
  { file: 'apps/web/public/icons/icon-192-maskable.png', size: 192 },
  { file: 'apps/web/public/icons/icon-512-maskable.png', size: 512 },
  { file: 'apps/web/public/icons/apple-touch-icon.png', size: 180 },
];

for (const { file, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(__dirname, file));
  console.log(`✓ ${file} (${size}x${size})`);
}

// favicon.ico = 32x32 png (Next.js uses png named favicon.ico)
await sharp(svg)
  .resize(32, 32)
  .png()
  .toFile(join(__dirname, 'apps/web/public/favicon.ico'));
console.log('✓ apps/web/public/favicon.ico (32x32)');

console.log('Done!');
