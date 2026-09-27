/**
 * @fileoverview Admin Visitors tab: consented visitors of the period and the page-by-page journey of one of them.
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
 * - The list comes from GET /api/admin/analytics/visitors; a row opens GET /api/admin/analytics/visitors/{id}
 * - The journey is chronological, with each page view's time, scroll, source, and the elements clicked on it
 */

import { useState } from 'react';
import { fetchVisitor, fetchVisitors, type Range, type Segment, type VisitorJourney } from '../../../lib/adminApi';
import { HTML_LANG, useLocale, useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { formatDuration, formatPct, T } from './adminI18n';
import { useReport } from './useReport';

/**
 * One visitor's journey, oldest page view first.
 */
function Journey({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useT(T);
  const lang = HTML_LANG[useLocale().locale];
  const { data, error } = useReport<VisitorJourney>(() => fetchVisitor(id), id, t.failed);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className={styles.note}>{t.loading}</p>;
  const views = [...data.pageviews].reverse();
  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          {t.visitors.back}
        </button>
      </div>
      <h2 className={styles.section}>
        {t.visitors.journey}: {data.email ?? data.visitor_id}
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.visitors.cols.firstSeen}</th>
              <th>{t.cols.name}</th>
              <th className={styles.num}>{t.visitors.cols.time}</th>
              <th className={styles.num}>{t.cols.avgScroll}</th>
              <th>{t.visitors.cols.source}</th>
              <th>{t.visitors.clickedOn}</th>
            </tr>
          </thead>
          <tbody>
            {views.map((view) => (
              <tr key={view.id}>
                <td className={styles.num}>{new Date(view.started_at).toLocaleString(lang)}</td>
                <td className={styles.clip} title={view.path}>
                  {view.path} <span className="muted">({view.device})</span>
                </td>
                <td className={styles.num}>{formatDuration(view.active_ms)}</td>
                <td className={styles.num}>{formatPct(view.max_scroll)}</td>
                <td className={styles.clip}>{view.utm_source ?? view.referrer ?? '(direct)'}</td>
                <td className={styles.detail}>
                  {data.clicks
                    .filter((click) => click.pageview_id === view.id)
                    .map((click) => click.label)
                    .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Visitors list for the period; selecting a row shows the journey.
 */
export function VisitorsTab({ range, segment }: { range: Range; segment: Segment }) {
  const t = useT(T);
  const lang = HTML_LANG[useLocale().locale];
  const [selected, setSelected] = useState<string | null>(null);
  const { data, error, loading } = useReport(() => fetchVisitors(range, segment), `${range.from}|${range.to}|${JSON.stringify(segment)}`, t.failed);

  if (selected) return <Journey id={selected} onBack={() => setSelected(null)} />;
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className={styles.note}>{loading ? t.loading : t.empty}</p>;
  const cols = t.visitors.cols;
  return (
    <>
      <p className={styles.note}>{t.visitors.note}</p>
      {data.length === 0 ? <p className={styles.note}>{t.empty}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{cols.visitor}</th>
              <th>{cols.email}</th>
              <th>{cols.source}</th>
              <th className={styles.num}>{cols.lastSeen}</th>
              <th className={styles.num}>{cols.views}</th>
              <th className={styles.num}>{cols.sessions}</th>
              <th className={styles.num}>{cols.pages}</th>
              <th className={styles.num}>{cols.time}</th>
              <th className={styles.num}>{cols.clicks}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.visitor_id} className={styles.rowButton} onClick={() => setSelected(row.visitor_id)}>
                <td className="mono">{row.visitor_id.slice(0, 8)}</td>
                <td className={styles.clip}>{row.email ?? '—'}</td>
                <td className={styles.clip}>{row.first_source ?? '—'}</td>
                <td className={styles.num}>{row.last_seen ? new Date(row.last_seen).toLocaleString(lang) : '—'}</td>
                <td className={styles.num}>{row.views}</td>
                <td className={styles.num}>{row.sessions}</td>
                <td className={styles.num}>{row.pages}</td>
                <td className={styles.num}>{formatDuration(row.active_ms)}</td>
                <td className={styles.num}>{row.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
