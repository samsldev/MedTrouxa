/**
 * @fileoverview Chat composer limit line: "5h limit: X% used · Weekly limit: Y% used" (Cursor-style).
 * @author Samuel S. L.
 * @version 1.1.0 (web copy of the desktop component; keep in sync)
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
 * - Reads the Chat meters (chat 5h / weekly) from GET /api/usage
 * - Refreshes on mount, after every finished reply and every 5 minutes
 * - Hidden when the usage API fails (signed out, no plan data)
 */

import { useChatT } from './chatI18n';
import { useEffect, useRef, useState } from 'react';
import { fetchUsage } from '../lib/api';
import type { MeterBar, UsageResponse } from '../lib/types';
import { Icon } from './Icons';

/** Background refresh cadence. */
const REFRESH_MS = 5 * 60_000;

/** Consumed share of a plan window, clamped to 0..100. */
function usedPercent(bar: MeterBar): number {
  if (bar.limit <= 0) return 0;
  return Math.min(100, Math.max(0, (bar.used / bar.limit) * 100));
}

/**
 * One muted line under the composer with both Chat plan windows.
 */
export function PlanLimits({ busy }: { busy: boolean }) {
  const t = useChatT();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const wasBusy = useRef(busy);

  useEffect(() => {
    let live = true;
    /** Fetches the meters; any failure hides the line instead of alerting. */
    const load = () => {
      fetchUsage()
        .then((next) => live && setUsage(next))
        .catch(() => live && setUsage(null));
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      fetchUsage()
        .then(setUsage)
        .catch(() => setUsage(null));
    }
    wasBusy.current = busy;
  }, [busy]);

  if (!usage) return null;
  const five = usage.chat5h;
  const weekly = usage.chatWeekly;
  const exhausted = five.exhausted || weekly.exhausted;

  return (
    <div className={`plan-limits ${exhausted ? 'exhausted' : ''}`}>
      <Icon name="gauge" size={12} />
      <span>
        {t.limits(Math.round(usedPercent(five)), Math.round(usedPercent(weekly)))}
      </span>
    </div>
  );
}
