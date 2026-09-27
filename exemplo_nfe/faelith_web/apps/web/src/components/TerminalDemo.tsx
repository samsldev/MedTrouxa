/**
 * @fileoverview Animated hero replica of the current Faelith Code CLI TUI (desktop-app shell).
 * @author Samuel S. L.
 * @version 3.1.0
 * @since 2026-09-07
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
 * DETAILED_DESCRIPTION:
 * - Mirrors faelith-tui 2.x: sidebar (switcher, nav, Projects, Recents, account), topbar with
 *   the workspace crumb, desktop empty state, bordered user card, plain prose replies,
 *   composer card (mode pill, model, context ring, send button) and the chip footer with
 *   the 5h / weekly limit line
 * - Copy is taken verbatim from the CLI (chrome.rs, empty_state.rs, composer_footer.rs)
 * - Scenes: empty state -> typing -> agent running (tools) -> answer with a file card
 * - Loops; renders the finished scene statically under prefers-reduced-motion
 * - Interactive (no free-text prompt): mode and model/effort pickers, context ring,
 *   sidebar toggle (button or ← while focused), Esc closes a picker
 */

import { useEffect, useState, type KeyboardEvent } from 'react';
import styles from './TerminalDemo.module.css';

const USER_PROMPT = 'fix the flaky retry in api/queue.rs and add tests';
const ANSWER =
  'The retry loop reused one Instant across attempts, so the first backoff was near zero and the queue hammered the broker under load. It now uses exponential backoff with full jitter, capped at 5 attempts, behind a deterministic clock for the tests.';
const TIP = 'Type / to run commands like /commit, /diff or /worktree.';
const PALETTE: Array<[string, string]> = [
  ['New worktree', 'ctrl+w'],
  ['Sessions', 'ctrl+s'],
  ['Settings', '/settings'],
  ['Changelog', '/changelog'],
  ['Quit', 'ctrl+q'],
];
const TOOLS = ['Read api/queue.rs', 'Edit api/queue.rs', 'Write api/queue_test.rs', 'Bash cargo test -p api'];

type Scene = 'empty' | 'typing' | 'running' | 'done';
type Menu = 'mode' | 'model' | null;

/** Interaction modes with the CLI glyphs and colors (faelith-theme DARK_THEME). */
const MODES = [
  { id: 'Agent', glyph: '∞', color: '#d6425a' },
  { id: 'Plan', glyph: '≡', color: '#ff8a4c' },
  { id: 'Ask', glyph: '?', color: '#2fd39a' },
  { id: 'Parallel', glyph: '∥', color: '#5b8def' },
  { id: 'Peak', glyph: '▲', color: '#c86be0' },
] as const;
const MODELS = ['Echo Preview', 'Horizon Preview', 'Echo Preview 1M', 'Horizon Preview 1M'] as const;
const EFFORTS = ['Low', 'Medium', 'High', 'Xhigh', 'Max'] as const;
/** What each mode does, shown when it is picked (copy from the docs). */
const MODE_HINT: Record<(typeof MODES)[number]['id'], string> = {
  Agent: 'Reads, edits and runs commands with your permission settings.',
  Plan: 'Read-only: writes a plan you review before anything runs.',
  Ask: 'Answers and explains; never edits or runs anything.',
  Parallel: 'Splits the work across subagents, each in its own worktree.',
  Peak: 'Runs N isolated implementations and keeps the best one.',
};

/** Composer settings the visitor can change. */
type Controls = {
  mode: (typeof MODES)[number];
  model: (typeof MODELS)[number];
  effort: (typeof EFFORTS)[number];
  menu: Menu;
  contextOpen: boolean;
};

/** Scene timeline in milliseconds (typing is driven per character). */
const EMPTY_MS = 2600;
const TYPE_MS = 34;
const TOOL_MS = 700;
const DONE_HOLD_MS = 6500;

/**
 * Detects the OS-level reduced motion preference at mount time.
 */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Left rail: product switcher, nav rows, Projects tree, Recents, account.
 */
function Sidebar({ title }: { title: string }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.switcher}>
        <span className={styles.brand}>◆</span>
        <span className={styles.strong}>Faelith Code</span>
        <span className={styles.push}>⌄</span>
      </div>
      <div className={styles.navRow}><span className={styles.muted}>+</span> New worktree</div>
      <div className={styles.navRow}><span className={styles.muted}>⌕</span> Sessions</div>
      <div className={styles.navRow}><span className={styles.muted}>⚙</span> Settings</div>
      <div className={styles.section}>Projects ⌄</div>
      <div className={styles.navRow}><span className={styles.faint}>▾</span> <span className={styles.muted}>▭</span> api</div>
      <div className={`${styles.session} ${styles.nested} ${styles.active}`}>
        <span className={styles.dotAccent}>•</span><span className={styles.ellipsis}>{title}</span><span className={styles.age}>now</span>
      </div>
      <div className={`${styles.session} ${styles.nested}`}>
        <span className={styles.dotMuted}>•</span><span className={styles.ellipsis}>Add rate limiter</span><span className={styles.age}>2h</span>
      </div>
      <div className={styles.section}>Recents ⌄</div>
      <div className={`${styles.session} ${styles.active}`}>
        <span className={styles.dotAccent}>•</span><span className={styles.ellipsis}>{title}</span><span className={styles.age}>now</span>
      </div>
      <div className={styles.session}>
        <span className={styles.dotMuted}>•</span><span className={styles.ellipsis}>Add rate limiter</span><span className={styles.age}>2h</span>
      </div>
      <div className={styles.account}>
        <span className={styles.avatar}>S</span>
        <span className={styles.accountText}>
          <span>Signed in</span>
          <span className={styles.muted}>Pro plan</span>
        </span>
        <span className={`${styles.muted} ${styles.push}`}>⚙</span>
      </div>
    </aside>
  );
}

/**
 * Centered desktop-style empty state with the shortcut palette.
 */
function EmptyState({ tip }: { tip: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.mark}>&lt;/&gt;</div>
      <div className={styles.strong}>Faelith Code</div>
      <div className={styles.muted}>The same agent as the desktop app. Files, terminal and tools, right here.</div>
      <div className={styles.faint}>✦ {tip}</div>
      <div className={styles.palette}>
        {PALETTE.map(([label, hint]) => (
          <div key={label} className={styles.paletteRow}>
            <span><span className={styles.muted}>▸ </span>{label}</span>
            <span className={styles.faint}>{hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Composer card: draft (or placeholder) with caret, spacer, controls row.
 */
function Composer({
  draft,
  running,
  contextPercent,
  controls,
  onChange,
}: {
  draft: string;
  running: boolean;
  contextPercent: number;
  controls: Controls;
  onChange: (patch: Partial<Controls>) => void;
}) {
  const ready = draft.length > 0 && !running;
  const toggle = (menu: Menu) => onChange({ menu: controls.menu === menu ? null : menu });
  const placeholder = running ? 'Agent running… Enter queues a follow-up · Esc cancel' : 'Ask Faelith Code. Type / for commands, @ for files.';
  return (
    <div className={styles.composer}>
      {controls.contextOpen ? (
        <div className={styles.context}>
          <div>
            <span>{contextPercent}% context used</span>
            <span className={styles.muted}>{contextPercent ? '~20K' : '0'} / 256K tokens</span>
          </div>
          <div className={styles.contextBar}>
            <span style={{ width: `${Math.max(contextPercent, 1)}%` }} />
          </div>
          <div className={styles.muted}>■ system · ■ tools · ■ rules · ■ skills · ■ chat</div>
        </div>
      ) : null}
      {controls.menu ? (
        <div className={styles.menu} role="listbox" style={{ left: controls.menu === 'mode' ? 10 : 90 }}>
          {controls.menu === 'mode' ? (
            <>
              <div className={styles.faint}>Mode</div>
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="option"
                  aria-selected={mode.id === controls.mode.id}
                  onClick={() => onChange({ mode, menu: null })}
                >
                  <span>{mode.id === controls.mode.id ? '✓ ' : '  '}</span>
                  <span style={{ color: mode.color }}>{mode.id}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <div className={styles.faint}>Model</div>
              {MODELS.map((model) => (
                <button key={model} type="button" role="option" aria-selected={model === controls.model} onClick={() => onChange({ model })}>
                  <span>{model === controls.model ? '✓ ' : '  '}</span>
                  {model}
                </button>
              ))}
              <div className={styles.faint}>Effort</div>
              {EFFORTS.map((effort) => (
                <button key={effort} type="button" role="option" aria-selected={effort === controls.effort} onClick={() => onChange({ effort })}>
                  <span>{effort === controls.effort ? '✓ ' : '  '}</span>
                  {effort}
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
      <div className={styles.draft}>
        <span className={styles.caret} />
        {draft ? <span>{draft}</span> : <span className={styles.muted}>{placeholder}</span>}
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.control} aria-label="Change mode" onClick={() => toggle('mode')}>
          <span className={styles.pill} style={{ color: controls.mode.color }}>
            {controls.mode.glyph} {controls.mode.id}
          </span>
          <span className={styles.muted}> ⌄</span>
        </button>
        <button type="button" className={`${styles.control} ${styles.model}`} aria-label="Change model and effort" onClick={() => toggle('model')}>
          {controls.model} <span className={styles.muted}>{controls.effort} ⌄</span>
        </button>
        <button
          type="button"
          className={`${styles.control} ${styles.muted} ${styles.push}`}
          aria-label="Toggle context usage"
          onClick={() => onChange({ contextOpen: !controls.contextOpen, menu: null })}
        >
          ◔ {contextPercent}%
        </button>
        <span className={`${styles.send} ${ready || running ? styles.sendOn : ''}`}>{running ? '■' : '↑'}</span>
      </div>
    </div>
  );
}

/**
 * Drives the scene state machine and renders the CLI shell.
 */
export function TerminalDemo() {
  const [staticMode] = useState(prefersReducedMotion);
  const [scene, setScene] = useState<Scene>(staticMode ? 'done' : 'empty');
  const [typed, setTyped] = useState(0);
  const [tools, setTools] = useState(staticMode ? TOOLS.length : 0);
  const [controls, setControls] = useState<Controls>({
    mode: MODES[0],
    model: MODELS[0],
    effort: EFFORTS[0],
    menu: null,
    contextOpen: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const update = (patch: Partial<Controls>) => setControls((current) => ({ ...current, ...patch }));

  /** ← toggles the sidebar and Esc closes a picker, like the CLI; Shift+Tab cycles modes. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarOpen((open) => !open);
    } else if (event.key === 'Escape') {
      update({ menu: null });
    } else if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      const next = MODES[(MODES.indexOf(controls.mode) + 1) % MODES.length];
      update({ mode: next, menu: null });
    }
  }

  useEffect(() => {
    if (staticMode) return;
    let timer: number;
    if (scene === 'empty') {
      timer = window.setTimeout(() => setScene('typing'), EMPTY_MS);
    } else if (scene === 'typing') {
      timer = typed < USER_PROMPT.length
        ? window.setTimeout(() => setTyped((value) => value + 1), TYPE_MS)
        : window.setTimeout(() => setScene('running'), 500);
    } else if (scene === 'running') {
      timer = tools < TOOLS.length
        ? window.setTimeout(() => setTools((value) => value + 1), TOOL_MS)
        : window.setTimeout(() => setScene('done'), TOOL_MS);
    } else {
      timer = window.setTimeout(() => {
        setTyped(0);
        setTools(0);
        setScene('empty');
      }, DONE_HOLD_MS);
    }
    return () => window.clearTimeout(timer);
  }, [scene, typed, tools, staticMode]);

  const sent = scene === 'running' || scene === 'done';
  const title = sent ? 'Fix flaky queue retry' : 'New session';
  const draft = scene === 'typing' ? USER_PROMPT.slice(0, typed) : '';
  const running = scene === 'running';
  const current = TOOLS[Math.max(0, tools - 1)]?.split(' ')[0] ?? 'Read';

  return (
    <div
      className={styles.window}
      role="group"
      tabIndex={0}
      aria-label="Interactive Faelith Code CLI preview: try the mode and model pickers, the context ring, and ← to toggle the sidebar"
      onKeyDown={onKeyDown}
    >
      <div className={styles.bar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.title}>faelith — ~/work/api</span>
      </div>
      <div className={styles.shell}>
        {sidebarOpen ? <Sidebar title={title} /> : null}
        <main className={styles.main}>
          <div className={styles.topbar}>
            <button
              type="button"
              className={styles.control}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              title="Toggle sidebar (←)"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <span className={styles.muted}>{sidebarOpen ? '◧' : '▯'}</span>
            </button>
            <span className={styles.strong}>{title}</span>
            <span className={styles.crumb}>▭ api</span>
            {running ? <span className={styles.muted}>◌</span> : null}
          </div>
          <div className={styles.thread}>
            {!sent ? (
              <EmptyState tip={controls.mode.id === 'Agent' ? TIP : `${controls.mode.id}: ${MODE_HINT[controls.mode.id]}`} />
            ) : (
              <div className={styles.messages}>
                <div className={styles.userCard}>{USER_PROMPT}</div>
                <div className={styles.faint}>{running ? '◌ Thinking…' : '✦ thought 1x 3s'}</div>
                <div className={styles.muted}>
                  {running
                    ? `· running: ${current}…`
                    : '· tools: Read · Edit · Write · Bash'}
                </div>
                {scene === 'done' ? (
                  <>
                    <div className={styles.fileCard}>
                      <span><span className={styles.muted}>▸ </span>edited api/queue.rs</span>
                      <span><span className={styles.add}>+12</span> <span className={styles.del}>-4</span></span>
                    </div>
                    <div className={styles.fileCard}>
                      <span><span className={styles.muted}>▸ </span>created api/queue_test.rs</span>
                      <span className={styles.add}>+38</span>
                    </div>
                    <p className={styles.prose}>{ANSWER}</p>
                  </>
                ) : null}
              </div>
            )}
          </div>
          <Composer draft={draft} running={running} contextPercent={sent ? 8 : 0} controls={controls} onChange={update} />
          <div className={styles.footer}>
            <span>▭ api</span>
            <span>⎇ fix/queue-retry</span>
            <span>▣ This PC</span>
            <span>◈ Adaptive ⌄</span>
            {running ? <span className={styles.fgText}>● Working</span> : null}
            {scene === 'done' ? <span className={styles.add}>● Done</span> : null}
          </div>
          <div className={styles.footer}>◔ 5h limit: 12% used · Weekly limit: 34% used</div>
        </main>
      </div>
    </div>
  );
}
