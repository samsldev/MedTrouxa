/**
 * @fileoverview Admin console page (/app/admin): access gate, tabs, and the shared report period.
 * @author Samuel S. L.
 * @version 1.3.0
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
 * - The gate asks GET /api/admin/me; non-admins see the server message (the route is hidden server side)
 * - Tab, heatmap path, and device live in the URL so a report can be shared with another admin
 * - Period presets (7d, 15d, 1 month, 3 months, 1 year) and segment filters are shared across report tabs
 * - Tabs: Marketing, Subscriptions (live Stripe), NFS-e, Heatmaps, Visitors, Support (org actions), Audit log
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAdminMe, type Range, type Segment } from '../../../lib/adminApi';
import { ApiError } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { AuditTab } from './Audit';
import { ALL_SEGMENTS, lastDays, RangePicker, SegmentBar } from './Filters';
import { HeatmapTab } from './Heatmap';
import { T } from './adminI18n';
import { MarketingTab } from './Marketing';
import { NfseTab } from './Nfse';
import { SubscriptionsTab } from './Subscriptions';
import { SupportTab } from './Support';
import { VisitorsTab } from './Visitors';

type Tab = 'marketing' | 'subscriptions' | 'nfse' | 'heatmap' | 'visitors' | 'support' | 'audit';
const TABS: Tab[] = ['marketing', 'subscriptions', 'nfse', 'heatmap', 'visitors', 'support', 'audit'];
/**
 * Admin console root.
 */
export function AdminPage() {
  const t = useT(T);
  const [params, setParams] = useSearchParams();
  const [gate, setGate] = useState<'loading' | 'ok' | string>('loading');
  const [range, setRange] = useState<Range>(() => lastDays(7));
  const [segment, setSegment] = useState<Segment>(ALL_SEGMENTS);
  const raw = params.get('tab');
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : 'marketing';

  useEffect(() => {
    fetchAdminMe()
      .then(() => setGate('ok'))
      .catch((caught: unknown) => setGate(caught instanceof ApiError ? caught.message : t.failed));
  }, []);

  /** Switches tab, keeping only the params that tab uses. */
  function select(next: Tab, extra: Record<string, string> = {}) {
    setParams({ tab: next, ...extra });
  }

  if (gate !== 'ok') {
    return (
      <div className={styles.wrap}>
        <p className="kicker">{t.kicker}</p>
        {gate === 'loading' ? <p className={styles.note}>{t.loading}</p> : <p className="notice notice-error">{gate}</p>}
      </div>
    );
  }

  const usesRange = tab !== 'support' && tab !== 'audit' && tab !== 'nfse';
  const usesSegment = tab === 'marketing' || tab === 'heatmap' || tab === 'visitors';
  return (
    <div className={styles.wrap}>
      <div>
        <p className="kicker">{t.kicker}</p>
        <h1 className={styles.title}>{t.title}</h1>
      </div>
      <nav className={styles.tabs} aria-label={t.title}>
        {TABS.map((name) => (
          <button key={name} type="button" className={name === tab ? styles.tabActive : styles.tab} onClick={() => select(name)}>
            {t.tabs[name]}
          </button>
        ))}
      </nav>
      {usesRange ? <RangePicker value={range} onChange={setRange} /> : null}
      {usesSegment ? <SegmentBar value={segment} onChange={setSegment} showDevice={tab !== 'heatmap'} /> : null}
      {tab === 'marketing' ? (
        <MarketingTab range={range} segment={segment} onSegment={setSegment} onOpenHeatmap={(path) => select('heatmap', { path })} />
      ) : null}
      {tab === 'heatmap' ? (
        <HeatmapTab
          range={range}
          segment={segment}
          path={params.get('path') ?? ''}
          device={params.get('device') ?? 'desktop'}
          onChange={(path, device) => select('heatmap', { path, device })}
        />
      ) : null}
      {tab === 'subscriptions' ? <SubscriptionsTab range={range} /> : null}
      {tab === 'nfse' ? <NfseTab /> : null}
      {tab === 'visitors' ? <VisitorsTab range={range} segment={segment} /> : null}
      {tab === 'support' ? <SupportTab /> : null}
      {tab === 'audit' ? <AuditTab /> : null}
    </div>
  );
}
