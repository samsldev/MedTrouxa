/**
 * @fileoverview Admin report filters: period presets and custom dates, plus segment filters (device, source, campaign, landing).
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-26
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
 * <DETAILED_DESCRIPTION>:
 * - Presets: 24 hours (exact instants), 7 days, 15 days, 1 month, 3 months, 1 year; the active preset is highlighted
 * - Custom from / to dates stay available for any other period (server caps a range at one year)
 * - Segment text filters apply on submit (no request per keystroke); the device select applies at once
 */

import { useEffect, useState, type FormEvent } from 'react';
import type { Range, Segment } from '../../../lib/adminApi';
import { useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { isoDay, T } from './adminI18n';

/** Day presets, matched by index with `t.range.presets` after the leading 24-hour preset. */
const PRESET_DAYS = [7, 15, 30, 90, 365];

/** No segment filter. */
export const ALL_SEGMENTS: Segment = { device: '', source: '', campaign: '', lp: '' };

/**
 * The last `days` days, today included.
 */
export function lastDays(days: number): Range {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: isoDay(from), to: isoDay(to), preset: `${days}d` };
}

/**
 * The last 24 hours as exact instants.
 */
function last24Hours(): Range {
  const to = new Date();
  return { from: new Date(to.getTime() - 86_400_000).toISOString(), to: to.toISOString(), preset: '24h' };
}

/**
 * Preset buttons and two date inputs for the report period.
 */
export function RangePicker({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  const t = useT(T);
  return (
    <div className={styles.toolbar}>
      {[last24Hours, ...PRESET_DAYS.map((days) => () => lastDays(days))].map((make, index) => {
        const key = index === 0 ? '24h' : `${PRESET_DAYS[index - 1]}d`;
        const active = value.preset === key;
        return (
          <button
            key={key}
            type="button"
            className={active ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            aria-pressed={active}
            onClick={() => onChange(make())}
          >
            {t.range.presets[index]}
          </button>
        );
      })}
      <label className="field">
        <span>{t.range.from}</span>
        <input
          type="date"
          value={value.from.slice(0, 10)}
          max={value.to.slice(0, 10)}
          onChange={(event) => event.target.value && onChange({ from: event.target.value, to: value.to.slice(0, 10) })}
        />
      </label>
      <label className="field">
        <span>{t.range.to}</span>
        <input
          type="date"
          value={value.to.slice(0, 10)}
          min={value.from.slice(0, 10)}
          onChange={(event) => event.target.value && onChange({ from: value.from.slice(0, 10), to: event.target.value })}
        />
      </label>
    </div>
  );
}

/**
 * Segment filters; `showDevice` is false on the heatmap, which has its own device picker.
 */
export function SegmentBar({ value, onChange, showDevice = true }: { value: Segment; onChange: (segment: Segment) => void; showDevice?: boolean }) {
  const t = useT(T);
  const f = t.filters;
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  /** Applies the text filters. */
  function submit(event: FormEvent) {
    event.preventDefault();
    onChange({ ...draft, source: draft.source.trim(), campaign: draft.campaign.trim(), lp: draft.lp.trim() });
  }

  const active = Object.values(value).some(Boolean);
  return (
    <form className={styles.toolbar} onSubmit={submit}>
      {showDevice ? (
        <label className="field">
          <span>{f.device}</span>
          <select value={value.device} onChange={(event) => onChange({ ...value, device: event.target.value })}>
            <option value="">{f.all}</option>
            <option value="desktop">desktop</option>
            <option value="tablet">tablet</option>
            <option value="mobile">mobile</option>
          </select>
        </label>
      ) : null}
      <label className="field">
        <span>{f.source}</span>
        <input value={draft.source} placeholder="meta" onChange={(event) => setDraft({ ...draft, source: event.target.value })} />
      </label>
      <label className="field">
        <span>{f.campaign}</span>
        <input value={draft.campaign} onChange={(event) => setDraft({ ...draft, campaign: event.target.value })} />
      </label>
      <label className="field">
        <span>{f.lp}</span>
        <input value={draft.lp} placeholder="code-1-br" onChange={(event) => setDraft({ ...draft, lp: event.target.value })} />
      </label>
      <button type="submit" className="btn btn-ghost btn-sm">
        {f.apply}
      </button>
      {active ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(ALL_SEGMENTS)}>
          {f.clear}
        </button>
      ) : null}
    </form>
  );
}
