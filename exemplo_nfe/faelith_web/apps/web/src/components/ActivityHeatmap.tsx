/**
 * @fileoverview Year-long activity heatmap (Cursor-style) with All / Chat / Code filters and streak stats.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-24
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
 * - 53 Sunday-aligned week columns ending today (UTC), month labels on top, M / W / F on the left
 * - Four accent shades from dark to light, bucketed by quartiles of the active days
 * - Footer stats: most active month, most active day, longest and current streak
 * - Localized labels and dates (en, pt-BR, pt-PT)
 */

import { useMemo, useState } from 'react';
import { HTML_LANG, useLocale, type Dict } from '../lib/i18n';
import type { HeatmapDay } from '../lib/types';
import styles from './ActivityHeatmap.module.css';

type Filter = 'all' | 'chat' | 'code';

const FILTERS: Filter[] = ['all', 'chat', 'code'];

interface HeatmapStrings {
  filters: Record<Filter, string>;
  tokens: string;
  source: string;
  gridLabel: string;
  cellTokens: (day: string, value: string) => string;
  topMonth: string;
  topDay: string;
  longest: string;
  current: string;
  days: (count: number) => string;
  fewer: string;
  more: string;
  weekdays: string[];
}

const T: Dict<HeatmapStrings> = {
  en: {
    filters: { all: 'All', chat: 'Chat', code: 'Code' },
    tokens: 'Tokens',
    source: 'Activity source',
    gridLabel: 'Daily token activity over the last year',
    cellTokens: (day, value) => `${day}: ${value} tokens`,
    topMonth: 'Most Active Month',
    topDay: 'Most Active Day',
    longest: 'Longest Streak',
    current: 'Current Streak',
    days: (count) => `${count}d`,
    fewer: 'Fewer',
    more: 'More',
    weekdays: ['', 'M', '', 'W', '', 'F', ''],
  },
  br: {
    filters: { all: 'Tudo', chat: 'Chat', code: 'Code' },
    tokens: 'Tokens',
    source: 'Origem da atividade',
    gridLabel: 'Atividade diária de tokens no último ano',
    cellTokens: (day, value) => `${day}: ${value} tokens`,
    topMonth: 'Mês mais ativo',
    topDay: 'Dia mais ativo',
    longest: 'Maior sequência',
    current: 'Sequência atual',
    days: (count) => `${count}d`,
    fewer: 'Menos',
    more: 'Mais',
    weekdays: ['', 'S', '', 'Q', '', 'S', ''],
  },
  pt: {
    filters: { all: 'Tudo', chat: 'Chat', code: 'Code' },
    tokens: 'Tokens',
    source: 'Origem da atividade',
    gridLabel: 'Atividade diária de tokens no último ano',
    cellTokens: (day, value) => `${day}: ${value} tokens`,
    topMonth: 'Mês mais ativo',
    topDay: 'Dia mais ativo',
    longest: 'Sequência mais longa',
    current: 'Sequência atual',
    days: (count) => `${count}d`,
    fewer: 'Menos',
    more: 'Mais',
    weekdays: ['', 'S', '', 'Q', '', 'S', ''],
  },
};

const WEEKS = 53;
const DAY_MS = 86_400_000;
const LEVEL_CLASS = [styles.l0, styles.l1, styles.l2, styles.l3, styles.l4];
const numberFormat = new Intl.NumberFormat();

/** UTC calendar key (YYYY-MM-DD) for a timestamp. */
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Midnight UTC of today. */
function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Formats a UTC day for tooltips and stats, e.g. "Jun 6, 2026". */
function formatDay(ms: number, lang: string): string {
  return new Date(ms).toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Value at the given quantile of a sorted list. */
function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

type Cell = { ms: number; value: number; future: boolean };

/** Everything the grid and footer need for one filter. */
function buildModel(days: HeatmapDay[], filter: Filter, lang: string) {
  const byDay = new Map(days.map((day) => [day.date, day[filter]]));
  const today = todayUtc();
  const start = today - (7 * (WEEKS - 1) + new Date(today).getUTCDay()) * DAY_MS;
  const columns: Cell[][] = [];
  for (let week = 0; week < WEEKS; week += 1) {
    const column: Cell[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const ms = start + (week * 7 + weekday) * DAY_MS;
      column.push({ ms, value: byDay.get(dayKey(ms)) ?? 0, future: ms > today });
    }
    columns.push(column);
  }

  const cells = columns.flat().filter((cell) => !cell.future);
  const active = cells.filter((cell) => cell.value > 0).map((cell) => cell.value).sort((a, b) => a - b);
  const cuts = active.length ? [quantile(active, 0.25), quantile(active, 0.5), quantile(active, 0.75)] : [];
  const level = (value: number) => (value <= 0 ? 0 : 1 + cuts.filter((cut) => value > cut).length);

  const months = new Map<string, number>();
  let total = 0;
  let best: Cell | null = null;
  let longest = 0;
  let run = 0;
  for (const cell of cells) {
    total += cell.value;
    const month = dayKey(cell.ms).slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + cell.value);
    if (cell.value > 0 && (!best || cell.value > best.value)) best = cell;
    run = cell.value > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // A streak still counts as current when today has no usage yet.
  let current = 0;
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    if (cells[index].value > 0) current += 1;
    else if (index !== cells.length - 1) break;
  }
  const topMonth = [...months.entries()].reduce<[string, number] | null>(
    (top, entry) => (entry[1] > 0 && (!top || entry[1] > top[1]) ? entry : top),
    null,
  );

  const monthLabels = columns.map((column, index) => {
    const first = column.find((cell) => new Date(cell.ms).getUTCDate() === 1);
    const anchor = first ?? (index === 0 ? column[0] : null);
    return anchor ? new Date(anchor.ms).toLocaleDateString(lang, { month: 'short', timeZone: 'UTC' }).charAt(0).toUpperCase() : '';
  });

  return {
    columns,
    level,
    total,
    monthLabels,
    topMonth: topMonth
      ? new Date(`${topMonth[0]}-01T00:00:00Z`).toLocaleDateString(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : '—',
    topDay: best ? formatDay(best.ms, lang) : '—',
    longest,
    current,
  };
}

/**
 * Card with the filter tabs, the year grid, and the streak footer.
 */
export function ActivityHeatmap({ days }: { days: HeatmapDay[] }) {
  const { locale } = useLocale();
  const t = T[locale];
  const lang = HTML_LANG[locale];
  const [filter, setFilter] = useState<Filter>('all');
  const model = useMemo(() => buildModel(days, filter, lang), [days, filter, lang]);

  return (
    <article className={`card ${styles.card}`}>
      <header className={styles.head}>
        <div>
          <p className={styles.caption}>{t.tokens}</p>
          <p className={styles.total}>{numberFormat.format(model.total)}</p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label={t.source}>
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              className={`${styles.tab} ${filter === item ? styles.tabActive : ''}`}
              onClick={() => setFilter(item)}
            >
              {t.filters[item]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.scroll}>
        <div className={styles.grid} role="img" aria-label={t.gridLabel}>
          <span />
          {model.monthLabels.map((label, index) => (
            <span key={`m${index}`} className={styles.month}>
              {label}
            </span>
          ))}
          {t.weekdays.map((dayLabel, weekday) => (
            <div key={`row${weekday}`} className={styles.row}>
              <span className={styles.weekday}>{dayLabel}</span>
              {model.columns.map((column) => {
                const cell = column[weekday];
                return (
                  <span
                    key={cell.ms}
                    className={`${styles.cell} ${cell.future ? styles.future : LEVEL_CLASS[model.level(cell.value)]}`}
                    title={cell.future ? undefined : t.cellTokens(formatDay(cell.ms, lang), numberFormat.format(cell.value))}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.stats}>
        <div>
          <p className={styles.caption}>{t.topMonth}</p>
          <p className={styles.statValue}>{model.topMonth}</p>
        </div>
        <div>
          <p className={styles.caption}>{t.topDay}</p>
          <p className={styles.statValue}>{model.topDay}</p>
        </div>
        <div>
          <p className={styles.caption}>{t.longest}</p>
          <p className={styles.statValue}>{t.days(model.longest)}</p>
        </div>
        <div>
          <p className={styles.caption}>{t.current}</p>
          <p className={styles.statValue}>{t.days(model.current)}</p>
        </div>
      </div>

      <div className={styles.legend}>
        <span>{t.fewer}</span>
        {LEVEL_CLASS.map((className, index) => (
          <span key={index} className={`${styles.cell} ${styles.legendCell} ${className}`} />
        ))}
        <span>{t.more}</span>
      </div>
    </article>
  );
}
