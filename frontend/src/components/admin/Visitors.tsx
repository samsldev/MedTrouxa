import { useState } from 'react';
import { ALL_SEGMENTS, formatDuration, get, lastDays, Loading, Note, num, query, Range, RangePicker, Section, Segment, SegmentBar, Table, useReport } from './common';

interface Row { visitor_id: string; first_seen: string | null; last_seen: string | null; first_source: string | null; views: number; sessions: number; pages: number; active_ms: number; clicks: number; email: string | null }
interface Journey {
  visitor_id: string; email: string | null;
  pageviews: { id: string; path: string; started_at: string; active_ms: number; max_scroll: number; clicks: number; device: string; session_id: string | null; referrer: string | null; utm_source: string | null; utm_campaign: string | null; lp: string | null }[];
  clicks: { pageview_id: string; label: string; at: string }[];
}
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Visitantes e jornada — port de Visitors.tsx. Só quem consentiu aparece aqui. */
export default function Visitors() {
  const [range, setRange] = useState<Range>(lastDays(30));
  const [seg, setSeg] = useState<Segment>(ALL_SEGMENTS);
  const [open, setOpen] = useState<string | null>(null);
  const r = useReport(() => get<{ visitors: Row[] }>(`/admin/analytics/visitors?${query(range, seg)}`), JSON.stringify([range, seg]));
  if (open) return <JourneyView id={open} back={() => setOpen(null)} />;
  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      <SegmentBar value={seg} onChange={setSeg} />
      {!r.data ? <Loading {...r} /> : (
        <Section title={`${num(r.data.visitors.length)} visitantes`} note="Só visitantes que aceitaram cookies de análise (LGPD). Clique para ver a jornada completa.">
          <Table head={['Visitante', 'Primeira visita', 'Última', 'Origem', 'Visualizações', 'Sessões', 'Páginas', 'Tempo ativo', 'Cliques']}
            rows={r.data.visitors.map((v) => [
              <button className="c-link" onClick={() => setOpen(v.visitor_id)}>{v.email ?? `${v.visitor_id.slice(0, 8)}…`}</button>,
              dt(v.first_seen), dt(v.last_seen), v.first_source ?? '(direto)', num(v.views), num(v.sessions), num(v.pages), formatDuration(v.active_ms), num(v.clicks),
            ])} />
        </Section>
      )}
    </>
  );
}

function JourneyView({ id, back }: { id: string; back(): void }) {
  const r = useReport(() => get<Journey>(`/admin/analytics/visitors/${id}`), id);
  const d = r.data;
  const clicksBy = new Map<string, Journey['clicks']>();
  d?.clicks.forEach((c) => clicksBy.set(c.pageview_id, [...(clicksBy.get(c.pageview_id) ?? []), c]));
  const ordered = d ? [...d.pageviews].sort((a, b) => a.started_at.localeCompare(b.started_at)) : [];
  return (
    <>
      <button className="btn btn-text" onClick={back}>← Voltar aos visitantes</button>
      {!d ? <Loading {...r} /> : (
        <Section title={`Jornada de ${d.email ?? id.slice(0, 8)}`}>
          <Note>{num(d.pageviews.length)} visualizações, {num(new Set(d.pageviews.map((p) => p.session_id)).size)} sessões.</Note>
          <ol className="c-journey">
            {ordered.map((p, i) => {
              const newSession = i === 0 || ordered[i - 1].session_id !== p.session_id;
              return (
                <li key={p.id} className={newSession ? 'new-session' : ''}>
                  {newSession && <span className="c-chip">Nova sessão · {p.device}{p.referrer ? ` · via ${p.referrer}` : ''}{p.utm_source ? ` · ${p.utm_source}` : ''}{p.utm_campaign ? ` / ${p.utm_campaign}` : ''}{p.lp ? ` · lp ${p.lp}` : ''}</span>}
                  <div><b>{p.path}</b> <small>{dt(p.started_at)} · {formatDuration(p.active_ms)} ativo · rolou {p.max_scroll}%</small></div>
                  {(clicksBy.get(p.id) ?? []).map((c, j) => <div key={j} className="c-click">↳ clicou em <code>{c.label}</code></div>)}
                </li>
              );
            })}
          </ol>
        </Section>
      )}
    </>
  );
}
