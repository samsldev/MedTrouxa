import { FormEvent, useEffect, useState } from 'react';
import { api, downloadFile, formatTaxId } from '../api/client';
import { Icon } from './Brand';

/** Port de faelith_web/apps/web/src/pages/app/FiscalNotes.tsx (textos pt-BR). */
interface Note {
  id: string; status: string; number: string | null; amount_brl_cents: number | null; paid_at: string; issued_at: string | null;
}
interface MyNotes { notes: Note[]; identity: { doc_type: string; doc_number: string } | null }

const STATUS: Record<string, [string, string]> = {
  queued: ['Em processamento', 'wait'], pending_data: ['Aguardando seu CPF / CNPJ', 'warn'], issued: ['Emitida', 'ok'],
  rejected: ['Em análise', 'warn'], cancel_queued: ['Cancelando', 'wait'], canceled: ['Cancelada', 'muted'],
  cancel_failed: ['Em análise', 'warn'], needs_review: ['Em análise', 'warn'],
};

/** Lista de NFS-e e formulário de CPF / CNPJ. */
export default function FiscalNotes() {
  const [data, setData] = useState<MyNotes | null>(null);
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cpf');
  const [docNumber, setDocNumber] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = () => api<MyNotes>('/billing/nfse').then(setData).catch(() => setData({ notes: [], identity: null }));
  useEffect(() => { reload(); }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setPending(true); setError(null); setNotice(null);
    try {
      await api('/billing/fiscal-identity', { method: 'PUT', body: { doc_type: docType, doc_number: docNumber } });
      setNotice('Salvo. As notas pendentes serão emitidas em instantes.');
      setDocNumber('');
      reload();
    } catch (err) { setError((err as Error).message || 'Não foi possível salvar'); } finally { setPending(false); }
  }

  const get = (note: Note, kind: 'pdf' | 'xml') =>
    downloadFile(`/billing/nfse/${note.id}/${kind}`, `nfse-${note.number ?? ''}.${kind}`).catch((err) => setError((err as Error).message));

  return (
    <section className="card fiscal">
      <div className="fiscal-head">
        <span className="feature-icon"><Icon name="questions" size={19} /></span>
        <div>
          <h3>Notas fiscais (NFS-e)</h3>
          <p className="muted">Emitimos uma NFS-e automaticamente a cada pagamento e enviamos o PDF e o XML para o seu e-mail. Para clientes no Brasil é preciso ter CPF ou CNPJ cadastrado.</p>
        </div>
      </div>

      <form onSubmit={onSave} className="fiscal-form">
        <div>
          <b>Dados fiscais</b>
          <p className="muted small">Pessoa física: CPF. Empresa: CNPJ.{data?.identity ? ` Cadastrado: ${data.identity.doc_type.toUpperCase()} ${data.identity.doc_number}` : ''}</p>
        </div>
        <div className="row wrap">
          <label className="narrow">Tipo
            <select value={docType} onChange={(e) => { setDocType(e.target.value as 'cpf' | 'cnpj'); setDocNumber(''); }}>
              <option value="cpf">CPF (pessoa física)</option>
              <option value="cnpj">CNPJ (empresa)</option>
            </select>
          </label>
          <label>Número
            <input value={docNumber} inputMode="numeric" autoComplete="off" placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
              onChange={(e) => setDocNumber(formatTaxId(e.target.value, docType))} required />
          </label>
          <button type="submit" className="btn btn-dark" disabled={pending}>Salvar</button>
        </div>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <table className="table">
        <thead><tr><th>Data</th><th>Número</th><th>Valor (R$)</th><th>Situação</th><th>Arquivos</th></tr></thead>
        <tbody>
          {!data || data.notes.length === 0 ? (
            <tr><td colSpan={5} className="muted">Nenhuma nota ainda.</td></tr>
          ) : data.notes.map((note) => {
            const [label, tone] = STATUS[note.status] ?? [note.status, 'muted'];
            return (
              <tr key={note.id}>
                <td>{new Date(note.issued_at ?? note.paid_at).toLocaleDateString('pt-BR')}</td>
                <td className="mono">{note.number ?? '—'}</td>
                <td>{note.amount_brl_cents !== null ? (note.amount_brl_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                <td><span className={`status-pill ${tone}`}>{label}</span></td>
                <td>
                  {note.status === 'issued' || note.status === 'canceled' ? (
                    <span className="file-links">
                      <button type="button" className="link" onClick={() => get(note, 'pdf')}>PDF</button> ·{' '}
                      <button type="button" className="link" onClick={() => get(note, 'xml')}>XML</button>
                    </span>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
