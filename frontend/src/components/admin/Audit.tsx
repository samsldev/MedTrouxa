import { useState } from 'react';
import { get, Loading, Section, Table, useReport } from './common';

interface Entry { admin_email: string; action: string; target_user: string | null; detail: Record<string, unknown>; at: string }
const ACTIONS: Record<string, string> = {
  'user.grant_plan': 'Concedeu plano', 'user.revoke_plan': 'Encerrou assinatura', 'user.suspend': 'Suspendeu conta', 'user.unsuspend': 'Reativou conta',
  'user.reset_2fa': 'Removeu 2FA', 'user.verify_email': 'Confirmou e-mail',
};

/** Auditoria — toda ação administrativa sensível, append-only. */
export default function Audit() {
  const r = useReport(() => get<Entry[]>('/admin/audit'), 'audit');
  const [filter, setFilter] = useState('');
  const rows = (r.data ?? []).filter((e) => !filter || JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()));
  return (
    <Section title="Registro de auditoria" note="Somente leitura. Ações de suporte, notas fiscais e conteúdo ficam registradas com o motivo informado.">
      <div className="c-toolbar"><label className="c-field">Filtrar<input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e-mail, ação, id…" /></label></div>
      {!r.data ? <Loading {...r} /> : (
        <Table head={['Quando', 'Admin', 'Ação', 'Conta', 'Detalhes']}
          rows={rows.map((e) => [new Date(e.at).toLocaleString('pt-BR'), e.admin_email, ACTIONS[e.action] ?? <code>{e.action}</code>, e.target_user ? <code>{e.target_user.slice(0, 8)}…</code> : '—',
            <small className="c-detail">{Object.entries(e.detail ?? {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}</small>])} />
      )}
    </Section>
  );
}
