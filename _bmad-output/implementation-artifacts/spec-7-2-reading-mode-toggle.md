---
title: 'Story 7.2 — Toggle Reading Mode F/Cmd+Shift+R/Esc'
type: 'feature'
created: '2026-05-03'
status: 'done'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Không có cách nào ẩn navbar/tabs để tập trung đọc — chrome UI luôn chiếm không gian màn hình.

**Approach:** Thêm Reading Mode toggle vào `ReaderShell`: phím `F` hoặc `Cmd+Shift+R` bật/tắt. Khi bật — header + TabBar ẩn, viewer chiếm 100% height, hiện nút X nhỏ góc trên phải để thoát. Esc cũng thoát. Format audio/video/image/pptx không support — toast thông báo.

## Boundaries & Constraints

**Always:**
- State `readingMode: boolean` nằm trong `ReaderShell` (local state, không cần persist ở story này).
- Khi bật: header (`<header>`) và TabBar/TabDropdown ẩn bằng conditional render.
- Nút thoát X hiện ở `fixed top-4 right-4 z-50` khi reading mode bật.
- Format support: `pdf`, `epub`, `docx`, `markdown`, `web_clip` — các format khác toast "Reading Mode chỉ dành cho định dạng đọc".
- Esc key đóng reading mode (không conflict với search modal — chỉ fire khi modal đóng).

**Never:**
- Không persist reading mode state vào DB (chỉ local UI state).
- Không thay đổi viewer component (PDF/Markdown) trong story này.
- Không implement theme/font settings panel (story 7.3–7.4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bấm F (markdown) | format=markdown, readingMode=false | Header+tabs ẩn, nút X hiện | — |
| Bấm Esc | readingMode=true | Header+tabs hiện lại, X ẩn | — |
| Bấm F (audio) | format=audio | Toast "Reading Mode chỉ dành cho định dạng đọc" | — |
| Click nút X | readingMode=true | Thoát reading mode | — |
| Search modal mở + bấm Esc | searchOpen=true | Đóng search modal, không thoát reading mode | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm `readingMode` state, keydown handler F/Cmd+Shift+R/Esc, ẩn header+tabs, thêm nút X

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — trong `ReaderShell`:
  1. Thêm `const [readingMode, setReadingMode] = useState(false)`
  2. Thêm `useEffect` keydown: `F` (không modifier) → toggle nếu format support; `Cmd/Ctrl+Shift+R` → toggle; `Escape` → `setReadingMode(false)` chỉ khi `!searchOpen`
  3. Hằng `READING_MODE_FORMATS = new Set(["pdf","epub","docx","markdown","web_clip"])`
  4. Wrap `<header>` và TabBar/TabDropdown trong `{!readingMode && (...)}` để ẩn khi bật
  5. Thêm nút X: `{readingMode && <button onClick={() => setReadingMode(false)} className="fixed top-4 right-4 z-50 ...">}`

**Acceptance Criteria:**
- Given reader mở doc markdown, when bấm F, then header và tabs biến mất, nút X xuất hiện góc trên phải
- Given reading mode bật, when bấm Esc, then header và tabs hiện lại
- Given reading mode bật, when click nút X, then thoát reading mode
- Given reader mở doc audio, when bấm F, then toast hiện, reading mode không bật
- Given search modal đang mở, when bấm Esc, then modal đóng nhưng reading mode không đổi

## Design Notes

**Nút X khi reading mode:**
```tsx
{readingMode && (
  <button
    onClick={() => setReadingMode(false)}
    className="fixed top-4 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
    aria-label="Thoát Reading Mode"
  >
    <X className="h-4 w-4" />
  </button>
)}
```

**Keydown handler — tránh fire khi đang type:**
```ts
if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: 0 errors mới

**Manual checks:**
- Mở markdown doc → bấm F → header+tabs ẩn, X hiện
- Bấm Esc → về bình thường
- Mở audio doc → bấm F → toast, không ẩn gì
