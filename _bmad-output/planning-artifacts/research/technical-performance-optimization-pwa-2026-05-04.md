---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - apps/web/src/components/AppShell.tsx
  - apps/web/src/contexts/ActiveTabContext.tsx
  - apps/web/src/components/tabs/TabBar.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/components/viewers/markdown/MarkdownViewer.tsx
  - apps/web/src/components/viewers/webclip/WebClipViewer.tsx
  - apps/web/src/app/reader/[docId]/ReaderPageInner.tsx
workflowType: research
lastStep: 3
research_type: technical
research_topic: Performance optimization — tab switching & scroll trên Desktop/PWA
research_goals: >
  Phân tích toàn diện nguyên nhân lag khi chuyển tab header (Thư viện/Ghi chú/Cài đặt),
  chuyển tab reader (tài liệu-tài liệu, tài liệu-ghi chú, ghi chú-ghi chú), và scroll
  trên reader/ghi chú. Đề xuất giải pháp gần như zero-latency.
user_name: Thuat
date: '2026-05-04'
web_research_enabled: true
source_verification: true
---

# Báo cáo Research: Performance Optimization — Tab Switching & Scroll (Desktop/PWA)

**Ngày:** 2026-05-04  
**Tác giả:** Thuat  
**Loại:** Technical Research  
**Phạm vi:** Web Knowledge Base — Next.js 15 + Convex + PWA

---

## 1. Tóm tắt điều hành

Ứng dụng hiện dùng kiến trúc **CSS keep-alive** (giữ tất cả tab mounted, ẩn/hiện bằng `visibility: hidden`) — đây là hướng đúng để đạt zero-latency tab switching. Tuy nhiên có **8 vấn đề cụ thể** khiến UX vẫn bị lag, đặc biệt trên PWA/mobile. Tài liệu này phân tích từng vấn đề và đề xuất fix có độ ưu tiên rõ ràng.

**Kết quả kỳ vọng sau khi fix:** Tab switching < 16ms (một frame), scroll 60fps ổn định, không có flash/jank khi chuyển panel.

---

## 2. Kiến trúc hiện tại — Tóm tắt

```
layout.tsx
└── ConvexClientProvider
    └── RecordingProvider
        └── AppShell (CSS keep-alive)
            ├── TabPanel[library]   → LibraryPageInner (dynamic import)
            ├── TabPanel[notes]     → NotesPageInner (dynamic import)
            ├── TabPanel[settings]  → SettingsPageInner (dynamic import)
            ├── TabPanel[reader:id1] → ReaderDocLoader (direct import)
            ├── TabPanel[reader:id2] → ReaderDocLoader
            └── {children} fallback (hidden)
```

**Cơ chế switch tab:**
1. User click tab → `setActivePanel("reader:docId")` (ActiveTabContext)
2. React re-render AppShellContent → TabPanel active/inactive toggle
3. CSS style thay đổi: `position: fixed; visibility: hidden` ↔ `position: relative`
4. `window.history.pushState` cập nhật URL (không trigger Next.js router)

---

## 3. Phân tích vấn đề — Root Causes

### 3.1 🔴 CRITICAL — Context value không được memoize

**File:** `apps/web/src/contexts/ActiveTabContext.tsx:23`

```tsx
// HIỆN TẠI — tạo object mới mỗi render
<ActiveTabContext.Provider value={{ activePanel, setActivePanel }}>
```

**Vấn đề:** Mỗi khi `ActiveTabProvider` re-render (ví dụ do parent re-render), `value` object có reference mới → **tất cả component dùng `useActiveTab()` đều re-render**, kể cả khi `activePanel` không thay đổi.

Ảnh hưởng: TabBar, BottomNav, LibraryPageInner, NotesPageInner, ReaderShell — tất cả re-render theo.

**Fix:**
```tsx
const value = useMemo(
  () => ({ activePanel, setActivePanel }),
  [activePanel, setActivePanel]
);
<ActiveTabContext.Provider value={value}>
```

---

### 3.2 🔴 CRITICAL — dynamic() imports tạo JS chunk load delay lần đầu

**File:** `apps/web/src/components/AppShell.tsx:19-28`

```tsx
const LibraryPageInner = dynamic(() => import("@/components/library/LibraryPageInner"), { ssr: false });
const NotesPageInner   = dynamic(() => import("@/components/notes/NotesPageInner"),    { ssr: false });
const SettingsPageInner= dynamic(() => import("@/components/settings/SettingsPageInner"),{ ssr: false });
```

**Vấn đề:** Lần đầu user mở tab Notes hoặc Settings, browser phải:
1. Download JS chunk (`notes-HASH.js`, `settings-HASH.js`)
2. Parse + compile JavaScript
3. Hydrate component

Trên PWA mobile với network yếu, bước này mất **200ms–1s+** tạo cảm giác lag rõ rệt.

**Quan trọng:** ReaderDocLoader đã được direct import (không dynamic) — đây là quyết định đúng. Cần làm tương tự với Library/Notes/Settings.

**Fix — Option A (Recommended):** Đổi sang direct import:
```tsx
import { LibraryPageInner } from "@/components/library/LibraryPageInner";
import { NotesPageInner }   from "@/components/notes/NotesPageInner";
import { SettingsPageInner } from "@/components/settings/SettingsPageInner";
```

**Fix — Option B:** Giữ dynamic() nhưng preload ngay khi app khởi động:
```tsx
// Preload all chunks on app mount
useEffect(() => {
  import("@/components/library/LibraryPageInner");
  import("@/components/notes/NotesPageInner");
  import("@/components/settings/SettingsPageInner");
}, []);
```

Option A đơn giản hơn và bundle size impact minimal vì các chunk này nhỏ.

---

### 3.3 🔴 CRITICAL — TabPanel CSS gây layout recalculation

**File:** `apps/web/src/components/AppShell.tsx:44-59`

```tsx
// HIỆN TẠI
active ? { position: "relative", width: "100%", height: "100%" }
       : { position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
           visibility: "hidden", pointerEvents: "none", zIndex: -1 }
```

**Vấn đề:** Chuyển `position: relative` ↔ `position: fixed` là **layout-triggering property** — browser phải recalculate layout toàn bộ trang mỗi lần switch tab. Đây là một trong những thao tác đắt nhất về performance.

**Fix:** Dùng `opacity` + `pointer-events` + `position: absolute` cố định — chỉ thay đổi các **compositing-only properties**:
```tsx
function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: active ? 1 : 0,
        pointerEvents: active ? "auto" : "none",
        visibility: active ? "visible" : "hidden",
        // Tạo GPU compositing layer — tránh main thread paint
        willChange: "opacity",
        contain: "layout style paint",
      }}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}
// Parent container cần: position: relative, overflow: hidden, width/height: 100%
```

`contain: layout style paint` giúp browser cô lập việc recalculate layout bên trong TabPanel, không ảnh hưởng phần ngoài.

---

### 3.4 🟠 HIGH — Mỗi SortableTabItem tạo một Convex query riêng

**File:** `apps/web/src/components/tabs/TabBar.tsx:53`

```tsx
function SortableTabItem({ tab, ... }) {
  const doc = useQuery(api.documents.queries.getById, { docId: tab.docId }); // ← query per tab
```

**Vấn đề:** Với 5 tab mở, có 5 Convex queries chạy song song. Mỗi query có overhead WebSocket message + subscription. Khi tab switch trigger re-render, tất cả 5 queries re-evaluate.

**Fix:** Load toàn bộ doc data từ `useTabSync` (đã có tab list) hoặc cache document metadata tập trung:
```tsx
// useTabSync đã fetch tab list từ Convex — join doc metadata ở đó
// Thay vì query per tab, truyền doc data xuống từ TabBar parent
function SortableTabItem({ tab, doc, ... }) { // doc prop thay vì useQuery
```

---

### 3.5 🟠 HIGH — Scroll handler không throttle đúng cách (đã fix 1 phần)

**File:** `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx`  
**File:** `apps/web/src/components/viewers/webclip/WebClipViewer.tsx`

Đã có fix rAF throttle. Tuy nhiên còn vấn đề:

**Vấn đề còn lại:** `savePosition()` trong `useReadingProgress` gọi `setSaveStatus("pending")` mỗi scroll → React re-render indicator. Tuy throttled nhưng vẫn trigger state update mỗi 16ms.

**Fix:** Dùng `useRef` thay `useState` cho intermediate scroll state, chỉ flush lên Convex sau 5s (đã có THROTTLE_MS=5000):
```tsx
// Trong handleScroll — không cần setSaveStatus khi chỉ là intermediate scroll
// Chỉ gọi savePosition khi scroll stop (debounce) hoặc visibility change
```

---

### 3.6 🟠 HIGH — BottomNav re-render mỗi pathname change

**File:** `apps/web/src/components/nav/BottomNav.tsx`

```tsx
const pathname = usePathname(); // → re-render mỗi lần pathname đổi
```

Vấn đề: `window.history.pushState` không trigger Next.js `usePathname()` vì bypass router. BottomNav hiển thị sai active state khi dùng tab switching qua context. Ngoài ra component này re-render khi parent re-render mà không cần thiết.

**Fix:** Sync BottomNav active state với `ActiveTabContext` thay vì `usePathname()`. Wrap với `React.memo`.

---

### 3.7 🟡 MEDIUM — Không có `transform: translateZ(0)` trên scroll containers

**Các viewer files**

Trên mobile/PWA, scroll container không có GPU layer hint → browser dùng software rendering → scroll lag rõ trên thiết bị yếu.

**Fix:** Thêm vào tất cả scroll container chính:
```css
.scroll-container {
  -webkit-overflow-scrolling: touch; /* iOS momentum scroll */
  transform: translateZ(0);           /* GPU layer */
  will-change: scroll-position;       /* Chrome/Android hint */
}
```

Hoặc trong Tailwind: tạo utility class `gpu-scroll`.

---

### 3.8 🟡 MEDIUM — AppShell re-render mỗi khi `tabs` từ Convex update

**File:** `apps/web/src/components/AppShell.tsx:63`

```tsx
const { tabs } = useTabSync(); // → re-render AppShellContent khi tab list thay đổi
```

Convex realtime update `tabs` bất kỳ lúc nào → AppShellContent re-render → tất cả TabPanel re-render (dù children không thay đổi nhờ React reconciliation, nhưng có overhead).

**Fix:** Memoize children hoặc dùng `React.memo` trên TabPanel.

---

## 4. Phân tích theo từng tính năng

### 4.1 Tab Header: Thư viện ↔ Ghi chú ↔ Cài đặt

| Nguyên nhân lag | Severity | File |
|---|---|---|
| dynamic() JS chunk load lần đầu | 🔴 | AppShell.tsx |
| `position: fixed ↔ relative` layout recalc | 🔴 | AppShell.tsx |
| Context object re-create mỗi render | 🔴 | ActiveTabContext.tsx |
| Convex `tabs` update trigger re-render | 🟡 | AppShell.tsx |

**Kết quả kỳ vọng sau fix:** Lần đầu < 100ms (chunk đã preload), lần sau < 16ms (1 frame).

---

### 4.2 Tab Reader: Tài liệu ↔ Tài liệu, Tài liệu ↔ Ghi chú

| Nguyên nhân lag | Severity | File |
|---|---|---|
| `position: fixed ↔ relative` layout recalc | 🔴 | AppShell.tsx |
| Context object re-create | 🔴 | ActiveTabContext.tsx |
| Mỗi SortableTabItem query Convex riêng | 🟠 | TabBar.tsx |
| Download URL chưa warm khi tab switch | 🟠 | ReaderPageInner.tsx |

**Note:** ReaderDocLoader đã direct import — chunk không bị delay. Download URL warming đã có (useEffect on tab mount). Bottleneck chính là layout recalc + context re-render.

---

### 4.3 Scroll trên Reader (Markdown / WebClip / EPUB)

| Nguyên nhân lag | Severity | File |
|---|---|---|
| `pointermove` → re-render toàn ReaderShell | 🔴 | ReaderPageInner.tsx (đã fix) |
| handleScroll không throttle | 🔴 | MarkdownViewer, WebClipViewer (đã fix) |
| querySelectorAll("h1-h6") mỗi scroll | 🔴 | MarkdownViewer (đã fix) |
| `setSaveStatus` state update mỗi scroll | 🟠 | useReadingProgress.ts |
| Thiếu GPU layer trên scroll container | 🟡 | All viewers |
| HighlightLayer re-apply khi highlights thay đổi | 🟡 | HighlightLayer.tsx |

**Đã fix 3/6 vấn đề** trong commit `8daf01c`. Còn 3 vấn đề cần tiếp tục.

---

## 5. Kế hoạch implement — Ưu tiên

### Sprint A — Critical (Est: 2-3h, Impact: ⭐⭐⭐⭐⭐)

| # | Task | File | Expected gain |
|---|---|---|---|
| A1 | Memoize ActiveTabContext value với `useMemo` | ActiveTabContext.tsx | Loại bỏ cascade re-render |
| A2 | Direct import Library/Notes/Settings (bỏ dynamic) | AppShell.tsx | -200ms~1s lần đầu |
| A3 | Fix TabPanel CSS: dùng `position:absolute` + `opacity` | AppShell.tsx | -50ms layout recalc mỗi switch |
| A4 | `contain: layout style paint` trên TabPanel | AppShell.tsx | Isolate paint scope |

### Sprint B — High (Est: 2h, Impact: ⭐⭐⭐⭐)

| # | Task | File | Expected gain |
|---|---|---|---|
| B1 | Truyền doc data từ TabBar parent, bỏ per-tab query | TabBar.tsx | -N Convex subscriptions |
| B2 | GPU scroll hints (`translateZ(0)`, `-webkit-overflow-scrolling`) | All viewers | Smoother scroll mobile |
| B3 | Reduce `setSaveStatus` re-renders trong scroll path | useReadingProgress.ts | Scroll mượt hơn |

### Sprint C — Medium (Est: 1h, Impact: ⭐⭐⭐)

| # | Task | File | Expected gain |
|---|---|---|---|
| C1 | `React.memo` trên TabPanel | AppShell.tsx | Giảm reconciliation |
| C2 | Sync BottomNav với ActiveTabContext | BottomNav.tsx | Correct active state + ít re-render |
| C3 | `content-visibility: auto` cho long doc lists | LibraryPageInner | Library scroll faster |

---

## 6. Code mẫu — Các fix quan trọng nhất

### Fix A1 — Context memoization

```tsx
// ActiveTabContext.tsx
export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanelState] = useState<string | null>(null);
  const setActivePanel = useCallback((panel: string) => setActivePanelState(panel), []);

  const value = useMemo(
    () => ({ activePanel, setActivePanel }),
    [activePanel, setActivePanel]   // setActivePanel stable vì useCallback([])
  );

  return <ActiveTabContext.Provider value={value}>{children}</ActiveTabContext.Provider>;
}
```

### Fix A2 — Direct imports thay dynamic()

```tsx
// AppShell.tsx
import { LibraryPageInner }  from "@/components/library/LibraryPageInner";
import { NotesPageInner }    from "@/components/notes/NotesPageInner";
import { SettingsPageInner } from "@/components/settings/SettingsPageInner";
import { ReaderDocLoader }   from "@/app/reader/[docId]/ReaderPageInner";
// Xóa các const = dynamic(...) bên trên
```

### Fix A3 — TabPanel không trigger layout recalc

```tsx
// AppShell.tsx
function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Chỉ thay đổi compositing properties — không trigger layout
        opacity: active ? 1 : 0,
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
        // GPU acceleration
        willChange: active ? "auto" : "opacity",
        // Isolate layout scope — tránh layout thrashing
        contain: "layout style paint",
      }}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

// Parent wrapper trong AppShellContent cần:
// <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
//   <TabPanel ...>...</TabPanel>
//   ...
// </div>
```

### Fix B2 — GPU scroll hints

```tsx
// Thêm vào tất cả scroll container trong viewers
// MarkdownViewer.tsx line 515
<div
  ref={contentRef}
  className="flex-1 overflow-y-auto overflow-x-hidden"
  style={{
    WebkitOverflowScrolling: "touch",  // iOS momentum scroll
    transform: "translateZ(0)",         // GPU compositing layer
  }}
  onScroll={handleScroll}
>
```

### Fix B3 — Giảm re-render trong scroll path

```tsx
// useReadingProgress.ts — bỏ setSaveStatus("pending") trong scroll path
const savePosition = useCallback(
  (pos: ReadingPosition, total?: number) => {
    if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    // KHÔNG gọi setSaveStatus ở đây — tránh re-render mỗi scroll frame
    const timer = setTimeout(() => flush(pos, total), THROTTLE_MS);
    pendingRef.current = { pos, total, timer };
  },
  [flush]
);
// Chỉ setSaveStatus("saving") khi flush() thực sự gọi Convex
```

---

## 7. Đo lường — Metrics để verify

| Metric | Hiện tại (ước tính) | Target sau fix |
|---|---|---|
| Tab switch time (header tabs, lần 2+) | ~100-300ms | < 16ms |
| Tab switch time (reader tabs) | ~50-150ms | < 16ms |
| Scroll FPS (mobile PWA) | ~30-45fps | 60fps |
| Lần đầu mở Notes/Settings | ~200ms-1s | < 50ms |
| Convex subscriptions per open tab | N queries per tab | 1 shared query |
| JS main thread time per tab switch | ~30-80ms | < 8ms |

**Cách đo:** Chrome DevTools → Performance tab → record tab switch interaction → xem "Long Task" indicators và frame timeline.

---

## 8. Nguyên tắc kiến trúc cho tương lai

1. **Chỉ dùng compositing-only CSS cho animations/transitions:** `opacity`, `transform` — tránh `position`, `display`, `width/height`.
2. **Memoize mọi Context value** có object shape.
3. **Direct import** cho components luôn được mount — dynamic() chỉ dùng khi truly lazy.
4. **Một Convex subscription cho nhiều item** thay vì subscription per item.
5. **rAF throttle cho mọi scroll handler** — không bao giờ gọi `setState` trực tiếp trong onScroll.
6. **`contain` CSS property** trên các panel/container lớn để isolate paint.
7. **`will-change: transform`** chỉ dùng khi biết trước sẽ animate — đừng dùng tràn lan (gây memory overhead).

---

## 9. Nguồn tham khảo

- [React re-renders guide — Developer Way](https://www.developerway.com/posts/react-re-renders-guide)
- [useMemo — React docs](https://react.dev/reference/react/useMemo)
- [React.memo optimization — Strapi 2025](https://strapi.io/blog/react-memo-optimize-functional-components-guide)
- [Handling Scroll Events Without Killing Performance — OpenReplay](https://blog.openreplay.com/handling-scroll-events-performance/)
- [Web Animation Performance Tier List — Motion.dev](https://motion.dev/magazine/web-animation-performance-tier-list)
- [CSS performance optimization — MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS)
- [will-change in CSS — jakub.kr](https://jakub.kr/components/will-change-in-css)
- [GPU-accelerated CSS — SitePoint](https://www.sitepoint.com/introduction-to-hardware-acceleration-css-animations/)
- [requestAnimationFrame explained — DEV Community](https://dev.to/tawe/requestanimationframe-explained-why-your-ui-feels-laggy-and-how-to-fix-it-3ep2)
- [Next.js Performance Optimization 2026 — Pagepro](https://pagepro.co/blog/nextjs-performance-optimization-in-9-steps/)
