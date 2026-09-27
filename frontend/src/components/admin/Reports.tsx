import { useState } from 'react';
import { api } from '../../api/client';
import { get, Loading, Note, Section, Table, useReport } from './common';

interface Report {
  id: number; kind: 'ai_reply' | 'ranking_name'; content: string; reason: string; status: string; created_at: string; resolved_by: string | null;
  target_user: string | null; target_email: string | null; target_name: string | null; reporter_email: string | null;
}
const KIND = { ai_reply: 'Resposta da IA', ranking_name: 'Nome no ranking' };
const REASON: Record<string, string> = { ofensivo: 'Ofensivo', incorreto: 'Info. incorreta', perigoso: 'Perigoso', outro: 'Outro' };

/** Moderação: denúncias feitas no app/site (conteúdo gerado por IA e nomes públicos). Meta: analisar em até 24h. */
export default function Reports() {
  const [status, setStatus] = useState('open');
  const r = useReport(() => get<Report[]>(`/admin/reports?status=${status}`), status);
  const [msg, setMsg] = useState('');
  async function act(id: number, action: 'dismiss' | 'resolve' | 'reset_name') {
    if (action === 'reset_name' && !confirm('Trocar o nome deste aluno para "Estudante"?')) return;
    try { await api(`/admin/reports/${id}`, { body: { action } }); r.reload(); setMsg(''); } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <Section title="Denúncias" note="Respostas da Coruja IA e nomes do ranking denunciados por alunos. As lojas (Apple e Google) exigem que denúncias sejam analisadas — idealmente em até 24 horas.">
      <div className="c-toolbar">
        <div className="c-presets" role="group" aria-label="Situação">
          {[['open', 'Abertas'], ['resolved', 'Resolvidas'], ['dismissed', 'Descartadas'], ['all', 'Todas']].map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>
          ))}
        </div>
      </div>
      {msg && <p className="error">{msg}</p>}
      {!r.data ? <Loading {...r} /> : (
        <Table head={['Quando', 'Tipo', 'Motivo', 'Conteúdo', 'Aluno denunciado', 'Denunciante', 'Ações']} empty="Nenhuma denúncia."
          rows={r.data.map((x) => [
            new Date(x.created_at).toLocaleString('pt-BR'), KIND[x.kind], REASON[x.reason] ?? x.reason,
            <small className="c-detail" style={{ display: 'block', maxWidth: 380, whiteSpace: 'pre-wrap' }}>{x.content.slice(0, 600)}{x.content.length > 600 ? '…' : ''}</small>,
            x.target_email ? <>{x.target_name}<br /><small className="c-detail">{x.target_email}</small></> : '—',
            x.reporter_email ?? '—',
            x.status === 'open' ? (
              <span className="row wrap">
                {x.kind === 'ranking_name' && <button className="c-link danger" onClick={() => act(x.id, 'reset_name')}>Redefinir nome</button>}
                <button className="c-link" onClick={() => act(x.id, 'resolve')}>Resolvida</button>
                <button className="c-link" onClick={() => act(x.id, 'dismiss')}>Descartar</button>
              </span>
            ) : <small className="c-detail">{x.status === 'resolved' ? 'resolvida' : 'descartada'} por {x.resolved_by}</small>,
          ])} />
      )}
      <Note>Para suspender um aluno reincidente, use a aba Suporte (fica registrado na auditoria).</Note>
    </Section>
  );
}
