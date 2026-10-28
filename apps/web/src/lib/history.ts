"use client";

/** App đang chạy ở chế độ PWA đã cài (Android/desktop standalone hoặc iOS "Thêm vào MH chính"). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Đổi URL khi chuyển màn trong app shell.
 * PWA: GHI ĐÈ URL (replaceState) — không tích lịch sử, nên vuốt mép (cử chỉ Back của iOS/Android)
 * không kéo app về URL trước. Trình duyệt thường: pushState như cũ để nút Back vẫn dùng được.
 */
export function pushUrl(url: string) {
  if (typeof window === "undefined") return;
  if (isStandalone()) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}
