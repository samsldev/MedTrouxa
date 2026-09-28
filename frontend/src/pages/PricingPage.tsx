import { Fragment, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brl, Plan } from '../billing';
import { Icon, Stars } from '../components/Brand';
import Footer from '../components/Footer';
import Pricing, { usePlans } from '../components/Pricing';
import SiteNav from '../components/SiteNav';
import { useReveal } from '../hooks';

type PlanId = Plan['id'];
/** true = incluso · false = não incluso · string = valor específico do plano */
type Cell = boolean | string | ((p: Plan) => string);
type Row = [label: string, cells: Record<PlanId, Cell>, hint?: string];

const all = (v: Cell): Record<PlanId, Cell> => ({ aprendiz: v, alquimista: v, arcano: v });
const pro = (v: Cell): Record<PlanId, Cell> => ({ aprendiz: false, alquimista: v, arcano: v });

/** Tabela de recursos — espelha backend/src/billing/plans.ts (features e limites de cada plano). */
const GRUPOS: [string, string, Row[]][] = [
  ['questions', 'Banco de questões', [
    ['Questões comentadas', all(true)],
    ['Filtros por área, tema, banca, ano e dificuldade', all(true)],
    ['Filtrar só as questões que você errou', all(true)],
    ['Provas de residência na íntegra', pro(true)],
    ['Comentários de aprofundamento', pro(true)],
  ]],
  ['cards', 'Flashcards', [
    ['Flashcards com repetição espaçada (SM-2)', all(true)],
    ['Crie seus próprios baralhos', all(true)],
    ['Gerar flashcards a partir dos seus resumos (Coruja IA)', all(true)],
  ]],
  ['calendar', 'Foco em ENAMED e Residência', [
    ['Simulados cronometrados com gabarito comentado', all(true)],
    ['Cronogramas guiados (ENAMED, Residência, Internato)', pro(true)],
    ['Mapa de provas: o que mais cai por banca', pro(true)],
  ]],
  ['owl', 'Coruja IA', [
    ['Tire dúvidas e peça explicações 24h', all(true)],
    ['Limite de uso', { aprendiz: '30 mensagens/hora', alquimista: '90 mensagens/hora', arcano: '90 mensagens/hora' }, 'Uso 3x maior no Alquimista e no Arcano.'],
  ]],
  ['trophy', 'Acompanhamento', [
    ['Painel de desempenho', all(true)],
    ['Ranking entre estudantes', all(true)],
  ]],
  ['shield', 'Acesso e pagamento', [
    ['Tempo de acesso', { aprendiz: '1 ano', alquimista: '1 ano', arcano: '6 anos' }],
    ['Renovação', { aprendiz: 'Anual', alquimista: 'Anual', arcano: 'Sem renovação' }],
    ['Atualizações e novos materiais', all(true)],
    ['Parcelamento', all((p) => `até ${p.maxInstallments}x de ${brl(p.installmentPrice)}`)],
    ['Garantia de 7 dias (reembolso de 100%)', all(true)],
  ]],
];

const FAQ = [
  ['Posso testar antes de pagar?', 'Sim. A conta gratuita libera 20 questões comentadas por dia e flashcards, sem cartão. Assine só quando fizer sentido.'],
  ['Em quais dispositivos posso usar?', 'No navegador do computador, tablet ou celular.'],
  ['O acesso é liberado na hora?', 'Sim. No cartão e no Pix o acesso é liberado assim que o pagamento é aprovado.'],
  ['Quais formas de pagamento são aceitas?', 'Cartão de crédito (em até 12x) ou à vista no Pix ou no cartão, com o preço à vista.'],
  ['A assinatura renova sozinha?', 'Não. Aprendiz e Alquimista valem por 1 ano e você decide se renova; o Arcano cobre 6 anos com um único pagamento.'],
  ['Qual a diferença entre Alquimista e Arcano?', 'O conteúdo é o mesmo. O Alquimista é anual; o Arcano garante 6 anos de acesso, cobrindo a faculdade inteira, sem renovação.'],
  ['Posso trocar de plano depois?', 'Pode. Comece pelo Aprendiz no ciclo básico e migre quando o ENAMED ou a residência chegarem.'],
  ['Existe garantia?', 'Sim: 7 dias a partir da compra. Se não gostar, devolvemos 100% do valor.'],
  ['Recebo nota fiscal?', 'Sim, a nota fiscal de serviço é emitida para cada pagamento.'],
  ['Se eu renovar, perco meu progresso?', 'Não. Seu histórico, flashcards e desempenho continuam na sua conta.'],
];

function Valor({ c, p }: { c: Cell; p: Plan }) {
  if (c === true) return <Icon name="check" size={18} className="cmp-yes" aria-label="Incluso" />;
  if (c === false) return <span className="cmp-no" aria-label="Não incluso">—</span>;
  return <span className="cmp-txt">{typeof c === 'function' ? c(p) : c}</span>;
}

export default function PricingPage() {
  const plans = usePlans();
  useReveal([plans]);
  useEffect(() => { document.title = 'Planos e preços · MedTrouxa'; }, []);
  const anual = (id: PlanId) => plans.find((p) => p.id === id);
  const seisAnos = (p: Plan) => (p.accessYears >= 6 ? p.cashPrice : p.cashPrice * Math.ceil(6 / p.accessYears));
  const arcano = anual('arcano'), alq = anual('alquimista');

  return (
    <div className="landing pricing-page">
      <SiteNav active="planos" />

      <section className="pp-hero">
        <div className="aurora" aria-hidden="true" />
        <Stars />
        <div className="lp-wrap center">
          <span className="kicker">Planos e preços</span>
          <h1>Planos para cada <em>etapa da sua jornada</em>.</h1>
          <p className="lede">Do ciclo básico à residência. Comece grátis, assine quando quiser e parcele em até 12x.</p>
          <p className="pp-free"><Icon name="spark" size={14} /> Conta gratuita: 20 questões comentadas por dia, sem cartão. <Link to="/login?mode=register" className="link">Criar conta grátis</Link></p>
        </div>
      </section>

      <section className="lp-section pp-cards">
        <div className="lp-wrap">
          <Pricing ctaHref={(id) => `/checkout/${id}`} />
          <ul className="guarantees">
            <li><Icon name="shield" size={16} /> 7 dias de garantia</li>
            <li><Icon name="spark" size={16} /> Acesso liberado na hora</li>
            <li><Icon name="card" size={16} /> Até 12x no cartão ou Pix</li>
          </ul>
        </div>
      </section>

      <section className="lp-section tinted" id="comparar">
        <div className="lp-wrap">
          <div className="section-head center" data-reveal>
            <span className="kicker">Compare</span>
            <h2>Compare e escolha o <em>plano ideal</em>.</h2>
            <p className="lede">Todos os recursos de cada plano, lado a lado.</p>
          </div>

          <div className="cmp" data-reveal>
            <div className="cmp-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="cmp-feat"><span className="sr-only">Recurso</span></th>
                    {plans.map((p) => (
                      <th key={p.id} scope="col" className={p.id === 'alquimista' ? 'hl' : ''}>
                        <span className="cmp-name">{p.name}</span>
                        {p.badge && <span className="badge">{p.badge}</span>}
                        <span className="cmp-price">12x {brl(p.installmentPrice)}</span>
                        <Link to={`/checkout/${p.id}`} className={`btn btn-sm ${p.id === 'alquimista' ? 'btn-foil' : 'btn-outline'}`}>Assinar</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="cmp-total">
                    <th scope="row">Custo total em 6 anos<small>preço atual à vista, com as renovações necessárias</small></th>
                    {plans.map((p) => (
                      <td key={p.id} className={p.id === 'alquimista' ? 'hl' : ''}>
                        <strong>{brl(seisAnos(p))}</strong>
                        <small>{p.accessYears >= 6 ? 'pagamento único' : `${Math.ceil(6 / p.accessYears)}x ${brl(p.cashPrice)}`}</small>
                      </td>
                    ))}
                  </tr>
                  {GRUPOS.map(([ic, titulo, rows]) => (
                    <Fragment key={titulo}>
                      <tr className="cmp-group"><th scope="rowgroup" colSpan={plans.length + 1}><Icon name={ic} size={16} /> {titulo}</th></tr>
                      {rows.map(([label, cells, hint]) => (
                        <tr key={label}>
                          <th scope="row">{label}{hint && <small>{hint}</small>}</th>
                          {plans.map((p) => <td key={p.id} className={p.id === 'alquimista' ? 'hl' : ''}><Valor c={cells[p.id]} p={p} /></td>)}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {arcano && alq && (
              <p className="cmp-note">
                <Icon name="spark" size={14} /> Com o Arcano você economiza <b>{brl(seisAnos(alq) - arcano.cashPrice)}</b> em relação a 6 anos de Alquimista
                {' '}— equivale a <b>{brl(Math.round(arcano.cashPrice / (arcano.accessYears * 12)))}</b> por mês de acesso.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="lp-section" id="faq-planos">
        <div className="lp-wrap faq-layout">
          <div className="section-head" data-reveal>
            <span className="kicker">Dúvidas</span>
            <h2>Perguntas <em>frequentes</em></h2>
            <p className="lede left">Tudo sobre pagamento, acesso e garantia.</p>
          </div>
          <div className="faq" data-reveal>
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="aurora" aria-hidden="true" />
        <Stars />
        <div className="lp-wrap center" data-reveal>
          <h2>Ainda em <em>dúvida</em>?</h2>
          <p className="lede">Crie sua conta grátis e teste antes de escolher um plano.</p>
          <Link to="/login?mode=register" className="btn btn-foil btn-lg">Começar grátis <Icon name="arrow" size={16} /></Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
