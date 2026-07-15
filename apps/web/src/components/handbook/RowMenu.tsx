"use client";

/**
 * RowMenu — shared row action menu for the library sidebar.
 *
 * UX goals:
 *  • The ⋯ trigger is ALWAYS faintly visible (not hover-only) so actions are
 *    discoverable, and darkens on hover.
 *  • Right-clicking anywhere on the row opens the same menu at the cursor.
 *  • The menu renders through a portal so it never gets clipped by the
 *    sidebar's scroll container and stacks above everything.
 *
 * Used via render-prop so it is safe inside `.map()` (each row is its own
 * <RowMenu/> instance — no hook-in-loop violation):
 *
 *   <RowMenu items={items}>
 *     {(m) => (
 *       <div className="group ..." onContextMenu={m.onContextMenu}>
 *         <button ...>{label}</button>
 *         {m.trigger}
 *       </div>
 *     )}
 *   </RowMenu>
 */

import { useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export interface RowMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface RenderArgs {
  /** Attach to the row container to enable right-click. */
  onContextMenu: (e: React.MouseEvent) => void;
  /** The always-visible ⋯ trigger button (null when there are no items). */
  trigger: ReactNode;
  /** True while the menu is open (e.g. to keep the trigger fully opaque). */
  open: boolean;
}

const TRIGGER_CLASS =
  "mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-40 transition-all hover:bg-muted hover:opacity-100 group-hover:opacity-70";

const ITEM_H = 32; // approx px per item, for cursor clamp

export function RowMenu({
  items,
  children,
}: {
  items: RowMenuItem[];
  children: (args: RenderArgs) => ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const close = useCallback(() => setPos(null), []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (items.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setPos({ x: e.clientX, y: e.clientY });
    },
    [items.length]
  );

  const trigger =
    items.length === 0 ? null : (
      <button
        type="button"
        aria-label="Tùy chọn"
        onClick={(e) => {
          e.stopPropagation();
          if (pos) {
            setPos(null);
            return;
          }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ x: r.right, y: r.bottom + 4 });
        }}
        className={TRIGGER_CLASS + (pos ? " opacity-100 bg-muted" : "")}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    );

  const overlay =
    pos && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[9997]">
            {/* click-away / right-click-away layer */}
            <div
              className="absolute inset-0"
              onClick={close}
              onContextMenu={(e) => {
                e.preventDefault();
                close();
              }}
            />
            <div
              role="menu"
              className="absolute min-w-[176px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
              style={{
                left: Math.max(8, Math.min(pos.x, window.innerWidth - 192)),
                top: Math.max(
                  8,
                  Math.min(pos.y, window.innerHeight - (items.length * ITEM_H + 16))
                ),
              }}
            >
              {items.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                    it.onClick();
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted",
                    it.danger ? "text-destructive" : "text-foreground",
                  ].join(" ")}
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {children({ onContextMenu, trigger, open: pos !== null })}
      {overlay}
    </>
  );
}
