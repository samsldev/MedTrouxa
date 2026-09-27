/**
 * @fileoverview Admin Marketing tab: KPIs, daily views chart, and per page / variant / source / campaign / device tables.
 * @author Samuel S. L.
 * @version 1.2.0
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
 * - Every table shares one column set (views, visitors, time, scroll, reach, bounce, click rate)
 * - Page rows open the heatmap; source, campaign, landing, and device names set the segment filter
 * - KPIs show the change against the previous period of the same length
 * - Subscribe interest ranks subscribe-CTA clicks by plan / interval and by page
 */

import { fetchOverview, type CountRow, type GroupStats, type Range, type Segment } from '../../../lib/adminApi';
import { useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { formatDelta, formatDuration, formatPct, T } from './adminI18n';
import { useReport } from './useReport';

/**
 * Bar chart of daily views (solid) with consented visitors (soft) behind.
 */
function DailyChart({ series }: { series: { day: string; views: number; visitors: number }[] }) {
  const width = 1000;
  const height = 160;
  const max = Math.max(1, ...series.map((point) => point.views));
  const slot = width / Math.max(series.length, 1);
  const bar = Math.max(2, slot * 0.7);
  const labelEvery = Math.ceil(series.length / 10);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
      {series.map((point, index) => {
        const x = index * slot + (slot - bar) / 2;
        const viewsH = (point.views / max) * (height - 22);
        const visitorsH = (point.visitors / max) * (height - 22);
        return (
          <g key={point.day}>
            <title>{`${point.day}: ${point.views} / ${point.visitors}`}</title>
            <rect className={styles.chartBarSoft} x={x} y={height - 18 - visitorsH} width={bar} height={visitorsH} />
            <rect className={styles.chartBar} x={x + bar * 0.25} y={height - 18 - viewsH} width={bar * 0.5} height={viewsH} />
            {index % labelEvery === 0 ? (
              <text className={styles.chartLabel} x={x} y={height - 4}>
                {point.day.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * One report table; `onOpen` adds a heatmap button per row.
 */
export function StatsTable({
  title,
  rows,
  onOpen,
  onPick,
}: {
  title: string;
  rows: GroupStats[];
  onOpen?: (name: string) => void;
  onPick?: (name: string) => void;
}) {
  const t = useT(T);
  if (rows.length === 0) return null;
  return (
    <>
      <h2 className={styles.section}>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.cols.name}</th>
              <th className={styles.num}>{t.cols.views}</th>
              <th className={styles.num}>{t.cols.visitors}</th>
              <th className={styles.num}>{t.cols.avgTime}</th>
              <th className={styles.num}>{t.cols.avgScroll}</th>
              <th className={styles.num}>{t.cols.reach}</th>
              <th className={styles.num}>{t.cols.bounce}</th>
              <th className={styles.num}>{t.cols.clickRate}</th>
              {onOpen ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td className={styles.clip} title={row.name}>
                  {onPick ? (
                    <button type="button" className="link-button" onClick={() => onPick(row.name)}>
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </td>
                <td className={styles.num}>{row.views}</td>
                <td className={styles.num}>{row.visitors}</td>
                <td className={styles.num}>{formatDuration(row.avg_active_ms)}</td>
                <td className={styles.num}>{formatPct(row.avg_scroll)}</td>
                <td className={styles.num}>{row.reach.map((value) => Math.round(value)).join(' / ')}</td>
                <td className={styles.num}>{formatPct(row.bounce_rate)}</td>
                <td className={styles.num}>{formatPct(row.click_rate)}</td>
                {onOpen ? (
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(row.name)}>
                      {t.openHeatmap}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Two-column ranking table (name, clicks).
 */
function CountTable({ title, rows }: { title: string; rows: CountRow[] }) {
  const t = useT(T);
  if (rows.length === 0) return null;
  return (
    <>
      <h2 className={styles.section}>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.cols.name}</th>
              <th className={styles.num}>{t.intent.clicks}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td className={styles.clip}>{row.name}</td>
                <td className={styles.num}>{row.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Marketing overview for the selected period.
 */
export function MarketingTab({
  range,
  segment,
  onSegment,
  onOpenHeatmap,
}: {
  range: Range;
  segment: Segment;
  onSegment: (segment: Segment) => void;
  onOpenHeatmap: (path: string) => void;
}) {
  const t = useT(T);
  const { data, error, loading } = useReport(
    () => fetchOverview(range, segment),
    `${range.from}|${range.to}|${JSON.stringify(segment)}`,
    t.failed,
  );
  const pick = (field: keyof Segment) => (name: string) => onSegment({ ...segment, [field]: name });

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className={styles.note}>{loading ? t.loading : t.empty}</p>;
  const totals = data.totals;
  const before = data.previous.totals;
  const kpis: [string, string, string | null][] = [
    [t.kpi.views, String(totals.views), formatDelta(totals.views, before.views, false)],
    [t.kpi.visitors, String(totals.visitors), formatDelta(totals.visitors, before.visitors, false)],
    [t.kpi.sessions, String(totals.sessions), formatDelta(totals.sessions, before.sessions, false)],
    [t.kpi.avgTime, formatDuration(totals.avg_active_ms), formatDelta(totals.avg_active_ms, before.avg_active_ms, false)],
    [t.kpi.avgScroll, formatPct(totals.avg_scroll), formatDelta(totals.avg_scroll, before.avg_scroll, true)],
    [t.kpi.bounce, formatPct(totals.bounce_rate), formatDelta(totals.bounce_rate, before.bounce_rate, true)],
    [t.kpi.clickRate, formatPct(totals.click_rate), formatDelta(totals.click_rate, before.click_rate, true)],
    [t.kpi.anonymous, String(data.anonymous_views), formatDelta(data.anonymous_views, data.previous.anonymous_views, false)],
  ];
  return (
    <>
      {data.truncated ? <p className="notice">{t.truncated}</p> : null}
      <div className={styles.kpis}>
        {kpis.map(([label, value, delta]) => (
          <div key={label} className={styles.kpi}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>{value}</div>
            {delta ? (
              <div className={styles.kpiDelta} title={t.vsPrevious}>
                {delta} <span>{t.vsPrevious}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className={styles.note}>{t.consentNote}</p>
      {totals.views === 0 ? <p className={styles.note}>{t.empty}</p> : null}
      <h2 className={styles.section}>{t.sections.daily}</h2>
      <DailyChart series={data.series} />
      <CountTable title={t.intent.title} rows={data.subscribe_intent.by_plan} />
      <CountTable title={t.intent.byPage} rows={data.subscribe_intent.by_page} />
      <StatsTable title={t.sections.pages} rows={data.pages} onOpen={onOpenHeatmap} />
      <StatsTable title={t.sections.landing} rows={data.landing_pages} onPick={pick('lp')} />
      <StatsTable title={t.sections.sources} rows={data.utm_sources} onPick={pick('source')} />
      <StatsTable title={t.sections.campaigns} rows={data.utm_campaigns} onPick={pick('campaign')} />
      <StatsTable title={t.sections.contents} rows={data.utm_contents} />
      <StatsTable title={t.sections.referrers} rows={data.referrers} />
      <StatsTable title={t.sections.devices} rows={data.devices} onPick={pick('device')} />
      <StatsTable title={t.sections.languages} rows={data.languages} />
    </>
  );
}
