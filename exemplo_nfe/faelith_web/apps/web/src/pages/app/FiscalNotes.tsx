/**
 * @fileoverview Billing page section: the organization's NFS-e (Brazilian service invoices) and its CPF / CNPJ.
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
 * - Lists notes with status, number, BRL value, and XML / PDF downloads (same-origin endpoints)
 * - Buyers in Brazil set their CPF (or company CNPJ) here when it was not given at checkout;
 *   saving it resumes the notes waiting for it
 * - Localized (en, pt-BR, pt-PT)
 */

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, fetchMyNotes, saveFiscalIdentity, type MyNotes } from '../../lib/api';
import { HTML_LANG, useLocale, useT, type Dict } from '../../lib/i18n';

interface NotesStrings {
  title: string;
  help: string;
  empty: string;
  cols: [string, string, string, string, string];
  status: Record<string, string>;
  identity: string;
  identityHelp: string;
  current: (doc: string) => string;
  cpf: string;
  cnpj: string;
  number: string;
  save: string;
  saved: string;
  failed: string;
}

const T: Dict<NotesStrings> = {
  en: {
    title: 'Brazilian service invoices (NFS-e)',
    help: 'An NFS-e is issued automatically for every payment. Buyers in Brazil need a CPF or CNPJ on file.',
    empty: 'No notes yet.',
    cols: ['Date', 'Number', 'Value (BRL)', 'Status', 'Files'],
    status: { queued: 'Processing', pending_data: 'Waiting for your CPF / CNPJ', issued: 'Issued', rejected: 'Under review', cancel_queued: 'Canceling', canceled: 'Canceled', cancel_failed: 'Under review', needs_review: 'Under review' },
    identity: 'Tax identification',
    identityHelp: 'Individuals in Brazil: CPF. Companies: CNPJ.',
    current: (doc) => `On file: ${doc}`,
    cpf: 'CPF (individual)',
    cnpj: 'CNPJ (company)',
    number: 'Number',
    save: 'Save',
    saved: 'Saved. Pending notes will be issued shortly.',
    failed: 'Unable to save',
  },
  br: {
    title: 'Notas fiscais (NFS-e)',
    help: 'Emitimos uma NFS-e automaticamente a cada pagamento. Para clientes no Brasil é preciso ter CPF ou CNPJ cadastrado.',
    empty: 'Nenhuma nota ainda.',
    cols: ['Data', 'Número', 'Valor (R$)', 'Situação', 'Arquivos'],
    status: { queued: 'Em processamento', pending_data: 'Aguardando seu CPF / CNPJ', issued: 'Emitida', rejected: 'Em análise', cancel_queued: 'Cancelando', canceled: 'Cancelada', cancel_failed: 'Em análise', needs_review: 'Em análise' },
    identity: 'Dados fiscais',
    identityHelp: 'Pessoa física no Brasil: CPF. Empresa: CNPJ.',
    current: (doc) => `Cadastrado: ${doc}`,
    cpf: 'CPF (pessoa física)',
    cnpj: 'CNPJ (empresa)',
    number: 'Número',
    save: 'Salvar',
    saved: 'Salvo. As notas pendentes serão emitidas em instantes.',
    failed: 'Não foi possível salvar',
  },
  pt: {
    title: 'Faturas fiscais brasileiras (NFS-e)',
    help: 'Emitimos uma NFS-e automaticamente em cada pagamento. Clientes no Brasil precisam de CPF ou CNPJ registado.',
    empty: 'Ainda não há notas.',
    cols: ['Data', 'Número', 'Valor (R$)', 'Estado', 'Ficheiros'],
    status: { queued: 'Em processamento', pending_data: 'A aguardar CPF / CNPJ', issued: 'Emitida', rejected: 'Em análise', cancel_queued: 'A cancelar', canceled: 'Cancelada', cancel_failed: 'Em análise', needs_review: 'Em análise' },
    identity: 'Dados fiscais (Brasil)',
    identityHelp: 'Particular no Brasil: CPF. Empresa: CNPJ.',
    current: (doc) => `Registado: ${doc}`,
    cpf: 'CPF (particular)',
    cnpj: 'CNPJ (empresa)',
    number: 'Número',
    save: 'Guardar',
    saved: 'Guardado. As notas pendentes serão emitidas em breve.',
    failed: 'Não foi possível guardar',
  },
};

/**
 * NFS-e list and CPF / CNPJ form.
 */
export function FiscalNotes() {
  const t = useT(T);
  const lang = HTML_LANG[useLocale().locale];
  const [data, setData] = useState<MyNotes | null>(null);
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cpf');
  const [docNumber, setDocNumber] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Loads notes and the masked identity. */
  function reload() {
    fetchMyNotes()
      .then(setData)
      .catch(() => setData({ notes: [], identity: null }));
  }

  useEffect(reload, []);

  /** Saves the CPF / CNPJ and refreshes the list. */
  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await saveFiscalIdentity(docType, docNumber);
      setNotice(t.saved);
      setDocNumber('');
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="card">
      <h3>{t.title}</h3>
      <p className="muted">{t.help}</p>
      <form onSubmit={onSave} style={{ margin: '12px 0 20px' }}>
        <h4>{t.identity}</h4>
        <p className="muted">
          {t.identityHelp}
          {data?.identity ? ` ${t.current(`${data.identity.doc_type.toUpperCase()} ${data.identity.doc_number}`)}` : ''}
        </p>
        <div className="btn-row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>{t.identity}</span>
            <select value={docType} onChange={(event) => setDocType(event.target.value as 'cpf' | 'cnpj')}>
              <option value="cpf">{t.cpf}</option>
              <option value="cnpj">{t.cnpj}</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>{t.number}</span>
            <input value={docNumber} inputMode="numeric" onChange={(event) => setDocNumber(event.target.value)} required />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
            {t.save}
          </button>
        </div>
        {notice ? <p className="notice notice-success">{notice}</p> : null}
        {error ? <p className="notice notice-error">{error}</p> : null}
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {t.cols.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data || data.notes.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t.empty}
                </td>
              </tr>
            ) : (
              data.notes.map((note) => (
                <tr key={note.id}>
                  <td>{new Date(note.issued_at ?? note.paid_at).toLocaleDateString(lang)}</td>
                  <td className="mono">{note.number ?? '—'}</td>
                  <td className="num">
                    {note.amount_brl_cents !== null
                      ? new Intl.NumberFormat(lang, { style: 'currency', currency: 'BRL' }).format(note.amount_brl_cents / 100)
                      : '—'}
                  </td>
                  <td>{t.status[note.status] ?? note.status}</td>
                  <td className="num">
                    {note.status === 'issued' || note.status === 'canceled' ? (
                      <>
                        <a href={`/api/billing/nfse/${note.id}/pdf`}>PDF</a>
                        {' · '}
                        <a href={`/api/billing/nfse/${note.id}/xml`}>XML</a>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
