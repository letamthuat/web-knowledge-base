/**
 * Set CORS policy on R2 bucket for browser direct upload.
 *
 * Requires CLOUDFLARE_API_TOKEN env var with R2:Edit permission.
 * Get token from: https://dash.cloudflare.com/profile/api-tokens
 * Select template "Edit Cloudflare Workers" or create custom with R2:Edit
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=your_token node scripts/setup-r2-cors.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env.local
try {
  const envFile = readFileSync(resolve(__dirname, "../apps/web/.env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* ignore */ }

const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("❌ Missing R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY");
  console.error("   Add them to apps/web/.env.local");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

console.log(`Setting CORS on bucket "${R2_BUCKET_NAME}"...`);

try {
  await r2.send(new PutBucketCorsCommand({
    Bucket: R2_BUCKET_NAME,
    CORSConfiguration: {
      CORSRules: [{
        AllowedOrigins: ["*"],
        AllowedMethods: ["GET", "PUT", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      }],
    },
  }));
  console.log("✅ CORS set successfully!");
  console.log("   Browsers can now upload directly to R2.");
} catch (err) {
  if (err.Code === "AccessDenied" || err.message?.includes("Access Denied")) {
    console.error("❌ Access Denied — your R2 API key needs 'Object Read & Write' + 'Bucket Settings Read & Write' permissions");
    console.error("   Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create token with all permissions");
    console.error("");
    console.error("   Or set CORS manually in Cloudflare Dashboard:");
    console.error("   R2 → your-bucket → Settings → CORS policy → Add rule:");
    console.error('   Allowed origins: *');
    console.error('   Allowed methods: GET, PUT, HEAD');
    console.error('   Allowed headers: *');
  } else {
    console.error("❌ Failed:", err.message);
  }
  process.exit(1);
}
