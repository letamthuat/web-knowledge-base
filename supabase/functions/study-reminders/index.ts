// Supabase Edge Function — nhắc học module Học tập qua Web Push. Chạy 15'/lần (pg_cron / dashboard cron).
// Nội dung 100% rule từ plan + card đến hạn — 0 call Gemini. Deploy: xem 01-specs/study/DEPLOY-PUSH.md
//
// Secrets cần set: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY tự có trong runtime edge function.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const startOfDay = (ms: number) => { const d = new Date(ms); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

// Phút-trong-ngày theo timezone user (Intl) — so khớp times[] với thời điểm hiện tại.
function localMinutes(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}
const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

Deno.serve(async (req) => {
 try {
  const webpush = (await import("npm:web-push@3.6.7")).default;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // Chế độ test: {test:true} → gửi 1 push thử tới MỌI thiết bị đã đăng ký, bỏ qua giờ/nội dung.
  let testMode = false;
  try { const b = await req.json(); testMode = b?.test === true; } catch { /* body rỗng */ }
  if (testMode) {
    const { data: subs } = await admin.from("push_subscriptions").select("*");
    let n = 0;
    const payload = JSON.stringify({ title: "🔔 Test nhắc học", body: "Push hoạt động rồi! Đây là thông báo thử.", url: "/study", tag: "study-test" });
    for (const sub of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload); n++; }
      catch (err) { const code = (err as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); }
    }
    return new Response(JSON.stringify({ ok: true, test: true, sent: n }), { headers: { "content-type": "application/json" } });
  }

  const now = Date.now();
  const todayStart = startOfDay(now);
  const tomorrowStart = todayStart + 86_400_000;

  const { data: settings } = await admin.from("notification_settings").select("*").eq("enabled", true);
  let sent = 0;

  for (const s of settings ?? []) {
    const tz = s.timezone || "Asia/Ho_Chi_Minh";
    const nowMin = localMinutes(tz);
    const times: string[] = s.times ?? [];
    // Khớp nếu có mốc rơi trong cửa sổ ±7' của lần chạy 15'
    const hit = times.find((t) => Math.abs(timeToMin(t) - nowMin) <= 7);
    if (hit === undefined) continue;
    const morning = timeToMin(hit) < 12 * 60;

    // Nội dung rule: buổi hôm nay còn việc + card đến hạn (gộp mọi space của user)
    const { data: plans } = await admin.from("study_plans").select("_id").eq("userId", s.userId).eq("status", "active");
    const planIds = (plans ?? []).map((p: { _id: string }) => p._id);
    let todayTasks = 0;
    if (planIds.length) {
      const { count } = await admin.from("study_plan_tasks").select("_id", { count: "exact", head: true })
        .in("planId", planIds).gte("dayDate", todayStart).lt("dayDate", tomorrowStart);
      todayTasks = count ?? 0;
    }
    const { count: dueCount } = await admin.from("flashcards").select("_id", { count: "exact", head: true })
      .eq("userId", s.userId).lte("dueAt", tomorrowStart - 1);
    const due = dueCount ?? 0;

    if (todayTasks === 0 && due === 0) continue; // không có gì để nhắc

    const parts: string[] = [];
    if (todayTasks > 0) parts.push(`${todayTasks} việc học`);
    if (due > 0) parts.push(`${due} thẻ đến hạn`);
    const body = morning
      ? `Hôm nay: ${parts.join(" · ")}. Mở app để bắt đầu nhé!`
      : `Còn ${parts.join(" · ")} chưa xong hôm nay. Học 15 phút trước khi ngủ chứ?`;
    const payload = JSON.stringify({ title: morning ? "☀️ Kế hoạch hôm nay" : "🌙 Nhắc học tối", body, url: "/study", tag: "study-reminder" });

    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("userId", s.userId);
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err) {
        // 404/410 = subscription hết hạn → xoá
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "content-type": "application/json" } });
 } catch (e) {
  return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e), stack: (e as Error)?.stack ?? null }), { status: 200, headers: { "content-type": "application/json" } });
 }
});
