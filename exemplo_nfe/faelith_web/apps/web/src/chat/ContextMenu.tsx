/**
 * @fileoverview Custom right-click context menu with nested submenus.
 * @author Samuel S. L.
 * @version 1.0.0 (web copy of the desktop component; keep in sync)
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
 * ContextMenu behaviour:
 * - Rendered in a portal at the pointer position, clamped to the viewport
 * - Items: label, optional icon, shortcut hint, checked state, danger style,
 *   disabled state, separators, and one level of hover-opened submenu
 * - Closes on outside mousedown, Escape, window blur, or after a selection
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icons';

export type MenuItem =
  | { kind: 'separator' }
  | { kind: 'label'; label: string; trailing?: ReactNode }
  | {
      kind?: 'item';
      label: string;
      icon?: IconName;
      shortcut?: string;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      /** Value rendered at the right edge (e.g. current sub-selection). */
      trailing?: ReactNode;
      submenu?: MenuItem[];
      onSelect?: () => void;
    };

export type MenuAnchor = { x: number; y: number };

type Props = {
  anchor: MenuAnchor;
  items: MenuItem[];
  onClose: () => void;
};

const MENU_WIDTH = 220;
const EDGE = 8;

/**
 * Clamps a desired top-left so a menu of `height` px stays inside the viewport.
 */
function clamp(anchor: MenuAnchor, height: number, width: number): MenuAnchor {
  const x = Math.min(anchor.x, window.innerWidth - width - EDGE);
  const y = Math.min(anchor.y, window.innerHeight - height - EDGE);
  return { x: Math.max(EDGE, x), y: Math.max(EDGE, y) };
}

/**
 * Renders one list of items. Submenus open on hover to the right of the row
 * (or to the left when there is no room) and share the same renderer.
 */
function MenuList({ items, onClose, depth }: { items: MenuItem[]; onClose: () => void; depth: number }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <ul className="cm-list" role="menu" style={{ minWidth: MENU_WIDTH }}>
      {items.map((item, index) => {
        if (item.kind === 'separator') return <li key={index} className="cm-sep" role="separator" />;
        if (item.kind === 'label') {
          return (
            <li key={index} className="cm-label">
              <span>{item.label}</span>
              {item.trailing && <span className="cm-trailing">{item.trailing}</span>}
            </li>
          );
        }
        const hasSub = Boolean(item.submenu?.length);
        return (
          <li
            key={index}
            className={`cm-row ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''} ${openIndex === index ? 'open' : ''}`}
            onMouseEnter={() => setOpenIndex(hasSub ? index : null)}
          >
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (hasSub) return;
                item.onSelect?.();
                onClose();
              }}
            >
              <span className="cm-icon">{item.icon ? <Icon name={item.icon} size={13} /> : item.checked ? <Icon name="check" size={13} /> : null}</span>
              <span className="cm-text">{item.label}</span>
              {item.trailing && <span className="cm-trailing">{item.trailing}</span>}
              {item.shortcut && <kbd className="cm-kbd">{item.shortcut}</kbd>}
              {hasSub && <Icon name="chevron-right" size={12} className="cm-caret" />}
            </button>
            {hasSub && openIndex === index && (
              <div className={`cm-sub ${depth > 1 ? 'left' : ''}`}>
                <MenuList items={item.submenu!} onClose={onClose} depth={depth + 1} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Root context menu. The first paint measures the menu and repositions it
 * inside the viewport so long menus near the bottom edge flip upward.
 */
export function ContextMenu({ anchor, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuAnchor>(anchor);

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    setPos(clamp(anchor, rect?.height ?? 0, rect?.width ?? MENU_WIDTH));
  }, [anchor]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="fchat cm" style={{ left: pos.x, top: pos.y }} onContextMenu={(event) => event.preventDefault()}>
      <MenuList items={items} onClose={onClose} depth={1} />
    </div>,
    document.body,
  );
}
