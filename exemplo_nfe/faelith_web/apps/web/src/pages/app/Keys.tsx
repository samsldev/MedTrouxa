/**
 * @fileoverview API key inventory, issuance, and revocation.
 * @author Samuel S. L.
 * @version 1.5.0
 * @since 2026-09-06
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
 * - Lists prefix and purpose
 * - Creates keys for purpose code|chat|api
 * - Shows plaintext once, supports revoke, and marks SSH as coming soon
 * - Localized (en, pt-BR, pt-PT) through `useT` string tables
 */

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, createKey, fetchKeys, revokeKey } from '../../lib/api';
import { useT, type Dict } from '../../lib/i18n';
import type { ApiKeyRecord, KeyPurpose } from '../../lib/types';
import styles from './Dashboard.module.css';

const PURPOSE_LABELS: Record<KeyPurpose, string> = { code: 'Code / CLI', chat: 'Chat', api: 'API' };

interface KeysStrings {
  loadFailed: string;
  createFailed: string;
  revokeFailed: string;
  kicker: string;
  title: string;
  copyNow: string;
  createKey: string;
  purpose: string;
  create: string;
  prefix: string;
  noKeys: string;
  revoke: string;
  comingSoon: string;
}

const T: Dict<KeysStrings> = {
  en: {
    loadFailed: 'Unable to load keys',
    createFailed: 'Unable to create key',
    revokeFailed: 'Unable to revoke key',
    kicker: 'API Keys',
    title: 'Keys',
    copyNow: 'Copy this secret now. It will not be shown again.',
    createKey: 'Create key',
    purpose: 'Purpose',
    create: 'Create',
    prefix: 'Prefix',
    noKeys: 'No keys yet.',
    revoke: 'Revoke',
    comingSoon: 'Coming soon',
  },
  br: {
    loadFailed: 'Não foi possível carregar as chaves',
    createFailed: 'Não foi possível criar a chave',
    revokeFailed: 'Não foi possível revogar a chave',
    kicker: 'Chaves de API',
    title: 'Chaves',
    copyNow: 'Copie este segredo agora. Ele não será mostrado de novo.',
    createKey: 'Criar chave',
    purpose: 'Finalidade',
    create: 'Criar',
    prefix: 'Prefixo',
    noKeys: 'Nenhuma chave ainda.',
    revoke: 'Revogar',
    comingSoon: 'Em breve',
  },
  pt: {
    loadFailed: 'Não foi possível carregar as chaves',
    createFailed: 'Não foi possível criar a chave',
    revokeFailed: 'Não foi possível revogar a chave',
    kicker: 'Chaves de API',
    title: 'Chaves',
    copyNow: 'Copie este segredo agora. Não voltará a ser mostrado.',
    createKey: 'Criar chave',
    purpose: 'Finalidade',
    create: 'Criar',
    prefix: 'Prefixo',
    noKeys: 'Ainda não há chaves.',
    revoke: 'Revogar',
    comingSoon: 'Brevemente',
  },
};

/**
 * Authenticated API keys page.
 */
export function KeysPage() {
  const t = useT(T);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [purpose, setPurpose] = useState<KeyPurpose>('code');
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reloads the key list from GET /api/keys.
   */
  async function reload() {
    const next = await fetchKeys();
    setKeys(next);
  }

  useEffect(() => {
    void reload().catch((caught: unknown) => {
      setError(caught instanceof ApiError ? caught.message : t.loadFailed);
    });
  }, []);

  /**
   * Issues a key and captures the one-time plaintext secret.
   */
  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await createKey(purpose);
      setSecret(created.secret);
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.createFailed);
    }
  }

  /**
   * Revokes a key by prefix.
   */
  async function onRevoke(prefix: string) {
    setError(null);
    try {
      await revokeKey(prefix);
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.revokeFailed);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className="kicker">{t.kicker}</p>
      <h1 className={styles.title}>{t.title}</h1>
      {error ? <p className="notice notice-error">{error}</p> : null}
      {secret ? (
        <p className={styles.secret}>
          <strong>{t.copyNow}</strong>
          {secret}
        </p>
      ) : null}
      <form className="card" onSubmit={(event) => void onCreate(event)}>
        <h3>{t.createKey}</h3>
        <label className="field">
          <span>{t.purpose}</span>
          <select
            value={purpose}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'code' || value === 'chat' || value === 'api') {
                setPurpose(value);
              }
            }}
          >
            <option value="code">code</option>
            <option value="chat">chat</option>
            <option value="api">api</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          {t.create}
        </button>
      </form>
      <div className="table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>{t.prefix}</th>
              <th>{t.purpose}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  {t.noKeys}
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.prefix}>
                  <td className="mono">{key.prefix}</td>
                  <td>{PURPOSE_LABELS[key.purpose]}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void onRevoke(key.prefix)}>
                      {t.revoke}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <article className="card coming-soon" style={{ marginTop: 24 }}>
        <h3>SSH</h3>
        <p>{t.comingSoon}</p>
      </article>
    </div>
  );
}
