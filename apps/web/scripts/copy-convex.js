// Copy convex/_generated into src/_generated so @/_generated resolves correctly on Vercel
const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "../../../convex/_generated");
const dest = path.resolve(__dirname, "../src/_generated");

function copyDir(from, to) {
  if (!fs.existsSync(from)) {
    console.log(`[copy-convex] Source not found: ${from}`);
    return;
  }
  fs.mkdirSync(to, { recursive: true });
  for (const file of fs.readdirSync(from)) {
    const srcFile = path.join(from, file);
    const destFile = path.join(to, file);
    if (fs.statSync(srcFile).isDirectory()) {
      copyDir(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  }
}

copyDir(src, dest);
console.log(`[copy-convex] Copied convex/_generated → src/_generated`);
