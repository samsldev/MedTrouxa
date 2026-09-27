/**
 * @fileoverview Admin NFS-e tab: emitter and certificate status, documents by status, downloads, retry and cancel.
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
 * - Status filter over every document; errors from the national system are shown per row
 * - Retry requeues rejected / pending / failed documents; cancel needs a reason (15+ characters)
 * - Both actions pass the reauthentication dialog and are audited server side
 * - Warns when the A1 certificate expires within 30 days
 */

import { useState } from 'react';
import { adminNfseAction, fetchAdminNfse, type AdminNfseDoc } from '../../../lib/adminApi';
import { ApiError } from '../../../lib/api';
import { HTML_LANG, useLocale, useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { T } from './adminI18n';
import { useReport } from './useReport';

const STATUSES = ['', 'queued', 'pending_data', 'issued', 'rejected', 'cancel_queued', 'canceled', 'cancel_failed', 'needs_review', 'voided'];

/**
 * NFS-e documents and emitter status.
 */
export function NfseTab() {
  const t = useT(T);
  const n = t.nfse;
  const lang = HTML_LANG[useLocale().locale];
  const [filter, setFilter] = useState('');
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, loading } = useReport(() => fetchAdminNfse(filter), `${filter}|${tick}`, t.failed);

  /** Runs retry or cancel on one document. */
  async function act(doc: AdminNfseDoc, action: 'retry' | 'cancel') {
    setMessage(null);
    setError(null);
    let reason: string | undefined;
    if (action === 'cancel') {
      reason = window.prompt(n.cancelPrompt) ?? undefined;
      if (!reason) return;
    }
    try {
      await adminNfseAction(doc.id, action, reason);
      setMessage(n.done);
      setTick((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.failed);
    }
  }

  if (loadError) return <p className="notice notice-error">{loadError}</p>;
  if (!data) return <p className={styles.note}>{loading ? t.loading : t.empty}</p>;
  const emitter = data.emitter;
  const expires = emitter?.certificate_expires_at ? new Date(emitter.certificate_expires_at) : null;
  const expiringSoon = expires !== null && expires.getTime() - Date.now() < 30 * 86_400_000;
  return (
    <>
      <div className="card">
        {emitter ? (
          <dl className={styles.facts}>
            <dt>{n.environment}</dt>
            <dd>{emitter.environment}</dd>
            <dt>CNPJ</dt>
            <dd className="mono">{emitter.cnpj}</dd>
            <dt>{n.codes}</dt>
            <dd className="mono">
              cTribNac {emitter.trib_nac} · NBS {emitter.nbs} · {n.series} {emitter.series}
            </dd>
            <dt>{n.certificate}</dt>
            <dd>
              {emitter.certificate_subject}
              {expires ? ` · ${n.expires} ${expires.toLocaleDateString(lang)}` : ''}
            </dd>
          </dl>
        ) : (
          <p className={styles.note}>{n.disabled}</p>
        )}
      </div>
      {expiringSoon ? <p className="notice notice-error">{n.expiring}</p> : null}
      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
      <div className={styles.toolbar}>
        <label className="field">
          <span>{n.status}</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === '' ? n.all : value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {n.cols.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc) => (
              <tr key={doc.id}>
                <td className={styles.num}>{new Date(doc.paid_at).toLocaleString(lang)}</td>
                <td className="mono">{doc.status}</td>
                <td className="mono">{doc.number ?? '—'}</td>
                <td className={styles.clip} title={doc.buyer_name ?? ''}>
                  {doc.buyer_name ?? '—'} ({doc.buyer_country ?? '?'})
                </td>
                <td className={styles.num}>
                  {doc.amount_brl_cents !== null ? `R$ ${(doc.amount_brl_cents / 100).toFixed(2)}` : '—'} / US$ {(doc.amount_usd_cents / 100).toFixed(2)}
                </td>
                <td className={styles.detail}>{doc.last_error ?? ''}</td>
                <td>
                  {doc.access_key ? (
                    <>
                      <a href={`/api/admin/nfse/${doc.id}/pdf`}>PDF</a> · <a href={`/api/admin/nfse/${doc.id}/xml`}>XML</a>{' '}
                    </>
                  ) : null}
                  {['rejected', 'pending_data', 'cancel_failed'].includes(doc.status) ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void act(doc, 'retry')}>
                      {n.retry}
                    </button>
                  ) : null}
                  {['issued', 'needs_review', 'cancel_failed'].includes(doc.status) && doc.access_key ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void act(doc, 'cancel')}>
                      {n.cancel}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
