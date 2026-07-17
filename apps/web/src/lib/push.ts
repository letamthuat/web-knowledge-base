"use client";
// Web Push (PWA nhắc học) — subscribe qua VAPID, lưu vào push_subscriptions.
// Cần NEXT_PUBLIC_VAPID_PUBLIC_KEY (public key VAPID). Gửi thật do Edge Function study-reminders.
import { savePushSubscription, removePushSubscription } from "@/lib/api/study";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Xin quyền + subscribe + lưu DB. Trả true nếu thành công. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) throw new Error("Trình duyệt/thiết bị này chưa hỗ trợ thông báo đẩy");
  if (!VAPID_PUBLIC) throw new Error("Chưa cấu hình VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY)");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Bạn đã từ chối quyền thông báo");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as BufferSource,
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Subscription không hợp lệ");
  await savePushSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent });
  return true;
}

/** Huỷ subscribe trên thiết bị này + xoá DB. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await removePushSubscription(endpoint).catch(() => {});
  }
}
