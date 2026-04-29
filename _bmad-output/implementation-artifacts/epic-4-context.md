# Epic 4 Context: Multi-Tab Workspace Cross-Device

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to open up to 10 documents simultaneously as browser-style tabs, reorder them via drag-and-drop, and restore the most recently closed tab within a session. The full tab list, active tab, and per-tab scroll state must synchronize across all of a user's devices (laptop, iPad, iPhone) in real time within ≤3 seconds of any change.

## Stories

- Story 4.1: Schema `tabs` table + Convex reactive hook `useTabSync`
- Story 4.2: Tab bar UI — open/close/switch + 10-tab limit enforcement
- Story 4.3: Drag-drop tab reorder + Zustand optimistic UI state
- Story 4.4: Cross-device tab sync + scroll state persistence in real time
- Story 4.5: Close-all tabs + reopen last closed tab (session-local undo stack)

## Requirements & Constraints

**Functional (FR25–FR28)**
- FR25: User can open ≤10 tabs simultaneously; opening an 11th is blocked with a Vietnamese toast.
- FR26: User can close, switch, and drag-drop reorder tabs.
- FR27: Tab list + active tab + `scrollState` syncs across all devices in real time.
- FR28: "Close all" bulk action + "Reopen last closed" (Ctrl/Cmd+Shift+T) within current session.

**Non-functional**
- NFR2: Tab list sync latency ≤3s at 95th percentile after ConvexProvider WS connect.
- NFR33: TypeScript strict mode, no unjustified `any`.
- NFR37: All UI labels/errors in Vietnamese; code comments in English.
- NFR31: Responsive 375px–1920px; tap targets ≥44×44px on mobile.
- Telemetry: emit `tabs.synced` event with `latencyMs` + `deviceId` via `withTelemetry()` helper.

**Cost constraint**: All services remain free-tier forever (NFR27–NFR28). Convex free tier handles reactive subscriptions; no additional WebSocket service permitted.

## Technical Decisions

**Data model — `tabs` table (Convex)**
```
tabs: defineTable({
  userId:        v.id("users"),
  docId:         v.id("documents"),
  scrollState:   v.string(),   // JSON.stringify of position union
  order:         v.number(),
  isActive:      v.boolean(),
  lastActiveAt:  v.number(),   // epoch ms
}).index("by_user", ["userId"])
```

**Convex mutations / queries (`convex/tabs/{queries,mutations}.ts`)**
- `listByUser()` — reactive query (D9); the single source of truth across devices.
- `openTab(docId)` — idempotent; throws `ConvexError({code:"VALIDATION", messageVi:"Tối đa 10 tab cùng lúc"})` if user already has 10 open tabs.
- `closeTab(tabId)`, `reorderTabs(orders[])`, `setActive(tabId)`, `updateScrollState(tabId, scrollState)`.
- All mutations: `requireAuth` + idempotent via `clientMutationId`.

**State boundary (3 layers)**
- **Convex hooks** (`useTabSync.ts`) — reactive data; `useQuery(api.tabs.listByUser)` drives every device.
- **Zustand** (`useTabUiStore`) — ephemeral UI state only: optimistic reorder during drag, closed-tab undo stack. Never copy Convex data into Zustand.
- **Dexie** — `tabs_cache` store for offline read; write mutations go through outbox (Epic 8 concern, not this epic's scope).

**Realtime mechanism (D9)**: Convex's built-in reactive `useQuery` subscription — no additional WebSocket, Pusher, or Ably. All devices subscribed to the same `listByUser` query receive updates automatically.

**Drag-and-drop**: `@dnd-kit/sortable` inside `TabBar.tsx`. On drag-end → optimistic reorder in Zustand → fire `reorderTabs` mutation → Convex propagates to other devices; on mutation failure, revert Zustand to last server state.

**Mobile responsive**: `TabBar.tsx` (desktop, horizontal list) switches to `TabDropdown.tsx` (viewport <768px or ≥4 tabs open on mobile). Both components live under `components/tabs/`.

**File locations**
```
apps/web/src/
  components/tabs/         # TabBar.tsx, TabDropdown.tsx
  hooks/useTabSync.ts      # FR27 reactive hook
  stores/useTabUiStore.ts  # Zustand: drag UI + closed-tab stack
convex/tabs/
  queries.ts               # listByUser()
  mutations.ts             # openTab, closeTab, reorderTabs, setActive, updateScrollState
```

**App shell flow** (architecture sequence)
1. ConvexProvider WS connect on app load.
2. `useTabSync()` reactive query hydrates tab bar immediately on every device.
3. User clicks a doc "Mở trong tab" → `openTab(docId)` → `router.push(/reader/[docId])`.
4. Scroll events in viewer → debounced `updateScrollState` mutation (rate: ~1s debounce recommended).

## UX & Interaction Patterns

- **Tab bar appearance**: horizontal strip at top of reader layout; each tab shows format icon (favicon) + truncated document title + × close button. Matches browser tab visual metaphor.
- **Opening a tab**: from `/library`, each document card has "Mở trong tab" action.
- **11th tab attempt**: blocked at mutation layer + client toast (VI): "Tối đa 10 tab".
- **Drag-drop reorder**: grab any tab and drop to new position; optimistic UI moves immediately, then commits.
- **Mobile (< 768px or ≥ 4 tabs)**: tab bar collapses to a `TabDropdown` — a single select-style control listing open tabs.
- **Close all**: available in a tab context menu; clears all `tabs` rows for the user.
- **Reopen last closed (Ctrl/Cmd+Shift+T)**: pops from Zustand session-local stack (max 5 entries of `{docId, order, scrollState}`); calls `openTab(docId)` and restores `scrollState`. Stack is cleared on page refresh — accepted MVP limitation.
- **Cross-device restore**: on new device load, `useTabSync` returns the same ordered list ≤3s post-connect; clicking a tab scrolls the viewer to the saved `scrollState`.

## Cross-Story Dependencies

| Dependency | Direction | Detail |
|---|---|---|
| Epic 1 (Auth) | Prerequisite | `requireAuth` in every mutation; `userId` from Better Auth session. |
| Epic 2 (Library) | Prerequisite | `docId` must exist in `documents` table; "Mở trong tab" entry point is the library card. |
| Epic 3 (Viewers) | Prerequisite | Tab switch navigates to `/reader/[docId]`; scroll state saved/restored depends on viewer-specific `scrollToAnchor` and `onScroll` hooks already built in Epic 3. |
| Story 4.1 → 4.2, 4.3, 4.4, 4.5 | Internal | Schema + mutations must be deployed before any UI story can be implemented. |
| Story 4.3 → 4.4 | Internal | `reorderTabs` mutation used in drag-drop (4.3) is the same mutation that propagates order to other devices (4.4). |
| Epic 8 (Offline/PWA) | Future consumer | `tabs_cache` Dexie store and outbox queue for offline tab mutations are wired in Epic 8; Epic 4 does not implement offline behaviour itself. |
| Epic 9 (Telemetry) | Telemetry event | `tabs.synced` event with `latencyMs` must be emitted in `useTabSync` for the dashboard built in Epic 9. |
