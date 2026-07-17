# Deploy Push PWA (nhắc học) — các bước hạ tầng

Code đã sẵn sàng (client + service worker + Edge Function). 3 bước dưới bạn tự chạy (cần Supabase CLI + tài khoản).

## 1. Sinh VAPID keys (1 lần)
```bash
npx web-push generate-vapid-keys
# → Public Key: Bxx...   Private Key: yyy...
```

## 2. Cấu hình key
**Web (client):** thêm vào `apps/web/.env.local` (và env hosting):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=Bxx...   # public key ở bước 1
```
**Edge Function (server):**
```bash
supabase secrets set VAPID_PUBLIC_KEY=Bxx... VAPID_PRIVATE_KEY=yyy... VAPID_SUBJECT=mailto:ban@email.com
```

## 3. Deploy Edge Function + lịch chạy
```bash
supabase functions deploy study-reminders
```
Hẹn giờ 15'/lần — chọn 1 trong 2:

**A. Supabase Dashboard → Edge Functions → Cron** (dễ nhất): thêm schedule `*/15 * * * *` cho `study-reminders`.

**B. pg_cron + pg_net** (SQL Editor), thay `<PROJECT_REF>` + `<ANON_OR_SERVICE_KEY>`:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('study-reminders-15m', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/study-reminders',
    headers := '{"Authorization":"Bearer <SERVICE_KEY>","Content-Type":"application/json"}'::jsonb
  );
$$);
```

## Kiểm thử
1. App: Học tập → Kế hoạch → bật **NHẮC HỌC** (cho phép quyền thông báo) → dòng lưu vào `push_subscriptions`.
2. Gọi thử function: `supabase functions invoke study-reminders` → phải thấy `{ ok: true, sent: N }`.
3. iOS: chỉ nhận push khi PWA đã **Thêm vào MH chính** + iOS ≥ 16.4. Android/desktop: đầy đủ.

## Lưu ý
- Nội dung nhắc 100% rule (việc hôm nay + thẻ đến hạn), **0 call Gemini**.
- Sáng (mốc < 12:00) = tóm tắt; tối = nhắc việc chưa xong. Khớp `notification_settings.times[]` theo `timezone` (mặc định Asia/Ho_Chi_Minh).
- Subscription hết hạn (404/410) tự bị xoá khỏi DB.
