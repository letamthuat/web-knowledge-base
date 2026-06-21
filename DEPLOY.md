# Phase 7 — Deploy lên Vercel (nhánh `supabase`)

> Mục tiêu: chạy app online trên Vercel (free), trỏ nhánh `supabase`, dùng Supabase + R2.
> Ràng buộc $0/tháng. Bản Convex cũ (`main`) không đụng.

## 0. Chuẩn bị (đã xong trong repo)
- ✅ `apps/web/vercel.json`: `installCommand` + cron keep-alive.
- ✅ `apps/web/src/app/api/keep-alive/route.ts`: ping giữ Supabase không pause.
- ✅ `convex/_generated` đã commit → build (`copy-convex.js`) chạy được trên Vercel.
- ✅ R2 CORS = `*` (cho phép mọi origin upload/download) — xem mục 4.

---

## 1. Tạo Vercel project
1. vercel.com → **Add New → Project** → Import repo `letamthuat/web-knowledge-base`.
2. **Production Branch**: đổi sang **`supabase`** (Settings → Git → Production Branch) — QUAN TRỌNG, mặc định là `main` (bản Convex cũ).
3. **Root Directory**: đặt **`apps/web`** (Settings → General → Root Directory).
4. Framework Preset: **Next.js** (tự nhận). Build/Install để mặc định (vercel.json đã lo install `--legacy-peer-deps`).
   - Nếu install lỗi vì npm workspaces: thử bỏ Root Directory (để trống = root) và đặt Build Command `npm run build`, Output để Next tự nhận. Nhưng ưu tiên cách Root Directory = `apps/web` trước.

## 2. Environment Variables (Settings → Environment Variables, scope = Production + Preview)
Lấy giá trị từ `apps/web/.env.local`. Cần đúng các biến sau:

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (browser, an toàn) |
| `SUPABASE_SECRET_KEY` | service_role — BÍ MẬT (route deleteAccount/keep-alive) |
| `R2_ACCOUNT_ID` | Cloudflare R2 |
| `R2_BUCKET_NAME` | `web-knowledge-base` |
| `R2_ACCESS_KEY_ID` | R2 |
| `R2_SECRET_ACCESS_KEY` | R2 — BÍ MẬT |
| `GROQ_API_KEY` | transcribe audio (Groq Whisper) |
| `GEMINI_API_KEY` | transcribe Gemini (fallback; user có thể tự nhập key trong Settings) |

KHÔNG cần: `NEXT_PUBLIC_CONVEX_*`, `BETTER_AUTH_SECRET`, `GOOGLE_*`, `RESEND_*` (đều là legacy Convex/Better Auth, app không dùng nữa).

## 3. Supabase Auth — cấu hình URL (BẮT BUỘC, nếu không signup/reset password lỗi redirect)
Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://<app>.vercel.app` (domain Vercel của bạn).
- **Redirect URLs**: thêm `https://<app>.vercel.app/auth/callback` (và `http://localhost:3000/auth/callback` để vẫn dev được).
- (App dùng `emailRedirectTo = <origin>/auth/callback` cho xác nhận email + reset password.)

## 4. R2 CORS (kiểm tra đã áp dụng)
Browser upload/download trực tiếp R2 qua presigned URL → bucket phải cho phép CORS.
- Cloudflare Dashboard → R2 → bucket `web-knowledge-base` → **Settings → CORS Policy** → dán nội dung `cors.json` (ở gốc repo). Hiện để `AllowedOrigins: ["*"]` nên mọi domain đều OK.
- (Nếu muốn chặt hơn: thay `*` bằng `https://<app>.vercel.app`.)

## 5. Deploy + Cron
- Bấm **Deploy**. Build ~2-4 phút.
- Cron keep-alive (`/api/keep-alive` mỗi ngày 06:00 UTC) tự kích hoạt từ `vercel.json` (Hobby cho phép cron daily). Kiểm tra ở Vercel → project → **Cron Jobs**.

## 6. Test thật trên URL production
Đăng nhập (tạo tài khoản mới — Supabase gửi email xác nhận; nếu chưa bật SMTP riêng thì dùng email thật để nhận link):
1. **Upload 1 PDF** → mở reader đọc được → ⌘K tìm 1 từ trong PDF → ra kết quả (xác nhận route `extract` + pdfjs + FTS).
2. **Tạo note** → chèn 1 ảnh (note media R2) → ảnh hiển thị.
3. **Folder/Handbook** → import 1 ZIP → file hiện trong cây.
4. **Audio/Video** → transcribe (cần GROQ/GEMINI key) → ra phụ đề.
5. **Realtime**: mở 2 tab, sửa note tab này → tab kia cập nhật.
6. **Xoá tài khoản** (Settings) → kiểm tra cascade.

## 7. (Tùy chọn) dọn dẹp
- Xoá route legacy `apps/web/src/app/api/auth/[...all]` (Better Auth→Convex, không dùng).
- Gỡ type `Id<>` + dep `convex` khỏi `apps/web` (cosmetic, không ảnh hưởng runtime).
- Convex project cũ: tự xoá trên dashboard nếu muốn dọn hẳn.

## Lưu ý vận hành ($0)
- Supabase free **pause sau 7 ngày idle** → cron keep-alive lo. Nếu vẫn lo, thêm pinger ngoài (cron-job.org / UptimeRobot free) trỏ `https://<app>.vercel.app/api/keep-alive`.
- Vercel Hobby: cron chạy **1 lần/ngày** là đủ cho keep-alive.
- Email xác nhận Supabase free có giới hạn tần suất; cá nhân dùng thoải mái.

<!-- deploy trigger: lần đầu build nhánh supabase trên Vercel -->
