---
title: 'Story 7.3 — Reading Mode Theme Sáng/Sepia/Tối'
type: 'feature'
created: '2026-05-03'
status: 'done'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Reading Mode đã toggle được nhưng không có settings gì — người dùng không chọn được theme đọc sách phù hợp (ban đêm cần tối, ban ngày cần sáng/sepia).

**Approach:** Thêm floating settings button (⚙) trong reading mode, click mở panel nhỏ với 3 theme swatch (Sáng/Sepia/Tối). Click theme → apply ngay lên viewer (bg + text color qua CSS class trên wrapper), đồng thời lưu vào `updateReadingModePreferences({themeByFormat: {[format]: theme}})`. Khi mở lại reading mode → restore theme đã lưu.

## Boundaries & Constraints

**Always:**
- Settings button `fixed bottom-6 right-4 z-50` chỉ hiện khi reading mode bật.
- Theme apply bằng CSS class trên outer wrapper của ReaderShell: `rm-light` / `rm-sepia` / `rm-dark` — định nghĩa trong `globals.css`.
- Lưu per-format qua `useUpdateReadingModePrefs` từ story 7.1.
- Restore theme khi vào reading mode bằng `useReadingModePrefs(doc.format)`.
- Theme contrast ≥ 4.5:1 (NFR23): light = #1a1a1a on #ffffff, sepia = #3b2f2f on #f4ecd8, dark = #e8e8e8 on #1a1a1a.

**Never:**
- Không implement font/size/lineHeight controls (story 7.4).
- Không thay đổi app-wide dark mode — chỉ affect viewer khi reading mode bật.
- Không dùng Tailwind `dark:` prefix cho theme này (conflict với system dark mode).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Click ⚙ | readingMode=true | Panel 3 swatches hiện | — |
| Chọn Sepia | format=pdf | Viewer bg=#f4ecd8, text=#3b2f2f, lưu DB | — |
| Mở lại reading mode | prefs.themeByFormat.pdf="sepia" | Panel restore sepia active | — |
| Reading mode tắt | readingMode=false | Theme class xóa, panel đóng | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/globals.css` — thêm CSS classes `.rm-light`, `.rm-sepia`, `.rm-dark` cho bg+text+prose
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm theme state, settings button + panel, apply class lên outer wrapper, restore từ prefs

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/app/globals.css` — thêm:
  ```css
  .rm-light { background: #ffffff; color: #1a1a1a; }
  .rm-sepia { background: #f4ecd8; color: #3b2f2f; }
  .rm-dark  { background: #1a1a1a; color: #e8e8e8; }
  .rm-light .prose, .rm-sepia .prose, .rm-dark .prose { color: inherit; }
  .rm-sepia .prose { --tw-prose-body: #3b2f2f; --tw-prose-headings: #2a1f1f; }
  .rm-dark .prose  { --tw-prose-body: #e8e8e8; --tw-prose-headings: #ffffff; }
  ```
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — trong `ReaderShell`:
  1. Thêm `const prefs = useReadingModePrefs(doc.format)` và `const updatePrefs = useUpdateReadingModePrefs()`
  2. Thêm `const [rmTheme, setRmTheme] = useState<"light"|"sepia"|"dark">("light")`
  3. `useEffect` khi `readingMode` bật → `setRmTheme(prefs.theme)`; khi tắt → reset panel
  4. Thêm `const [settingsOpen, setSettingsOpen] = useState(false)` — đóng khi `!readingMode`
  5. Apply class lên outer `div.flex.h-screen`: thêm `${readingMode ? rmTheme === "light" ? "rm-light" : rmTheme === "sepia" ? "rm-sepia" : "rm-dark" : ""}`
  6. Settings button: `fixed bottom-6 right-4 z-50` chỉ khi `readingMode`; click toggle `settingsOpen`
  7. Settings panel: 3 swatch buttons — click → `setRmTheme(t)` + `updatePrefs({themeByFormat: {[doc.format]: t}})`

**Acceptance Criteria:**
- Given reading mode bật, when click ⚙, then panel 3 theme hiện
- Given chọn Sepia, when apply, then viewer background chuyển sang #f4ecd8
- Given mở lại reading mode sau khi đã chọn Dark cho pdf, when bật, then theme Dark tự restore
- Given reading mode tắt, when viewer hiện, then không có rm-* class nào trên wrapper

## Design Notes

**Settings panel:**
```tsx
{readingMode && settingsOpen && (
  <div className="fixed bottom-16 right-4 z-50 rounded-xl border bg-card shadow-xl p-4 space-y-3 w-48">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nền</p>
    <div className="flex gap-2">
      {(["light","sepia","dark"] as const).map((t) => (
        <button key={t} onClick={() => applyTheme(t)}
          className={`h-8 w-8 rounded-full border-2 transition-all ${rmTheme===t?"border-primary scale-110":"border-transparent"}`}
          style={{background: t==="light"?"#ffffff":t==="sepia"?"#f4ecd8":"#1a1a1a"}}
          aria-label={t} />
      ))}
    </div>
  </div>
)}
```

**⚙ button:**
```tsx
{readingMode && (
  <button onClick={() => setSettingsOpen(v=>!v)}
    className="fixed bottom-6 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors">
    <Settings className="h-4 w-4" />
  </button>
)}
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: 0 errors mới

**Manual checks:**
- Reading mode bật → click ⚙ → 3 swatch hiện
- Chọn Sepia → bg chuyển vàng nhạt
- Tắt reading mode → bg về bình thường
- Mở lại reading mode → theme Sepia restore
