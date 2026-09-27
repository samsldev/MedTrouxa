/**
 * @fileoverview Inline SVG icon set for the Faelith desktop shell.
 * @author Samuel S. L.
 * @version 1.9.0 (web copy of the desktop component; keep in sync)
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
 * Icon set:
 * - 16px stroke icons matching the Codex / Cursor visual language
 * - Single Icon component keyed by name to keep call sites terse
 * - No external icon dependency, keeps bundle small
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'plus'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-up'
  | 'settings'
  | 'user'
  | 'chat'
  | 'code'
  | 'folder'
  | 'file'
  | 'terminal'
  | 'globe'
  | 'diff'
  | 'send'
  | 'stop'
  | 'paperclip'
  | 'search'
  | 'sidebar'
  | 'check'
  | 'x'
  | 'spark'
  | 'bolt'
  | 'clock'
  | 'copy'
  | 'branch'
  | 'monitor'
  | 'panel'
  | 'gauge'
  | 'brain'
  | 'shield'
  | 'users'
  | 'power'
  | 'worktree'
  | 'pin'
  | 'pencil'
  | 'eye'
  | 'ghost-chat'
  | 'export'
  | 'bell'
  | 'bot'
  | 'archive'
  | 'trash'
  | 'filter'
  | 'arrow-right'
  | 'rewind'
  | 'dots'
  | 'list'
  | 'refresh'
  | 'file-plus'
  | 'folder-plus'
  | 'star'
  | 'camera'
  | 'home';

/** Icons offered by the session "Edit Icon" submenu; the empty entry clears it. */
export const SESSION_ICON_CHOICES: IconName[] = ['folder', 'code', 'bolt', 'spark', 'shield', 'brain', 'users', 'globe', 'terminal', 'diff', 'chat', 'file'];

/** Runtime guard so persisted icon names that no longer exist fall back safely. */
export function isIconName(value: string | null | undefined): value is IconName {
  return typeof value === 'string' && value in PATHS;
}

const PATHS: Record<IconName, string> = {
  plus: 'M8 3v10M3 8h10',
  'chevron-down': 'M4 6l4 4 4-4',
  'chevron-right': 'M6 4l4 4-4 4',
  'chevron-up': 'M4 10l4-4 4 4',
  settings:
    'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM13.4 9.6l-.9-.5a5 5 0 0 0 0-2.2l.9-.5-1-1.7-.9.5a5 5 0 0 0-1.9-1.1V3H6.4v1.1a5 5 0 0 0-1.9 1.1l-.9-.5-1 1.7.9.5a5 5 0 0 0 0 2.2l-.9.5 1 1.7.9-.5a5 5 0 0 0 1.9 1.1V13h3.2v-1.1a5 5 0 0 0 1.9-1.1l.9.5z',
  user: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14a5.5 5.5 0 0 1 11 0',
  chat: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z',
  code: 'M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10',
  folder: 'M2 4.5h4l1.5 1.5H14v7H2z',
  file: 'M4 2h5l3 3v9H4zM9 2v3h3',
  terminal: 'M2.5 3.5h11v9h-11zM5 6.5l2 1.5-2 1.5M8 10h3',
  globe: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12',
  diff: 'M5 2v6M2 5h6M2 12h6M10 3h4v10h-4',
  send: 'M8 13V3M4 7l4-4 4 4',
  stop: 'M4.5 4.5h7v7h-7z',
  paperclip: 'M10.5 6.5l-4 4a1.5 1.5 0 0 1-2-2l5-5a2.5 2.5 0 0 1 3.5 3.5l-5 5a3.5 3.5 0 0 1-5-5l4-4',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.5 10.5L14 14',
  sidebar: 'M2.5 3h11v10h-11zM6 3v10',
  check: 'M3 8.5l3 3 7-7',
  x: 'M4 4l8 8M12 4l-8 8',
  spark: 'M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z',
  bolt: 'M9 2L4 9h4l-1 5 5-7H8z',
  clock: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3l2 1.5',
  copy: 'M6 6h7v7H6zM3 10V3h7',
  branch: 'M5 3v10M5 6a2 2 0 1 0 0 0M11 3a2 2 0 1 0 0 0M11 5c0 3-6 2-6 5',
  monitor: 'M2 3h12v8H2zM6 13h4M8 11v2',
  panel: 'M2.5 3h11v10h-11zM9.5 3v10',
  gauge: 'M2.5 11a5.5 5.5 0 1 1 11 0M8 11l2.5-4',
  brain: 'M6 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8 3v10M4 7h2M10 7h2M4 10h2M10 10h2',
  shield: 'M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z',
  users: 'M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13a4.5 4.5 0 0 1 9 0M10.5 3.5a2.5 2.5 0 0 1 0 4.5M14.5 13a4.5 4.5 0 0 0-3-4.2',
  power: 'M8 2v6M4.2 5.2a5.5 5.5 0 1 0 7.6 0',
  // Robot head: subagent rows and the subagent transcript modal.
  bot: 'M4 6.5h8a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 12 13.5H4A1.5 1.5 0 0 1 2.5 12V8A1.5 1.5 0 0 1 4 6.5zM8 6.5V4M6.5 2.5h3M5.75 10h.01M10.25 10h.01',
  // Fork glyph: a trunk that splits into a branch, matching the "New Worktree" reference.
  worktree: 'M2.5 5.5h4.5c2 0 2.5 2 4.5 2h2M7 7.5c2 0 2.5 3 4.5 3h2M11.5 9l2 1.5-2 1.5',
  pin: 'M6 2h4l-.5 4 2.5 2.5v1H4v-1L6.5 6zM8 9.5V14',
  pencil: 'M3 13l1-3.5 7-7 2.5 2.5-7 7zM10 3.5l2.5 2.5',
  eye: 'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8zM8 10a2 2 0 100-4 2 2 0 000 4z',
  // Temporary chat: dashed speech bubble (ChatGPT-style glyph).
  'ghost-chat': 'M3 3h3M8 3h2.5M12 3h1v2M13 7v2.5M13 11.5V12h-2M8.5 12H6M4 12H3v-1M3 8.5V6M3 4.5V3',
  // Export transcript: document with an arrow leaving from the top.
  export: 'M9 2H4v12h8V5zM9 2v3h3M8 12V7.5M6 9.5l2-2 2 2',
  bell: 'M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3zM6.5 13.5a1.5 1.5 0 0 0 3 0',
  archive: 'M2.5 3.5h11v3h-11zM3.5 6.5v6.5h9V6.5M6.5 9.5h3',
  trash: 'M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M6.8 7v4M9.2 7v4',
  filter: 'M2.5 4h11M4.5 8h7M6.5 12h3',
  'arrow-right': 'M3 8h10M9 4l4 4-4 4',
  // Undo-style arrow used by the message rewind button.
  rewind: 'M3 7h7a3 3 0 0 1 0 6H7M3 7l3-3M3 7l3 3',
  // Files strip and browser toolbar glyphs.
  dots: 'M4 8h.01M8 8h.01M12 8h.01',
  list: 'M3 4h10M3 8h10M3 12h10',
  refresh: 'M13 8a5 5 0 1 1-1.5-3.5M13 3v2.5h-2.5',
  'file-plus': 'M4 2h5l3 3v9H4zM9 2v3h3M8 8v4M6 10h4',
  'folder-plus': 'M2 4.5h4.5l1 1.5H14v7H2zM8 8v4M6 10h4',
  star: 'M8 2.5l1.7 3.6 3.8.5-2.8 2.7.7 3.9L8 11.3l-3.4 1.9.7-3.9L2.5 6.6l3.8-.5z',
  camera: 'M2 5h3l1-1.5h4L11 5h3v7H2zM8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  home: 'M2.5 8L8 2.5 13.5 8M4 7v6.5h8V7M6.5 13.5V9.5h3v4',
};

/**
 * Renders a 16x16 stroke icon from the internal path table. The `name` prop is
 * strongly typed so unknown icons fail at compile time; sizing follows the
 * CSS `font-size` through `1em` units so the icon scales with its container.
 */
export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
