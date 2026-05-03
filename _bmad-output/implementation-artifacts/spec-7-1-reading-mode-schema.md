---
title: 'Story 7.1 — Reading Mode Preferences Schema + Mutation'
type: 'feature'
created: '2026-05-03'
status: 'done'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Schema `users.preferences.readingMode` đã có trong Convex nhưng không có mutation để lưu, không có query hook để đọc — các story 7.2–7.6 đều cần foundation này.

**Approach:** Thêm public mutation `updateReadingModePreferences` (patch một field bất kỳ trong preferences), thêm `useReadingModePrefs` hook ở client đọc từ `api.users.queries.me`, và thêm `useUpdateReadingModePrefs` mutation hook — đây là foundation cho toàn bộ Epic 7.

## Boundaries & Constraints

**Always:**
- Mutation patch từng field riêng lẻ (không overwrite toàn bộ preferences).
- Schema không thay đổi — đã đủ cho FR61+FR62.
- Query `me` đã có sẵn — không tạo query mới, chỉ expose preferences qua hook.
- `themeByFormat` là `Record<string, "light"|"sepia"|"dark">` — key là format string (pdf, epub, markdown, docx, web_clip).

**Never:**
- Không thêm field mới vào schema.
- Không thêm `avgReadingSpeedWPM` (story 7.6 scope).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| User chưa có preferences | `me.preferences` = undefined | Hook trả defaults: sans, 16px, 1.6, medium, light | — |
| Update theme cho pdf | `{themeByFormat: {pdf: "dark"}}` | Merge vào existing, epub theme không đổi | — |
| Update fontSize | `{fontSize: 20}` | Patch preferences.readingMode.fontSize = 20 | Clamp 12–28 trên server |

</frozen-after-approval>

## Code Map

- `convex/users/mutations.ts` — thêm public `updateReadingModePreferences` mutation
- `apps/web/src/hooks/useReadingModePrefs.ts` — hook mới: đọc prefs từ `me`, expose defaults, expose mutation

## Tasks & Acceptance

**Execution:**
- [ ] `convex/users/mutations.ts` — thêm `export const updateReadingModePreferences = mutation({ args: { fontFamily?, fontSize?, lineHeight?, columnWidth?, themeByFormat? }, handler: patch preferences.readingMode với deep merge })` — clamp fontSize 12–28, clamp lineHeight 1.4–2.0
- [ ] `apps/web/src/hooks/useReadingModePrefs.ts` — tạo mới: `useReadingModePrefs(format?: string)` dùng `useQuery(api.users.queries.me)` để lấy prefs, merge với defaults `{fontFamily:"sans", fontSize:16, lineHeight:1.6, columnWidth:"medium"}`, trả thêm `theme` = `themeByFormat[format] ?? "light"`; export `useUpdateReadingModePrefs` = `useMutation(api.users.mutations.updateReadingModePreferences)`

**Acceptance Criteria:**
- Given user chưa set prefs, when `useReadingModePrefs("pdf")` called, then trả `{fontFamily:"sans", fontSize:16, lineHeight:1.6, columnWidth:"medium", theme:"light"}`
- Given call `updateReadingModePreferences({fontSize: 20})`, when mutation chạy, then `me.preferences.readingMode.fontSize === 20`
- Given update `themeByFormat: {pdf: "dark"}`, when epub reader load, then epub theme vẫn là default "light"

## Design Notes

**Mutation deep merge pattern:**
```ts
const existing = user.preferences?.readingMode ?? {};
const newThemeByFormat = args.themeByFormat
  ? { ...(existing.themeByFormat ?? {}), ...args.themeByFormat }
  : existing.themeByFormat;
await ctx.db.patch(user._id, {
  preferences: {
    ...user.preferences,
    readingMode: {
      ...existing,
      ...(args.fontFamily !== undefined ? { fontFamily: args.fontFamily } : {}),
      ...(args.fontSize !== undefined ? { fontSize: Math.min(28, Math.max(12, args.fontSize)) } : {}),
      ...(args.lineHeight !== undefined ? { lineHeight: Math.min(2.0, Math.max(1.4, args.lineHeight)) } : {}),
      ...(args.columnWidth !== undefined ? { columnWidth: args.columnWidth } : {}),
      ...(newThemeByFormat !== undefined ? { themeByFormat: newThemeByFormat } : {}),
    },
  },
});
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` — expected: 0 errors mới

**Manual checks:**
- `useReadingModePrefs()` trong component trả object với defaults khi user mới
- Sau `updateReadingModePreferences({fontSize: 20})`, reload → fontSize vẫn 20
