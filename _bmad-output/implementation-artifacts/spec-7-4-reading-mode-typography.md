---
title: 'Story 7.4 — Reading Mode Typography Controls'
type: 'feature'
created: '2026-05-03'
status: 'ready-for-dev'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Reading Mode có theme nhưng không có cách điều chỉnh font/size/spacing — người dùng không thể tối ưu trải nghiệm đọc theo sở thích (ví dụ: font lớn hơn khi đọc lâu, serif cho cảm giác sách).

**Approach:** Mở rộng settings panel đã có (⚙ button từ story 7.3) thêm section Typography bên dưới section Màu nền. Controls gồm: font family (3 buttons: Sans/Serif/Mono), font size (slider 12–28, step 1), line height (slider 1.4–2.0, step 0.1), column width (3 buttons: Hẹp/Vừa/Rộng). Apply ngay lên viewer qua inline CSS style trên wrapper. Lưu qua `updateReadingModePreferences`. Restore từ `useReadingModePrefs` khi load.

## Boundaries & Constraints

**Always:**
- Tái sử dụng `useReadingModePrefs(doc.format)` và `useUpdateReadingModePrefs()` đã có từ story 7.1.
- Apply typography qua inline `style` prop trên wrapper div bao quanh `<ViewerDispatcher>` (không sửa ViewerDispatcher).
- Font family map: `sans` → `ui-sans-serif, system-ui, sans-serif`; `serif` → `ui-serif, Georgia, serif`; `mono` → `ui-monospace, monospace`.
- Column width map: `narrow` → `max-w-xl`; `medium` → `max-w-3xl`; `wide` → `max-w-5xl` (Tailwind class trên wrapper).
- fontSize và lineHeight apply qua `style={{ fontSize: rmFontSize, lineHeight: rmLineHeight }}` trên wrapper.
- Persist mỗi field riêng khi thay đổi (không batch).
- Defaults từ hook: `fontFamily:"sans"`, `fontSize:16`, `lineHeight:1.6`, `columnWidth:"medium"`.
- localStorage key `rm-theme` đã có — không cần persist typography vào localStorage (DB đủ, load lag ít).

**Never:**
- Không sửa `ViewerDispatcher`, `MarkdownViewer`, `PDFViewer` hay bất kỳ viewer nào.
- Không thêm field mới vào Convex schema hay mutation (đã đủ từ 7.1).
- Không implement font preview hay live preview thumbnail.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kéo slider fontSize = 20 | readingMode=any | Viewer text lớn hơn ngay | — |
| Chọn Serif | fontFamily=sans → serif | Font chữ đổi sang Georgia-style | — |
| Chọn Hẹp | columnWidth=medium → narrow | Viewer content thu hẹp lại giữa trang | — |
| Load lại trang | prefs.fontSize=20 đã lưu | Slider khởi tạo tại 20, viewer dùng 20px | — |
| User chưa set prefs | me=undefined | Dùng defaults: sans/16/1.6/medium | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm typography state, controls vào settings panel, apply style lên viewer wrapper

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — trong `ReaderShell`:
  1. Thêm states: `const [rmFont, setRmFont] = useState<FontFamily>(() => prefs.fontFamily)` — nhưng vì prefs async, dùng `useState<FontFamily>("sans")` rồi sync trong useEffect prefs
  2. Thêm `const [rmFontSize, setRmFontSize] = useState(16)`, `const [rmLineHeight, setRmLineHeight] = useState(1.6)`, `const [rmColWidth, setRmColWidth] = useState<ColumnWidth>("medium")`
  3. Cập nhật `useEffect` sync prefs: sau khi Convex load, set tất cả 4 giá trị typography từ `prefs` (chỉ lần đầu, tương tự pattern prefsSynced)
  4. Thêm hàm helpers: `applyFont`, `applyFontSize`, `applyLineHeight`, `applyColWidth` — mỗi hàm set local state + gọi `updatePrefs({...})`
  5. Tính `fontFamilyCss`: `rmFont === "serif" ? "ui-serif, Georgia, serif" : rmFont === "mono" ? "ui-monospace, monospace" : "ui-sans-serif, system-ui, sans-serif"`
  6. Tính `colWidthClass`: `rmColWidth === "narrow" ? "max-w-xl" : rmColWidth === "wide" ? "max-w-5xl" : "max-w-3xl"`
  7. Wrap `<ViewerDispatcher>` trong `<div className={`mx-auto w-full ${colWidthClass}`} style={{ fontFamily: fontFamilyCss, fontSize: rmFontSize, lineHeight: rmLineHeight }}>` — chỉ khi format là markdown/epub/docx/web_clip (không wrap PDF vì PDF viewer tự quản lý layout)
  8. Thêm section Typography vào settings panel bên dưới section Màu nền, gồm:
     - Font buttons: Sans / Serif / Mono (active = border-primary)
     - Font size: label "Cỡ chữ {rmFontSize}px" + `<input type="range" min="12" max="28" step="1">`
     - Line height: label "Dãn dòng {rmLineHeight.toFixed(1)}" + `<input type="range" min="1.4" max="2.0" step="0.1">`
     - Column width buttons: Hẹp / Vừa / Rộng

**Acceptance Criteria:**
- Given settings panel mở, when xem, then thấy section Typography bên dưới Màu nền với đủ 4 controls
- Given kéo slider fontSize lên 22, when apply, then text trong viewer to hơn ngay lập tức
- Given chọn Serif, when apply, then font chữ đổi sang serif style
- Given chọn Hẹp, when apply, then content thu hẹp lại, có nhiều padding 2 bên hơn
- Given reload trang sau khi set fontSize=22, when load xong, then slider ở 22 và text vẫn 22px
- Given doc là PDF, when mở settings, then typography controls hiển thị nhưng column width không affect PDF layout

## Design Notes

**Typography section trong settings panel:**
```tsx
<div className="border-t pt-3 mt-1 space-y-3">
  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Chữ</p>
  {/* Font family */}
  <div className="flex gap-1.5">
    {([["sans","Sans"],["serif","Serif"],["mono","Mono"]] as const).map(([v,label]) => (
      <button key={v} onClick={() => applyFont(v)}
        className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-all ${rmFont===v?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:border-foreground/40"}`}>
        {label}
      </button>
    ))}
  </div>
  {/* Font size slider */}
  <div>
    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
      <span>Cỡ chữ</span><span>{rmFontSize}px</span>
    </div>
    <input type="range" min="12" max="28" step="1" value={rmFontSize}
      onChange={(e) => applyFontSize(Number(e.target.value))}
      className="w-full accent-primary h-1.5 rounded-full" />
  </div>
  {/* Line height slider */}
  <div>
    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
      <span>Dãn dòng</span><span>{rmLineHeight.toFixed(1)}</span>
    </div>
    <input type="range" min="1.4" max="2.0" step="0.1" value={rmLineHeight}
      onChange={(e) => applyLineHeight(Number(e.target.value))}
      className="w-full accent-primary h-1.5 rounded-full" />
  </div>
  {/* Column width */}
  <div className="flex gap-1.5">
    {([["narrow","Hẹp"],["medium","Vừa"],["wide","Rộng"]] as const).map(([v,label]) => (
      <button key={v} onClick={() => applyColWidth(v)}
        className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-all ${rmColWidth===v?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:border-foreground/40"}`}>
        {label}
      </button>
    ))}
  </div>
</div>
```

**Viewer wrapper (chỉ cho text formats):**
```tsx
{["markdown","epub","docx","web_clip"].includes(doc.format) ? (
  <div className={`mx-auto w-full ${colWidthClass} transition-all`}
    style={{ fontFamily: fontFamilyCss, fontSize: rmFontSize, lineHeight: rmLineHeight }}>
    <ViewerDispatcher ... />
  </div>
) : (
  <ViewerDispatcher ... />
)}
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: 0 errors mới

**Manual checks:**
- Mở markdown doc → ⚙ → kéo slider size → text to hơn
- Chọn Serif → font đổi
- Chọn Hẹp → content thu lại
- Reload → settings restore đúng
