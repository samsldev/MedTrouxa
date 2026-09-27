import { FormEvent, useState } from 'react';
import { api } from '../../api/client';
import { brl, formatPct, get, Loading, Note, num, Section, Table, useReauth, useReport } from './common';

interface Hit { id: string; name: string; email: string; role: string; created_at: string; suspended: boolean }
interface Detail {
  account: { id: string; name: string; email: string; role: string; university: string | null; semester: number | null; created_at: string; xp: number };
  security: { email_verified: boolean; two_factor: string | null; recovery_codes: number; suspended_at: string | null; suspend_reason: string | null };
  plan: { tier?: string; plan?: string | null; expiresAt?: string | null; [k: string]: unknown };
  subscriptions: { id: string; plan: string; status: string; method: string; installments: number; amount_cents: number; paid_at: string | null; expires_at: string | null; canceled_at: string | null; granted_by: string | null; live: boolean; refund_window_until: string | null; attribution: string | null }[];
  usage: { answers: number; correct: number; exams: number; cards: number; last_activity: string | null; invoices: number; accuracy: number };
  fiscal: { doc_type: string; doc_number: string } | null;
}
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const PLANS = [['aprendiz', 'Aprendiz'], ['alquimista', 'Alquimista'], ['arcano', 'Arcano']];

/** Suporte — port de Support.tsx: busca de contas e ações com reautenticação e auditoria. */
export default function Support() {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');
  async function search(e: FormEvent) {
    e.preventDefault(); setErr('');
    try { setHits(await api<Hit[]>(`/admin/users/search?q=${encodeURIComponent(term.trim())}`)); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <>
      <form className="c-toolbar" onSubmit={search}>
        <label className="c-field grow">Buscar conta<input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e-mail, nome ou id" minLength={2} required /></label>
        <button className="btn btn-dark">Buscar</button>
      </form>
      {err && <p className="error">{err}</p>}
      {hits && (
        <Table head={['Nome', 'E-mail', 'Papel', 'Criada em', '']} empty="Nenhuma conta encontrada."
          rows={hits.map((h) => [h.name, h.email, h.role, day(h.created_at), <button className="c-link" onClick={() => setOpen(h.id)}>{h.suspended ? 'Suspensa · ' : ''}Abrir →</button>])} />
      )}
      {open && <Account key={open} id={open} />}
    </>
  );
}

function Account({ id }: { id: string }) {
  const r = useReport(() => get<Detail>(`/admin/users/${id}`), id);
  const [ask, dialog] = useReauth();
  const [msg, setMsg] = useState('');
  const [grant, setGrant] = useState({ planId: 'alquimista', months: '' });

  async function act(title: string, path: string, body: Record<string, unknown> = {}, reason = true) {
    const proof = await ask(title, { reason });
    if (!proof) return;
    setMsg('');
    try { await api(`/admin/users/${id}/${path}`, { body: { ...proof, ...body } }); setMsg(`${title}: feito.`); r.reload(); }
    catch (x) { setMsg((x as Error).message); }
  }

  const d = r.data;
  if (!d) return <Loading {...r} />;
  const s = d.security;
  return (
    <Section title={d.account.name}>
      {dialog}
      {msg && <div className="notice">{msg}</div>}
      <div className="c-grid3">
        <div className="card stack c-facts">
          <h3>Conta</h3>
          <p>{d.account.email}<br /><small>{d.account.role} · criada em {day(d.account.created_at)} · {num(d.account.xp)} XP</small></p>
          <p><small>{d.account.university ?? 'Faculdade não informada'}{d.account.semester ? ` · ${d.account.semester}º período` : ''}</small></p>
          <p><small>Dados fiscais: {d.fiscal ? `${d.fiscal.doc_type.toUpperCase()} ${d.fiscal.doc_number}` : '—'} · {num(d.usage.invoices)} NFS-e</small></p>
        </div>
        <div className="card stack c-facts">
          <h3>Segurança</h3>
          <p>E-mail: {s.email_verified ? 'confirmado' : <b className="neg">não confirmado</b>}</p>
          <p>2FA: {s.two_factor ?? 'desativado'} · {s.recovery_codes} códigos de recuperação</p>
          {s.suspended_at && <p className="neg">Suspensa em {day(s.suspended_at)}: {s.suspend_reason}</p>}
        </div>
        <div className="card stack c-facts">
          <h3>Uso</h3>
          <p>{num(d.usage.answers)} questões · {formatPct(d.usage.accuracy)} de acerto</p>
          <p>{num(d.usage.exams)} simulados · {num(d.usage.cards)} revisões de flashcards</p>
          <p><small>Última atividade: {day(d.usage.last_activity)}</small></p>
        </div>
      </div>

      <h3>Assinaturas</h3>
      <Table head={['Plano', 'Status', 'Pagamento', 'Valor', 'Pago em', 'Vence em', 'Arrependimento até', 'Origem', '']} empty="Sem assinaturas."
        rows={d.subscriptions.map((x) => [
          <b>{x.plan}</b>, x.live ? 'ativa' : x.status, x.granted_by ? `cortesia (${x.granted_by})` : x.method === 'pix' ? 'Pix' : `Cartão ${x.installments}x`,
          brl(x.amount_cents), day(x.paid_at), day(x.expires_at), day(x.refund_window_until), x.attribution ?? '—',
          x.status === 'active' ? <button className="c-link danger" onClick={() => act('Encerrar assinatura', 'revoke', { subscriptionId: x.id })}>Encerrar</button> : '',
        ])} />
      <Note>Encerrar não estorna no Mercado Pago; faça o estorno no painel do provedor.</Note>

      <h3>Ações</h3>
      <div className="c-actions">
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); act('Conceder plano de cortesia', 'grant', { planId: grant.planId, ...(grant.months ? { months: Number(grant.months) } : {}) }); }}>
          <label className="c-field">Plano<select value={grant.planId} onChange={(e) => setGrant({ ...grant, planId: e.target.value })}>{PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="c-field">Meses (vazio = plano completo)<input type="number" min={1} max={12} value={grant.months} onChange={(e) => setGrant({ ...grant, months: e.target.value })} /></label>
          <button className="btn btn-outline">Conceder cortesia</button>
        </form>
        <div className="row wrap">
          {!s.email_verified && <button className="btn btn-outline" onClick={() => act('Confirmar e-mail', 'verify-email')}>Confirmar e-mail</button>}
          {s.two_factor && <button className="btn btn-outline" onClick={() => act('Remover 2FA', 'reset-2fa')}>Remover 2FA</button>}
          {s.suspended_at
            ? <button className="btn btn-outline" onClick={() => act('Reativar conta', 'unsuspend', {}, false)}>Reativar conta</button>
            : <button className="btn btn-outline danger" onClick={() => act('Suspender conta', 'suspend')}>Suspender conta</button>}
        </div>
      </div>
    </Section>
  );
}
