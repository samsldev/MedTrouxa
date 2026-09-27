/**
 * @fileoverview Accessible popover dropdown used for model and mode pickers.
 * @author Samuel S. L.
 * @version 1.4.0 (web copy of the desktop component; keep in sync)
 * @since 2026-09-10
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * Dropdown behaviour:
 * - Replaces native <select> so the composer matches the reference visuals
 * - Closes on outside click and Escape, supports keyboard navigation
 * - Optional per-item description, colored dot for modes, and icon for run targets
 * - Menu is anchored in viewport coordinates and flips / clamps so it is never
 *   clipped by the window or a scrolling ancestor (Settings pages)
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';

/** Gap between the trigger and the menu, and the minimum distance to the window edge. */
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number };

type PlaceOptions = {
  align: 'left' | 'right';
  /** Open upward when it fits (composer pickers); page pickers prefer downward. */
  preferUp: boolean;
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * Computes fixed-position coordinates for the menu relative to the trigger.
 * The preferred vertical side is used when the menu fits there; otherwise the
 * opposite side is tried, and as a last resort the side with more room is used
 * with a max-height so the list scrolls instead of leaving the window. The
 * horizontal edge follows `align` and is clamped to the viewport.
 */
export function placeMenu(trigger: Rect, menu: Rect, options: PlaceOptions): CSSProperties {
  const { align, preferUp, viewportWidth, viewportHeight } = options;
  const roomAbove = trigger.top - MENU_GAP - VIEWPORT_MARGIN;
  const roomBelow = viewportHeight - trigger.bottom - MENU_GAP - VIEWPORT_MARGIN;
  const fitsUp = menu.height <= roomAbove;
  const fitsDown = menu.height <= roomBelow;
  let openUp: boolean;
  if (fitsUp && fitsDown) openUp = preferUp;
  else if (fitsUp || fitsDown) openUp = fitsUp;
  else openUp = roomAbove > roomBelow;

  const style: CSSProperties = { position: 'fixed' };
  if (openUp) {
    style.bottom = viewportHeight - trigger.top + MENU_GAP;
    style.maxHeight = Math.max(roomAbove, 0);
  } else {
    style.top = trigger.bottom + MENU_GAP;
    style.maxHeight = Math.max(roomBelow, 0);
  }

  const maxLeft = viewportWidth - VIEWPORT_MARGIN - menu.width;
  const anchored = align === 'right' ? trigger.right - menu.width : trigger.left;
  style.left = Math.min(Math.max(anchored, VIEWPORT_MARGIN), Math.max(maxLeft, VIEWPORT_MARGIN));
  return style;
}

export type DropdownItem = {
  id: string;
  label: string;
  description?: string;
  color?: string;
  /** Per-item glyph shown in the list and, for the selected item, on the trigger. */
  icon?: IconName;
  /** Shown dimmed and cannot be picked. */
  disabled?: boolean;
};

type Props = {
  value: string;
  items: DropdownItem[];
  onChange: (id: string) => void;
  icon?: ReactNode;
  align?: 'left' | 'right';
  compact?: boolean;
  /** Tooltip for the trigger; useful when the label alone is ambiguous. */
  title?: string;
};

/**
 * Popover selector rendered as a pill trigger plus a floating list. State is
 * fully local: the parent only receives `onChange`. Outside-click detection
 * uses a captured `mousedown` listener so the popover closes before any other
 * click handler fires, avoiding double-toggle glitches.
 */
export function Dropdown({ value, items, onChange, icon, align = 'left', compact = false, title }: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = items.find((item) => item.id === value) ?? items[0];

  useEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // A fixed-position menu would drift away from its trigger while an
    // ancestor scrolls, so any scroll outside the menu closes it instead.
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  // Measure after the menu renders so it can be anchored in viewport
  // coordinates: opening upward when there is room above (composer), otherwise
  // downward, and clamped horizontally so it never leaves the window.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = rootRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!trigger || !menu) return;
    const preferUp = rootRef.current?.closest('.page') === null;
    setPlacement(placeMenu(trigger, menu, { align, preferUp, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));
  }, [open, align, items.length]);

  return (
    <div className={`dd ${align}`} ref={rootRef}>
      <button
        type="button"
        className={`dd-trigger ${compact ? 'compact' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title}
        onClick={() => setOpen((state) => !state)}
      >
        {current?.color && <span className="dd-dot" style={{ background: current.color }} />}
        {icon ?? (current?.icon && <Icon name={current.icon} size={12} />)}
        <span className="dd-label">{current?.label ?? value}</span>
        <Icon name="chevron-down" size={12} className="dd-caret" />
      </button>
      {open && (
        <ul className={`dd-menu ${placement ? 'placed' : 'measuring'}`} role="listbox" ref={menuRef} style={placement ?? undefined}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === value}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                className={item.id === value ? 'selected' : ''}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                {item.color && <span className="dd-dot" style={{ background: item.color }} />}
                {item.icon && <Icon name={item.icon} size={12} className="dd-item-icon" />}
                <span className="dd-item-text">
                  <span>{item.label}</span>
                  {item.description && <small>{item.description}</small>}
                </span>
                {item.id === value && <Icon name="check" size={12} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
