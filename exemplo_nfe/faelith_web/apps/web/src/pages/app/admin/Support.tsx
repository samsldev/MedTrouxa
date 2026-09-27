/**
 * @fileoverview Admin Support tab: find an organization and run support actions on it.
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
 * - Search by account email, organization id, or 8-character key prefix
 * - Actions: create or revoke keys, set or clear the plan, adjust credits, grant a usage reset, suspend or lift
 * - Every action triggers the reauthentication dialog (server demands a fresh proof) and is audited
 * - A created key's plaintext is shown once, then discarded from memory on the next action or search
 */

import { useState, type FormEvent } from 'react';
import {
  adminAdjustCredits,
  adminCreateKey,
  adminGrantReset,
  adminRevokeKey,
  adminSetPlan,
  adminSetSuspended,
  fetchOrg,
  searchOrg,
  type OrgDetail,
} from '../../../lib/adminApi';
import { ApiError } from '../../../lib/api';
import { formatUsd } from '../../../lib/format';
import { HTML_LANG, useLocale, useT } from '../../../lib/i18n';
import { listPlans, planDisplayName } from '../../../lib/plans';
import styles from './Admin.module.css';
import { T } from './adminI18n';

/**
 * Details and actions for one organization.
 */
function OrgPanel({ org, onChanged }: { org: OrgDetail; onChanged: () => Promise<void> }) {
  const t = useT(T);
  const s = t.support;
  const lang = HTML_LANG[useLocale().locale];
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('code');
  const [rpm, setRpm] = useState('60');
  const [tpm, setTpm] = useState('1000000');
  const [plan, setPlan] = useState(org.subscription?.plan ?? 'starter');
  const [usageBased, setUsageBased] = useState(org.subscription?.usage_based ?? false);
  const [usd, setUsd] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  /** Runs one action, then refreshes the organization; errors are shown inline. */
  async function run(action: () => Promise<unknown>, keepSecret = false) {
    setPending(true);
    setError(null);
    setMessage(null);
    if (!keepSecret) setPlaintext(null);
    try {
      await action();
      setMessage(s.done);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  /** Wraps a form submit handler. */
  const submit = (action: () => Promise<unknown>, keepSecret = false) => (event: FormEvent) => {
    event.preventDefault();
    void run(action, keepSecret);
  };

  const sub = org.subscription;
  return (
    <>
      <div className="card">
        <dl className={styles.facts}>
          <dt>{s.account}</dt>
          <dd>{org.account ? `${org.account.email} (${org.account.name})` : s.noAccount}</dd>
          <dt>{s.org}</dt>
          <dd className="mono">{org.org_id}</dd>
          <dt>{s.plan}</dt>
          <dd>
            {sub?.plan ? planDisplayName(sub.plan as Parameters<typeof planDisplayName>[0]) : s.none}
            {sub?.usage_based ? ` · ${s.usageBased}` : ''}
          </dd>
          <dt>{s.status}</dt>
          <dd>{org.suspended ? s.suspended : (sub?.status ?? s.none)}</dd>
          <dt>{s.credits}</dt>
          <dd>{formatUsd(org.credits_usd)}</dd>
          {org.refund.available && org.refund.closes_at ? (
            <>
              <dt />
              <dd>{s.refundOpen(new Date(org.refund.closes_at).toLocaleString(lang))}</dd>
            </>
          ) : null}
          {org.intro ? (
            <>
              <dt>{s.intro}</dt>
              <dd>{new Date(org.intro.until).toLocaleDateString(lang)}</dd>
            </>
          ) : null}
          {org.retention ? (
            <>
              <dt>{s.retention}</dt>
              <dd>
                {new Date(org.retention.starts_at).toLocaleDateString(lang)} – {new Date(org.retention.ends_at).toLocaleDateString(lang)}
              </dd>
            </>
          ) : null}
        </dl>
      </div>
      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
      {plaintext ? (
        <>
          <p className={styles.note}>{s.plaintextOnce}</p>
          <div className={styles.secret}>{plaintext}</div>
        </>
      ) : null}

      <h2 className={styles.section}>{s.keys}</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {org.keys.map((key) => (
              <tr key={key.prefix}>
                <td className="mono">{key.prefix}</td>
                <td>{key.purpose}</td>
                <td className={styles.num}>{key.rpm} rpm</td>
                <td className={styles.num}>{key.tpm} tpm</td>
                <td>
                  {key.revoked ? (
                    <span className="muted">{s.revoked}</span>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => void run(() => adminRevokeKey(key.prefix))}>
                      {s.revoke}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.actionGrid}>
        <form
          className="card"
          onSubmit={submit(async () => {
            const created = await adminCreateKey(org.org_id, purpose, Number(rpm), Number(tpm));
            setPlaintext(created.plaintext);
          }, true)}
        >
          <h3>{s.createKey}</h3>
          <div className={styles.inline}>
            <label className="field">
              <span>{s.purpose}</span>
              <select value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                <option value="code">code</option>
                <option value="chat">chat</option>
                <option value="api">api</option>
              </select>
            </label>
            <label className="field">
              <span>{s.rpm}</span>
              <input type="number" min={1} max={100000} value={rpm} onChange={(event) => setRpm(event.target.value)} />
            </label>
            <label className="field">
              <span>{s.tpm}</span>
              <input type="number" min={1000} max={100000000} value={tpm} onChange={(event) => setTpm(event.target.value)} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending} style={{ marginTop: 12 }}>
            {s.createKey}
          </button>
        </form>

        <form className="card" onSubmit={submit(() => adminSetPlan(org.org_id, plan, usageBased))}>
          <h3>{s.setPlan}</h3>
          <label className="field">
            <span>{s.plan}</span>
            <select value={plan} onChange={(event) => setPlan(event.target.value)}>
              {listPlans().map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {planDisplayName(entry.id)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.layers}>
            <input type="checkbox" checked={usageBased} onChange={(event) => setUsageBased(event.target.checked)} />
            {s.usageBased}
          </label>
          <p className={styles.note}>{s.stripeNote}</p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {s.save}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => void run(() => adminSetPlan(org.org_id, null, false))}>
              {s.clearPlan}
            </button>
          </div>
        </form>

        <form className="card" onSubmit={submit(() => adminAdjustCredits(org.org_id, Number(usd)))}>
          <h3>{s.adjustCredits}</h3>
          <label className="field">
            <span>{s.usd}</span>
            <input type="number" step="0.01" value={usd} onChange={(event) => setUsd(event.target.value)} required />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !Number(usd)}>
            {s.apply}
          </button>
        </form>

        <form className="card" onSubmit={submit(() => adminGrantReset(org.org_id, resetReason))}>
          <h3>{s.reset}</h3>
          <label className="field">
            <span>{s.reason}</span>
            <input value={resetReason} maxLength={200} onChange={(event) => setResetReason(event.target.value)} required />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {s.grant}
          </button>
        </form>

        <form className="card" onSubmit={submit(() => adminSetSuspended(org.org_id, !org.suspended, suspendReason))}>
          <h3>{org.suspended ? s.unsuspend : s.suspend}</h3>
          {org.suspended ? null : (
            <label className="field">
              <span>{s.reason}</span>
              <input value={suspendReason} maxLength={200} onChange={(event) => setSuspendReason(event.target.value)} required />
            </label>
          )}
          <button type="submit" className={org.suspended ? 'btn btn-primary btn-sm' : 'btn btn-danger btn-sm'} disabled={pending}>
            {org.suspended ? s.unsuspend : s.suspend}
          </button>
        </form>
      </div>
    </>
  );
}

/**
 * Support tab: search box and the selected organization.
 */
export function SupportTab() {
  const t = useT(T);
  const [query, setQuery] = useState('');
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  /** Resolves the query to an organization and loads it. */
  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    setOrg(null);
    try {
      const [first] = await searchOrg(query.trim());
      if (first) setOrg(await fetchOrg(first.org_id));
      else setError(t.support.noResult);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <form className={styles.toolbar} onSubmit={onSearch}>
        <label className="field" style={{ flex: '1 1 360px' }}>
          <span>{t.support.search}</span>
          <input value={query} placeholder={t.support.placeholder} onChange={(event) => setQuery(event.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={searching}>
          {t.support.search}
        </button>
      </form>
      {error ? <p className="notice notice-error">{error}</p> : null}
      {org ? <OrgPanel key={org.org_id} org={org} onChanged={async () => setOrg(await fetchOrg(org.org_id))} /> : null}
    </>
  );
}
