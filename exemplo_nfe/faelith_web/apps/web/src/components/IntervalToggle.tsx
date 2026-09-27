/**
 * @fileoverview Monthly/yearly billing interval segmented toggle with a savings badge.
 * @author Samuel S. L.
 * @version 1.1.0
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
 * - Accessible radiogroup with two options: monthly and yearly
 * - Yearly option advertises the shared discount percentage
 * - Controlled component; parent owns the selected interval
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useT, type Dict } from '../lib/i18n';
import { yearlyDiscountPct } from '../lib/plans';
import type { BillingInterval } from '../lib/types';

interface IntervalToggleProps {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
}

const OPTIONS: BillingInterval[] = ['monthly', 'yearly'];

interface ToggleStrings {
  aria: string;
  labels: Record<BillingInterval, string>;
  save: (pct: number) => string;
}

const T: Dict<ToggleStrings> = {
  en: { aria: 'Billing interval', labels: { monthly: 'Monthly', yearly: 'Yearly' }, save: (pct) => `Save ${pct}%` },
  br: { aria: 'Período de cobrança', labels: { monthly: 'Mensal', yearly: 'Anual' }, save: (pct) => `Economize ${pct}%` },
  pt: { aria: 'Período de faturação', labels: { monthly: 'Mensal', yearly: 'Anual' }, save: (pct) => `Poupe ${pct}%` },
};

/**
 * Renders the segmented monthly/yearly control used on Pricing and Billing.
 */
export function IntervalToggle({ value, onChange }: IntervalToggleProps) {
  const t = useT(T);
  return (
    <div className="toggle" role="radiogroup" aria-label={t.aria}>
      {OPTIONS.map((interval) => (
        <button
          key={interval}
          type="button"
          role="radio"
          aria-checked={value === interval}
          className={`toggle-option ${value === interval ? 'toggle-active' : ''}`}
          onClick={() => onChange(interval)}
        >
          {t.labels[interval]}
          {interval === 'yearly' ? <span className="toggle-pill">{t.save(yearlyDiscountPct())}</span> : null}
        </button>
      ))}
    </div>
  );
}
