/**
 * @fileoverview Admin Audit tab: the latest 200 admin actions, newest first.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Read-only view of GET /api/admin/audit (who, what, which organization, input detail)
 */

import { fetchAudit } from '../../../lib/adminApi';
import { HTML_LANG, useLocale, useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { T } from './adminI18n';
import { useReport } from './useReport';

/**
 * Audit log table.
 */
export function AuditTab() {
  const t = useT(T);
  const lang = HTML_LANG[useLocale().locale];
  const { data, error, loading } = useReport(fetchAudit, 'audit', t.failed);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className={styles.note}>{loading ? t.loading : t.empty}</p>;
  if (data.length === 0) return <p className={styles.note}>{t.empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t.audit.when}</th>
            <th>{t.audit.admin}</th>
            <th>{t.audit.action}</th>
            <th>{t.audit.org}</th>
            <th>{t.audit.detail}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={`${entry.at}-${index}`}>
              <td className={styles.num}>{new Date(entry.at).toLocaleString(lang)}</td>
              <td>{entry.admin_email}</td>
              <td className="mono">{entry.action}</td>
              <td className="mono">{entry.target_org?.slice(0, 8) ?? '—'}</td>
              <td className={styles.detail}>{JSON.stringify(entry.detail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
