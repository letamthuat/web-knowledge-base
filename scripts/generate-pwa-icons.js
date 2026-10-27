const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.join(__dirname, '..', 'apps', 'web', 'public');
const iconsDir = path.join(publicDir, 'icons');
const logoSvgPath = path.join(publicDir, 'logo.svg');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const svgContent = fs.readFileSync(logoSvgPath, 'utf8');

async function generateIcons() {
  console.log('Generating PWA icons with sharp...');

  // 1. Standard Icons
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 2. Maskable Icons (Android requires 80% safe zone with solid/gradient full bleed background)
  // For 512x512 maskable, inner content size = 512 * 0.76 = 389px.
  // We create a background with the exact same gradient, and overlay the resized logo at center.
  const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgMask" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#060d18"/>
      <stop offset="100%" stop-color="#0d1f35"/>
    </linearGradient>
  </defs>
  <!-- Full bleed background covering 100% of the canvas so any launcher mask is seamless -->
  <rect width="512" height="512" fill="url(#bgMask)"/>
</svg>`;

  const bgBuffer = await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toBuffer();
  const innerLogo512 = await sharp(Buffer.from(svgContent))
    .resize(384, 384) // 75% of 512, perfectly inside 80% safe circle
    .png()
    .toBuffer();

  const maskable512 = await sharp(bgBuffer)
    .composite([{ input: innerLogo512, top: 64, left: 64 }])
    .png()
    .toFile(path.join(iconsDir, 'icon-512-maskable.png'));
  console.log('Generated icon-512-maskable.png');

  // Resize the 512 maskable to 192 for icon-192-maskable.png
  await sharp(path.join(iconsDir, 'icon-512-maskable.png'))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192-maskable.png'));
  console.log('Generated icon-192-maskable.png');

  console.log('All PWA icons successfully generated!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
