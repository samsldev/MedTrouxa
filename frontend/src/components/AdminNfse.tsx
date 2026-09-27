import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api/client';

/** Port de faelith_web/apps/web/src/pages/app/admin/Nfse.tsx (textos pt-BR). */
interface Emitter { environment: string; cnpj: string; series: number; trib_nac: string; nbs: string; certificate_subject: string; certificate_expires_at: string | null }
interface Doc {
  id: string; status: string; number: string | null; access_key: string | null; amount_brl_cents: number | null; amount_usd_cents: number;
  buyer_name: string | null; buyer_country: string | null; last_error: string | null; paid_at: string;
}
interface Report { enabled: boolean; emitter: Emitter | null; documents: Doc[] }

const STATUSES = ['', 'queued', 'pending_data', 'issued', 'rejected', 'cancel_queued', 'canceled', 'cancel_failed', 'needs_review', 'voided'];

/** Documentos de NFS-e e status do emissor. */
export default function AdminNfse() {
  const [filter, setFilter] = useState('');
  const [data, setData] = useState<Report | null>(null);
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<{ doc: Doc; kind: 'retry' | 'cancel' } | null>(null);
  const [form, setForm] = useState({ reason: '', password: '', code: '' });

  useEffect(() => {
    api<Report>(`/admin/nfse${filter ? `?status=${filter}` : ''}`).then(setData).catch((e) => setError((e as Error).message));
  }, [filter, tick]);

  async function confirm() {
    if (!action) return;
    setMessage(null); setError(null);
    try {
      await api(`/admin/nfse/${action.doc.id}/${action.kind}`, { body: {
        password: form.password, reason: action.kind === 'cancel' ? form.reason : undefined,
        ...(form.code ? { method: form.code.includes('-') ? 'recovery' : 'totp', code: form.code } : {}),
      } });
      setMessage('Feito.');
      setAction(null); setForm({ reason: '', password: '', code: '' });
      setTimeout(() => setTick((t) => t + 1), 1200);
    } catch (e) { setError((e as Error).message); }
  }

  if (!data) return <p className="muted">{error ?? 'Carregando...'}</p>;
  const emitter = data.emitter;
  const expires = emitter?.certificate_expires_at ? new Date(emitter.certificate_expires_at) : null;
  const expiringSoon = expires !== null && expires.getTime() - Date.now() < 30 * 86_400_000;

  return (
    <div className="stack">
      <div className="card">
        {emitter ? (
          <dl className="facts">
            <dt>Ambiente</dt><dd><span className={`status-pill ${emitter.environment === 'producao' ? 'ok' : 'warn'}`}>{emitter.environment}</span></dd>
            <dt>CNPJ</dt><dd className="mono">{emitter.cnpj}</dd>
            <dt>Códigos</dt><dd className="mono">cTribNac {emitter.trib_nac} · NBS {emitter.nbs} · série {emitter.series}</dd>
            <dt>Certificado</dt><dd>{emitter.certificate_subject}{expires ? ` · vence em ${expires.toLocaleDateString('pt-BR')}` : ''}</dd>
          </dl>
        ) : <p className="muted">Emissor desligado (NFSE_ENABLED ≠ 1). Os pagamentos continuam sendo enfileirados e serão emitidos quando ele for ligado.</p>}
      </div>
      {expiringSoon && <p className="error">O certificado A1 vence em menos de 30 dias. Renove-o para não interromper a emissão.</p>}
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {action && (
        <div className="card stack reauth">
          <h3>{action.kind === 'cancel' ? `Cancelar a NFS-e nº ${action.doc.number}` : 'Reprocessar documento'}</h3>
          {action.kind === 'cancel' && (
            <label>Motivo do cancelamento (mín. 15 caracteres)<textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={255} /></label>
          )}
          <div className="row wrap">
            <label>Sua senha<input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>Código 2FA (se ativo)<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="000000" /></label>
          </div>
          <div className="row wrap">
            <button className={action.kind === 'cancel' ? 'btn btn-danger' : 'btn btn-dark'} onClick={confirm} disabled={!form.password}>Confirmar</button>
            <button className="btn btn-text" onClick={() => setAction(null)}>Voltar</button>
          </div>
        </div>
      )}

      <div className="row"><label className="narrow">Situação
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {STATUSES.map((v) => <option key={v} value={v}>{v === '' ? 'Todas' : v}</option>)}
        </select>
      </label></div>

      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>Pago em</th><th>Situação</th><th>Número</th><th>Tomador</th><th>Valor</th><th>Último erro</th><th>Ações</th></tr></thead>
          <tbody>
            {data.documents.length === 0 && <tr><td colSpan={7} className="muted">Nenhum documento.</td></tr>}
            {data.documents.map((doc) => (
              <tr key={doc.id}>
                <td>{new Date(doc.paid_at).toLocaleString('pt-BR')}</td>
                <td className="mono">{doc.status}</td>
                <td className="mono">{doc.number ?? '—'}</td>
                <td>{doc.buyer_name ?? '—'} ({doc.buyer_country ?? '?'})</td>
                <td>{doc.amount_brl_cents !== null ? `R$ ${(doc.amount_brl_cents / 100).toFixed(2)}` : '—'}{doc.amount_usd_cents ? ` / US$ ${(doc.amount_usd_cents / 100).toFixed(2)}` : ''}</td>
                <td className="clip" title={doc.last_error ?? ''}>{doc.last_error ?? ''}</td>
                <td className="actions">
                  {doc.access_key && <>
                    <button className="link" onClick={() => downloadFile(`/admin/nfse/${doc.id}/pdf`, 'nfse.pdf').catch((e) => setError(e.message))}>PDF</button>{' · '}
                    <button className="link" onClick={() => downloadFile(`/admin/nfse/${doc.id}/xml`, 'nfse.xml').catch((e) => setError(e.message))}>XML</button>{' '}
                  </>}
                  {['rejected', 'pending_data', 'cancel_failed'].includes(doc.status) && <button className="btn btn-text" onClick={() => setAction({ doc, kind: 'retry' })}>Reprocessar</button>}
                  {['issued', 'needs_review', 'cancel_failed'].includes(doc.status) && doc.access_key && <button className="btn btn-text danger" onClick={() => setAction({ doc, kind: 'cancel' })}>Cancelar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
