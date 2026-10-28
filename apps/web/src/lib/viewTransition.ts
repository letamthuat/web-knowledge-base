import { flushSync } from "react-dom";

type StartViewTransition = (cb: () => void) => { finished: Promise<void> };

/** Tên shared-element: card tài liệu "nở" thành trang đọc. */
const HERO = "doc-hero";

/**
 * Chạy `update` (đổi state React) trong View Transition nếu trình duyệt hỗ trợ.
 * - `from`: phần tử nguồn (card) → morph sang phần tử đích khớp `toSelector`.
 * Không hỗ trợ / bật giảm chuyển động / tab ẩn → chạy `update` ngay, không hiệu ứng.
 */
export function runViewTransition(
  update: () => void,
  opts: { from?: HTMLElement | null; toSelector?: string } = {}
) {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!start || reduce || document.visibilityState !== "visible") {
    update();
    return;
  }

  const { from, toSelector } = opts;
  if (from) from.style.viewTransitionName = HERO;
  let to: HTMLElement | null = null;

  const transition = start.call(document, () => {
    // Tên phải là duy nhất ở trạng thái mới → gỡ khỏi card trước khi gắn cho đích
    if (from) from.style.viewTransitionName = "";
    flushSync(update);
    if (from && toSelector) {
      to = document.querySelector<HTMLElement>(toSelector);
      if (to) to.style.viewTransitionName = HERO;
    }
  });
  transition.finished.finally(() => {
    if (to) to.style.viewTransitionName = "";
  });
}
