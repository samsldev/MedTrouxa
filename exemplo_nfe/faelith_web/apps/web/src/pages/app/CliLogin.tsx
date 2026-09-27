/**
 * @fileoverview Website page that authorizes a waiting Faelith CLI, Cursor-style.
 * @author Samuel S. L.
 * @version 1.3.0
 * @since 2026-09-07
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 *
 * DETAILED_DESCRIPTION:
 * - Requires the user to type the code shown in the terminal (no one-click approve)
 * - Approves a device grant; the Code/CLI key is minted when the CLI polls
 * - Shows the IP, client, and time that started the request before approval (RFC 8628 5.4)
 * - Approval may ask the user to confirm it is them (shared reauth dialog)
 */

import { useEffect, useMemo, useState } from 'react';
import { ApiError, approveCliDevice, fetchCliDevice } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import type { CliDeviceRequester } from '../../lib/types';

/** Canonical XXXX-XXXX form, or null while the typed code is incomplete. */
function completeCode(raw: string): string | null {
  const compact = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : null;
}
import styles from './Dashboard.module.css';
import { HTML_LANG, useLocale, type Dict } from '../../lib/i18n';

interface CliLoginStrings {
  thisAccount: string;
  unknownCode: string;
  authorizeFailed: string;
  title: string;
  intro: [string, string];
  codeLabel: string;
  requested: (ip: string) => string;
  unknown: string;
  at: (when: string) => string;
  by: (agent: string) => string;
  notYou: string;
  authorizing: string;
  authorize: string;
  done: string;
}

const T: Dict<CliLoginStrings> = {
  en: {
    thisAccount: 'this account',
    unknownCode: 'Unknown or expired code',
    authorizeFailed: 'Could not authorize the CLI',
    title: 'Authorize this CLI',
    intro: ['Type the code shown in Faelith Code on this machine. Approving connects', 'and issues a Code/CLI key. Do not type a code from a chat message or another website.'],
    codeLabel: 'Code from your terminal',
    requested: (ip) => `Requested from IP ${ip}`,
    unknown: 'unknown',
    at: (when) => ` at ${when}`,
    by: (agent) => ` by ${agent}`,
    notYou: '. If this was not you, close this page.',
    authorizing: 'Authorizing…',
    authorize: 'Authorize CLI',
    done: 'This CLI is connected. You can close this tab and return to the terminal.',
  },
  br: {
    thisAccount: 'esta conta',
    unknownCode: 'Código desconhecido ou expirado',
    authorizeFailed: 'Não foi possível autorizar a CLI',
    title: 'Autorizar esta CLI',
    intro: ['Digite o código mostrado no Faelith Code nesta máquina. Aprovar conecta', 'e emite uma chave Code/CLI. Não digite um código recebido por mensagem de chat ou vindo de outro site.'],
    codeLabel: 'Código do seu terminal',
    requested: (ip) => `Solicitado pelo IP ${ip}`,
    unknown: 'desconhecido',
    at: (when) => ` em ${when}`,
    by: (agent) => ` por ${agent}`,
    notYou: '. Se não foi você, feche esta página.',
    authorizing: 'Autorizando…',
    authorize: 'Autorizar CLI',
    done: 'Esta CLI está conectada. Você pode fechar esta aba e voltar ao terminal.',
  },
  pt: {
    thisAccount: 'esta conta',
    unknownCode: 'Código desconhecido ou expirado',
    authorizeFailed: 'Não foi possível autorizar a CLI',
    title: 'Autorizar esta CLI',
    intro: ['Introduza o código mostrado no Faelith Code nesta máquina. Aprovar liga', 'e emite uma chave Code/CLI. Não introduza um código recebido numa mensagem de chat ou vindo de outro site.'],
    codeLabel: 'Código do seu terminal',
    requested: (ip) => `Pedido a partir do IP ${ip}`,
    unknown: 'desconhecido',
    at: (when) => ` às ${when}`,
    by: (agent) => ` por ${agent}`,
    notYou: '. Se não foi você, feche esta página.',
    authorizing: 'A autorizar…',
    authorize: 'Autorizar CLI',
    done: 'Esta CLI está ligada. Pode fechar este separador e voltar ao terminal.',
  },
};

/**
 * Confirms that this browser session should connect the waiting CLI.
 */
export function CliLoginPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const t = T[locale];
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'ready' | 'done'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requester, setRequester] = useState<CliDeviceRequester | null>(null);
  const code = completeCode(typed);
  const account = useMemo(
    () => user?.email || user?.name || t.thisAccount,
    [user?.email, user?.name, t],
  );

  // Looks up who started the request once the code is complete, so the user
  // can recognise (or reject) the machine before approving.
  useEffect(() => {
    setRequester(null);
    setError(null);
    if (!code) return;
    let live = true;
    fetchCliDevice(code)
      .then((device) => {
        if (live) setRequester(device.requester);
      })
      .catch((caught: unknown) => {
        if (live) setError(caught instanceof ApiError ? caught.message : t.unknownCode);
      });
    return () => {
      live = false;
    };
  }, [code]);

  /**
   * Mints access for the waiting CLI only when the typed code matches the grant.
   */
  async function onApprove() {
    setPending(true);
    setError(null);
    try {
      await approveCliDevice(typed);
      setStatus('done');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.authorizeFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <p className="kicker">Faelith Code</p>
      <h1>{t.title}</h1>
      {status === 'ready' ? (
        <article className="card" style={{ maxWidth: 480 }}>
          <p className={styles.statSub}>
            {t.intro[0]} <strong>{account}</strong> {t.intro[1]}
          </p>
          <label className={styles.statSub} htmlFor="cli-user-code">
            {t.codeLabel}
          </label>
          <input
            id="cli-user-code"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder="XXXX-XXXX"
            value={typed}
            onChange={(event) => setTyped(event.target.value.toUpperCase())}
            style={{ letterSpacing: '0.12em', fontFamily: 'ui-monospace, monospace' }}
          />
          {requester ? (
            <p className="notice">
              <strong>{t.requested(requester.ip ?? t.unknown)}</strong>
              {requester.createdAt ? t.at(new Date(requester.createdAt).toLocaleString(HTML_LANG[locale])) : ''}
              {requester.userAgent ? t.by(requester.userAgent) : ''}
              {t.notYou}
            </p>
          ) : null}
          {error ? <p className="notice notice-error">{error}</p> : null}
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending || !code || !requester}
            onClick={() => void onApprove()}
          >
            {pending ? t.authorizing : t.authorize}
          </button>
        </article>
      ) : null}
      {status === 'done' ? (
        <article className="card" style={{ maxWidth: 480 }}>
          <p className={styles.statSub}>
            {t.done}
          </p>
        </article>
      ) : null}
    </div>
  );
}
