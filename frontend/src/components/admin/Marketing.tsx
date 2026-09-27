import { useState } from 'react';
import { ALL_SEGMENTS, Bar, BarChart, formatDelta, formatDuration, formatPct, get, Kpi, lastDays, Loading, Note, num, query, Range, RangePicker, Section, Segment, SegmentBar, Table, useReport } from './common';

export interface Stats { name: string; views: number; visitors: number; sessions: number; avg_active_ms: number; avg_scroll: number; reach: number[]; bounce_rate: number; clicks: number; click_rate: number }
interface Data {
  truncated: boolean; totals: Stats; anonymous_views: number; series: { day: string; views: number; visitors: number }[];
  pages: Stats[]; landing_pages: Stats[]; referrers: Stats[]; utm_sources: Stats[]; utm_campaigns: Stats[]; utm_contents: Stats[]; devices: Stats[]; languages: Stats[];
  subscribe_intent: { total: number; by_plan: { name: string; clicks: number }[]; by_page: { name: string; clicks: number }[] };
  previous: { totals: Stats; anonymous_views: number };
}

export function StatsTable({ rows, label, onPick }: { rows: Stats[]; label: string; onPick?: (name: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <Table head={[label, 'Visualizações', 'Visitantes', 'Tempo ativo', 'Rolagem', 'Rejeição', 'Cliques']}
      rows={rows.map((r) => [
        onPick ? <button className="c-link" onClick={() => onPick(r.name)}>{r.name}</button> : <b>{r.name}</b>,
        <Bar value={r.views} max={max} />, num(r.visitors), formatDuration(r.avg_active_ms), `${r.avg_scroll}%`, formatPct(r.bounce_rate), num(r.clicks),
      ])} />
  );
}

/** Marketing — port de Marketing.tsx (faelith_web). */
export default function Marketing({ openHeatmap }: { openHeatmap(path: string): void }) {
  const [range, setRange] = useState<Range>(lastDays(30));
  const [seg, setSeg] = useState<Segment>(ALL_SEGMENTS);
  const r = useReport(() => get<Data>(`/admin/analytics/overview?${query(range, seg)}`), JSON.stringify([range, seg]));
  const d = r.data;
  const t = d?.totals, p = d?.previous.totals;
  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      <SegmentBar value={seg} onChange={setSeg} />
      {!d || !t || !p ? <Loading {...r} /> : (
        <>
          {d.truncated && <p className="notice">Período muito longo: mostrando só as visualizações mais recentes. Reduza o intervalo para números completos.</p>}
          <div className="c-kpis">
            <Kpi label="Visualizações" value={num(t.views)} delta={formatDelta(t.views, p.views, false)} />
            <Kpi label="Visitantes únicos" value={num(t.visitors)} delta={formatDelta(t.visitors, p.visitors, false)} hint="Só quem aceitou cookies de análise" />
            <Kpi label="Sessões" value={num(t.sessions)} delta={formatDelta(t.sessions, p.sessions, false)} />
            <Kpi label="Tempo ativo médio" value={formatDuration(t.avg_active_ms)} delta={formatDelta(t.avg_active_ms, p.avg_active_ms, false)} />
            <Kpi label="Rolagem média" value={`${t.avg_scroll}%`} delta={formatDelta(t.avg_scroll, p.avg_scroll, true)} />
            <Kpi label="Rejeição" value={formatPct(t.bounce_rate)} delta={formatDelta(t.bounce_rate, p.bounce_rate, true)} hint="Visualizações com menos de 10s ativos, pouca rolagem e nenhum clique" />
            <Kpi label="Taxa de clique" value={formatPct(t.click_rate)} delta={formatDelta(t.click_rate, p.click_rate, true)} />
            <Kpi accent label="Cliques em assinar" value={num(d.subscribe_intent.total)} />
          </div>
          <Note>{num(d.anonymous_views)} visualizações anônimas (sem consentimento) contam só no total, sem visitante nem sessão.</Note>

          <Section title="Tráfego diário">
            <BarChart series={d.series} value={(s: Data['series'][0]) => s.views} secondary={(s: Data['series'][0]) => s.visitors} label="Visualizações e visitantes" />
            <p className="c-legend"><i className="main" /> Visualizações <i className="soft" /> Visitantes</p>
          </Section>

          <div className="c-grid2">
            <Section title="Intenção de assinatura por plano" note="Cliques nos botões de assinar (antes do checkout).">
              <Table head={['Plano / página', 'Cliques']} rows={d.subscribe_intent.by_plan.map((x) => [x.name, <Bar value={x.clicks} max={d.subscribe_intent.by_plan[0].clicks} />])} />
            </Section>
            <Section title="Intenção de assinatura por página">
              <Table head={['Página', 'Cliques']} rows={d.subscribe_intent.by_page.map((x) => [x.name, <Bar value={x.clicks} max={d.subscribe_intent.by_page[0].clicks} />])} />
            </Section>
          </div>

          <Section title="Páginas" note="Clique numa página para abrir o mapa de calor."><StatsTable rows={d.pages} label="Página" onPick={openHeatmap} /></Section>
          <Section title="Variações de landing (lp)"><StatsTable rows={d.landing_pages} label="Landing" onPick={(lp) => setSeg({ ...seg, lp })} /></Section>
          <div className="c-grid2">
            <Section title="Fontes UTM"><StatsTable rows={d.utm_sources} label="Fonte" onPick={(source) => setSeg({ ...seg, source })} /></Section>
            <Section title="Campanhas UTM"><StatsTable rows={d.utm_campaigns} label="Campanha" onPick={(campaign) => setSeg({ ...seg, campaign })} /></Section>
            <Section title="Criativos (utm_content)"><StatsTable rows={d.utm_contents} label="Conteúdo" /></Section>
            <Section title="Sites de origem"><StatsTable rows={d.referrers} label="Origem" /></Section>
            <Section title="Dispositivos"><StatsTable rows={d.devices} label="Dispositivo" onPick={(device) => setSeg({ ...seg, device })} /></Section>
            <Section title="Idiomas"><StatsTable rows={d.languages} label="Idioma" /></Section>
          </div>
        </>
      )}
    </>
  );
}
