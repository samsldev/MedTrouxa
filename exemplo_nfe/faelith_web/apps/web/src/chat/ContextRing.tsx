/**
 * @fileoverview Context usage ring and the Cursor-style context breakdown popover.
 * @author Samuel S. L.
 * @version 1.2.0 (web copy of the desktop component; keep in sync)
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
 * Behaviour:
 * - Ring arc length tracks used/limit; stroke color follows the active mode
 * - Click opens a popover: "N% Full", "~used / limit Tokens", segmented bar
 * - Rows are the CLI HUD segments verbatim (system, tools, rules, skills, mcp,
 *   agents, summarized, chat); labels and colors come from the backend payload
 * - Formatting matches faelith-tui token_budget (K/M suffix, min 1%)
 */
import { useChatT } from './chatI18n';
import { useEffect, useRef, useState } from 'react';
import type { ContextUsage, UsageSegment } from './chatApi';

/**
 * Formats a token count with K/M suffixes, mirroring
 * `format_usage_token_count` in faelith-tui so the desktop and TUI agree.
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens >= 1_000_000 || Math.round(tokens / 1000) >= 1000) {
    const millions = tokens / 1_000_000;
    return millions < 10 ? `${Number(millions.toFixed(1))}M` : `${Math.round(millions)}M`;
  }
  const thousands = tokens / 1000;
  return thousands < 10 ? `${Number(thousands.toFixed(1))}K` : `${Math.round(thousands)}K`;
}

/**
 * Display percentage clamped to [1, 100] when any usage exists, matching
 * `format_context_usage_percent` in the TUI.
 */
export function formatPercent(used: number, limit: number): number {
  if (used === 0 || limit === 0) return 0;
  return Math.min(100, Math.max(1, Math.round((used / limit) * 100)));
}

/**
 * Keeps only populated segments. Order, labels and colors are exactly what
 * the CLI HUD emits (`counts_to_segments` in faelith-cli), so the desktop never
 * invents or renames a category.
 */
function visibleSegments(segments: UsageSegment[]): UsageSegment[] {
  return segments.filter((segment) => segment.value > 0);
}

/**
 * Capitalizes the CLI legend label for the popover row ("chat" -> "Chat").
 */
function rowLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Circular progress indicator. `size` is the outer diameter; the stroke
 * width scales so the ring reads well at composer scale (16-18px).
 */
function Ring({ fraction, color, size = 16 }: { fraction: number; color: string; size?: number }) {
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-fill"
      />
    </svg>
  );
}

type Props = {
  usage: ContextUsage | null;
  color: string;
  onOpen?: () => void;
};

/**
 * Ring trigger plus popover. The popover is anchored above the trigger (the
 * composer sits at the bottom of the window) and closes on outside click or
 * Escape. `onOpen` lets the parent refresh usage right before display.
 */
export function ContextRing({ usage, color, onOpen }: Props) {
  const t = useChatT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 0;
  const estimated = usage?.estimated ?? false;
  const pct = formatPercent(used, limit);
  const fraction = limit > 0 ? used / limit : 0;
  const segments = visibleSegments(usage?.segments ?? []);
  const danger = fraction >= 0.9;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ctx-ring" ref={rootRef}>
      <button
        type="button"
        className={`ctx-ring-btn ${danger ? 'danger' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.contextAria(pct)}
        title={t.contextTitle(pct, formatTokens(used), formatTokens(limit))}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((state) => !state);
        }}
      >
        <Ring fraction={fraction} color={danger ? 'var(--error)' : color} />
      </button>
      {open && (
        <div className="ctx-pop" role="dialog" aria-label={t.contextUsage}>
          <div className="ctx-pop-title">{t.contextUsage}</div>
          <div className="ctx-pop-head">
            <span className="ctx-pop-pct">{t.full(pct)}</span>
            <span className="ctx-pop-tokens">
              {estimated ? '~' : ''}
              {formatTokens(used)} / {formatTokens(limit)} {t.tokens}
            </span>
          </div>
          <div className="ctx-bar" aria-hidden="true">
            {segments.map((segment) => (
              <span
                key={segment.id}
                className="ctx-bar-seg"
                style={{ width: `${limit > 0 ? (segment.value / limit) * 100 : 0}%`, background: segment.color }}
              />
            ))}
          </div>
          {segments.length === 0 ? (
            <div className="ctx-empty">{t.noContext}</div>
          ) : (
            <ul className="ctx-rows">
              {segments.map((segment) => (
                <li key={segment.id}>
                  <span className="ctx-swatch" style={{ background: segment.color }} />
                  <span className="ctx-row-label">{rowLabel(segment.label)}</span>
                  <span className="ctx-row-value">{formatTokens(segment.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
