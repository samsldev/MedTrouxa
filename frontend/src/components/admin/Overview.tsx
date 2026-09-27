import { useState } from 'react';
import { BarChart, brl, brlShort, formatDelta, formatPct, FunnelChart, get, Kpi, lastDays, LineChart, Loading, num, query, Range, RangePicker, Section, Table, useReport } from './common';

interface Data {
  kpis: {
    mrr_cents: number; arr_cents: number; mrr_growth_pct: number | null; paying: number; arpa_cents: number; revenue_cents: number; prev_revenue_cents: number;
    new_subs: number; canceled: number; renewing_30d: number; signups: number; prev_signups: number; verified_rate: number; signup_to_paid: number; mfa_rate: number;
    users_total: number; answers: number; exams: number; dau: number; wau: number; mau: number; stickiness: number; refund_rate: number;
  };
  funnel: { name: string; value: number }[];
  series: { day: string; mrr_cents: number; paying: number; revenue_cents: number; new_subs: number; signups: number; active: number; answers: number }[];
  plans: { plan: string; pix: number; card: number; granted: number; total: number; renewing: number; mrr_cents: number }[];
}

/** Visão geral do negócio — MRR, ARR, receita, funil e engajamento. */
export default function Overview() {
  const [range, setRange] = useState<Range>(lastDays(30));
  const r = useReport(() => get<Data>(`/admin/overview?${query(range)}`), JSON.stringify(range));
  const d = r.data;
  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      {!d ? <Loading {...r} /> : (
        <>
          <div className="c-kpis">
            <Kpi accent label="MRR" value={brl(d.kpis.mrr_cents)} hint="Receita recorrente mensal: cada plano anual pago dividido por 12 (cortesias não entram)"
              delta={d.kpis.mrr_growth_pct === null ? null : { text: `${d.kpis.mrr_growth_pct > 0 ? '+' : ''}${formatPct(d.kpis.mrr_growth_pct)} no período`, tone: d.kpis.mrr_growth_pct > 0 ? 'up' : d.kpis.mrr_growth_pct < 0 ? 'down' : 'flat' }} />
            <Kpi accent label="ARR" value={brl(d.kpis.arr_cents)} hint="Receita recorrente anual = MRR × 12" />
            <Kpi label="Assinantes pagantes" value={num(d.kpis.paying)} />
            <Kpi label="Ticket médio mensal (ARPA)" value={brl(d.kpis.arpa_cents)} />
            <Kpi label="Receita no período" value={brl(d.kpis.revenue_cents)} delta={formatDelta(d.kpis.revenue_cents, d.kpis.prev_revenue_cents, false)} hint="Pagamentos confirmados menos reembolsos" />
            <Kpi label="Novas assinaturas" value={num(d.kpis.new_subs)} />
            <Kpi label="Cancelamentos / reembolsos" value={num(d.kpis.canceled)} />
            <Kpi label="Vencem em 30 dias" value={num(d.kpis.renewing_30d)} hint="Oportunidade de renovação" />
          </div>

          <Section title="Evolução do MRR"><LineChart series={d.series} value={(s: Data['series'][0]) => s.mrr_cents} format={brlShort} /></Section>
          <Section title="Receita diária e novos cadastros">
            <BarChart series={d.series} value={(s: Data['series'][0]) => s.revenue_cents} format={brl} label="Receita diária" />
            <BarChart series={d.series} value={(s: Data['series'][0]) => s.signups} secondary={(s: Data['series'][0]) => s.active} label="Cadastros e alunos ativos" height={140} />
            <p className="c-legend"><i className="main" /> Cadastros <i className="soft" /> Alunos ativos (responderam questões ou simulados)</p>
          </Section>

          <div className="c-grid2">
            <Section title="Funil de aquisição" note="Visitas vêm só de quem aceitou cookies de análise.">
              <FunnelChart steps={d.funnel} />
            </Section>
            <Section title="Aprendizado e engajamento">
              <div className="c-kpis small">
                <Kpi label="DAU" value={num(d.kpis.dau)} /><Kpi label="WAU" value={num(d.kpis.wau)} /><Kpi label="MAU" value={num(d.kpis.mau)} />
                <Kpi label="Aderência (DAU/MAU)" value={formatPct(d.kpis.stickiness)} />
                <Kpi label="Cadastros" value={num(d.kpis.signups)} delta={formatDelta(d.kpis.signups, d.kpis.prev_signups, false)} />
                <Kpi label="Cadastro → assinatura" value={formatPct(d.kpis.signup_to_paid)} />
                <Kpi label="E-mail confirmado" value={formatPct(d.kpis.verified_rate)} />
                <Kpi label="Com 2FA" value={formatPct(d.kpis.mfa_rate)} />
                <Kpi label="Questões respondidas" value={num(d.kpis.answers)} />
                <Kpi label="Simulados concluídos" value={num(d.kpis.exams)} />
                <Kpi label="Alunos (total)" value={num(d.kpis.users_total)} />
                <Kpi label="Taxa de reembolso" value={formatPct(d.kpis.refund_rate)} />
              </div>
            </Section>
          </div>

          <Section title="Assinaturas ativas por plano">
            <Table head={['Plano', 'Pix', 'Cartão', 'Cortesia', 'Total', 'Vencem em 30 dias', 'MRR']}
              rows={d.plans.map((p) => [<b>{p.plan}</b>, num(p.pix), num(p.card), num(p.granted), num(p.total), num(p.renewing), brl(p.mrr_cents)])} />
          </Section>
        </>
      )}
    </>
  );
}
