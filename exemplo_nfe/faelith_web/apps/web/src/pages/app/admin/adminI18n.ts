/**
 * @fileoverview Admin console strings (en, pt-BR, pt-PT) and small formatting helpers.
 * @author Samuel S. L.
 * @version 1.7.0
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
 * - One table shared by every admin tab so terminology stays consistent
 * - Durations and percentages are formatted here (DRY across tables and cards)
 */

import type { Dict } from '../../../lib/i18n';

export interface AdminStrings {
  kicker: string;
  title: string;
  tabs: { marketing: string; subscriptions: string; nfse: string; heatmap: string; visitors: string; support: string; audit: string };
  range: { from: string; to: string; presets: string[] };
  filters: { device: string; source: string; campaign: string; lp: string; all: string; apply: string; clear: string };
  vsPrevious: string;
  loading: string;
  failed: string;
  empty: string;
  kpi: { views: string; visitors: string; sessions: string; avgTime: string; avgScroll: string; bounce: string; clickRate: string; anonymous: string };
  sections: {
    daily: string;
    pages: string;
    landing: string;
    referrers: string;
    sources: string;
    campaigns: string;
    contents: string;
    devices: string;
    languages: string;
  };
  cols: { name: string; views: string; visitors: string; avgTime: string; avgScroll: string; reach: string; bounce: string; clickRate: string; clicks: string };
  openHeatmap: string;
  truncated: string;
  consentNote: string;
  heat: {
    path: string;
    device: string;
    allDevices: string;
    show: string;
    layers: { clicks: string; attention: string; scroll: string };
    targets: string;
    reached: (pct: number) => string;
    pickPage: string;
    frameNote: string;
  };
  visitors: {
    cols: { visitor: string; email: string; source: string; firstSeen: string; lastSeen: string; views: string; sessions: string; pages: string; time: string; clicks: string };
    journey: string;
    back: string;
    clickedOn: string;
    note: string;
  };
  support: {
    search: string;
    placeholder: string;
    noResult: string;
    account: string;
    noAccount: string;
    org: string;
    plan: string;
    none: string;
    status: string;
    credits: string;
    suspended: string;
    active: string;
    refundOpen: (date: string) => string;
    intro: string;
    retention: string;
    keys: string;
    createKey: string;
    purpose: string;
    rpm: string;
    tpm: string;
    revoke: string;
    revoked: string;
    plaintextOnce: string;
    setPlan: string;
    clearPlan: string;
    usageBased: string;
    save: string;
    adjustCredits: string;
    usd: string;
    apply: string;
    reset: string;
    reason: string;
    grant: string;
    suspend: string;
    unsuspend: string;
    done: string;
    stripeNote: string;
  };
  audit: { when: string; admin: string; action: string; org: string; detail: string };
  subs: {
    live: string;
    monthly: string;
    yearly: string;
    mrr: string;
    arr: string;
    scheduled: string;
    newInRange: string;
    canceledInRange: string;
    note: string;
    byPlan: string;
    plan: string;
    total: string;
    statuses: string;
    funnelPlan: string;
    funnelLanding: string;
    funnelOffer: string;
    started: string;
    completed: string;
    open: string;
    conversion: string;
  };
  intent: { title: string; byPage: string; clicks: string };
  nfse: {
    environment: string;
    codes: string;
    series: string;
    certificate: string;
    expires: string;
    expiring: string;
    disabled: string;
    status: string;
    all: string;
    cols: string[];
    retry: string;
    cancel: string;
    cancelPrompt: string;
    done: string;
  };
  buyers: { title: string; kind: string; kinds: Record<string, string>; count: string; mrr: string; countries: string; taxIds: string; note: string };
  profit: {
    title: string;
    note: (revenue: number, profit: number, days: number) => string;
    subsTitle: string;
    type: string;
    subscriptions: string;
    revenue: string;
    cost: string;
    revenueTax: string;
    fee: string;
    feeAuto: string;
    feeSource: (pct: number, source: string) => string;
    profitTax: string;
    regime: string;
    regimes: { simples: string; presumido: string; real: string };
    applyTax: string;
    profit: string;
    margin: string;
    perSub: string;
    total: string;
    annual: string;
    apiTitle: string;
    apiNote: string;
    overageTitle: string;
    requests: string;
    orgs: string;
    monthlyProfit: string;
    apiProfit: string;
  };
  refund: {
    open: string;
    refunded: string;
    rate: string;
    byKind: string;
    kind: string;
    openNow: string;
    closingSoon: string;
    opened: string;
    byPlan: string;
    byKindPlan: string;
    byCountry: string;
    count: string;
    note: string;
  };
}

export const T: Dict<AdminStrings> = {
  en: {
    kicker: 'Admin',
    title: 'Admin console',
    tabs: { marketing: 'Marketing', subscriptions: 'Subscriptions', nfse: 'NFS-e', heatmap: 'Heatmaps', visitors: 'Visitors', support: 'Support', audit: 'Audit log' },
    range: { from: 'From', to: 'To', presets: ['24 hours', '7 days', '15 days', '1 month', '3 months', '1 year'] },
    filters: { device: 'Device', source: 'UTM source', campaign: 'UTM campaign', lp: 'Landing variant', all: 'All', apply: 'Apply filters', clear: 'Clear filters' },
    vsPrevious: 'vs previous period',
    loading: 'Loading…',
    failed: 'Unable to load',
    empty: 'No data for this period.',
    kpi: { views: 'Page views', visitors: 'Visitors', sessions: 'Sessions', avgTime: 'Avg. active time', avgScroll: 'Avg. scroll depth', bounce: 'Bounce rate', clickRate: 'Click rate', anonymous: 'Anonymous views' },
    sections: { daily: 'Daily views', pages: 'Pages', landing: 'Landing page variants', referrers: 'Referrers', sources: 'UTM sources', campaigns: 'UTM campaigns', contents: 'UTM contents (ads)', devices: 'Devices', languages: 'Browser languages' },
    cols: { name: 'Name', views: 'Views', visitors: 'Visitors', avgTime: 'Avg. time', avgScroll: 'Avg. scroll', reach: 'Reach 25/50/75/100%', bounce: 'Bounce', clickRate: 'Click rate', clicks: 'Clicks' },
    openHeatmap: 'Heatmap',
    truncated: 'Too many rows: this report covers the most recent 200,000 page views of the period.',
    consentNote: 'Visitors and sessions count only people who accepted analytics cookies; anonymous views are in every other number.',
    heat: {
      path: 'Page path',
      device: 'Device',
      allDevices: 'All devices',
      show: 'Show',
      layers: { clicks: 'Clicks', attention: 'Attention', scroll: 'Scroll reach' },
      targets: 'Most clicked elements',
      reached: (pct) => `${pct}% reached`,
      pickPage: 'Pick a page in Marketing or type its path.',
      frameNote: 'The page is rendered live; layouts that changed since the visits may not line up exactly.',
    },
    visitors: {
      cols: { visitor: 'Visitor', email: 'Account', source: 'First source', firstSeen: 'First seen', lastSeen: 'Last seen', views: 'Views', sessions: 'Sessions', pages: 'Pages', time: 'Active time', clicks: 'Clicks' },
      journey: 'Journey',
      back: 'Back to visitors',
      clickedOn: 'Clicked',
      note: 'Only visitors who accepted analytics cookies are listed.',
    },
    support: {
      search: 'Search',
      placeholder: 'Email, organization id, or 8-character key prefix',
      noResult: 'Nothing found.',
      account: 'Account',
      noAccount: 'No website account',
      org: 'Organization',
      plan: 'Plan',
      none: 'None',
      status: 'Status',
      credits: 'Credits',
      suspended: 'Suspended',
      active: 'Active',
      refundOpen: (date) => `Refund window open until ${date}`,
      intro: 'Intro month (50%)',
      retention: 'Retention month (50%)',
      keys: 'API keys',
      createKey: 'Create key',
      purpose: 'Purpose',
      rpm: 'Requests / min',
      tpm: 'Tokens / min',
      revoke: 'Revoke',
      revoked: 'Revoked',
      plaintextOnce: 'Copy this key now. It is shown only once.',
      setPlan: 'Subscription',
      clearPlan: 'Remove plan',
      usageBased: 'Usage-based overflow',
      save: 'Save',
      adjustCredits: 'Adjust credits',
      usd: 'USD (negative removes)',
      apply: 'Apply',
      reset: 'Grant usage reset',
      reason: 'Reason',
      grant: 'Grant',
      suspend: 'Suspend',
      unsuspend: 'Lift suspension',
      done: 'Done.',
      stripeNote: 'Plan changes here do not touch Stripe billing.',
    },
    audit: { when: 'When', admin: 'Admin', action: 'Action', org: 'Organization', detail: 'Detail' },
    subs: {
      live: 'Live subscriptions',
      monthly: 'Monthly',
      yearly: 'Yearly',
      mrr: 'MRR',
      arr: 'ARR',
      scheduled: 'Canceling at period end',
      newInRange: 'New in period',
      canceledInRange: 'Canceled in period',
      note: 'Live from Stripe. MRR and ARR use list prices (intro and retention discounts not deducted); the plan mix is current, the other numbers use the period.',
      byPlan: 'By plan',
      plan: 'Plan',
      total: 'Total',
      statuses: 'Stripe statuses',
      funnelPlan: 'Checkout funnel by plan',
      funnelLanding: 'Checkout funnel by landing page',
      funnelOffer: 'Checkout funnel by offer',
      started: 'Started',
      completed: 'Paid',
      open: 'Open',
      conversion: 'Conversion',
    },
    profit: {
      title: 'Real profit',
      note: (revenue, profit, days) => `Profit = revenue - provider cost - ${revenue}% tax on revenue - ${profit}% tax on the remaining profit. Subscriptions: monthly basis (MRR at list price; provider cost of included usage over the last ${days} days scaled to 30 days). API and overage: actual usage in the period.`,
      subsTitle: 'Subscriptions per month, by plan and billing interval',
      type: 'Plan / interval',
      subscriptions: 'Subscriptions',
      revenue: 'Revenue',
      cost: 'Provider cost',
      revenueTax: 'Tax on revenue',
      fee: 'Payment fees',
      feeAuto: 'measured',
      feeSource: (pct, source) => `Payment fees ${pct}% (${source === 'stripe' ? 'measured in Stripe for this period' : source === 'override' ? 'typed manually' : 'configured fallback, no payments in the period'}).`,
      profitTax: 'Tax on profit',
      regime: 'Tax regime',
      regimes: { simples: 'Simples (Annex III)', presumido: 'Lucro Presumido', real: 'Lucro Real' },
      applyTax: 'Apply rates',
      profit: 'Profit',
      margin: 'Margin',
      perSub: 'Profit / subscription',
      total: 'Total',
      annual: 'Annual profit (x12)',
      apiTitle: 'Pure API usage (prepaid credits) in the period',
      apiNote: 'List-price revenue of API key usage, not counting subscriptions.',
      overageTitle: 'Subscriber overage (usage-based, prepaid credits) in the period',
      requests: 'Requests',
      orgs: 'Organizations',
      monthlyProfit: 'Monthly profit (subscriptions)',
      apiProfit: 'API profit (period)',
    },
    refund: {
      open: 'In refund window',
      refunded: 'Refunded in period',
      rate: 'Refund rate',
      byKind: 'Refund windows by length',
      kind: 'Window',
      openNow: 'Open now',
      closingSoon: 'Closing in 48h',
      opened: 'Opened in period',
      byPlan: 'In refund window by plan',
      byKindPlan: 'In refund window by length and plan',
      byCountry: 'In refund window by country',
      count: 'Subscriptions',
      note: 'Refund rate = windows refunded in the period / windows opened in the period.',
    },
    buyers: {
      title: 'Buyers of live subscriptions',
      kind: 'Buyer',
      kinds: { business: 'Business (tax id)', individual: 'Individual', unknown: 'Not identified (before tax id collection)' },
      count: 'Subscriptions',
      mrr: 'MRR',
      countries: 'By billing country',
      taxIds: 'By tax id type',
      note: 'Checkout asks whether the purchase is for a business and collects the company tax id (CNPJ, EU VAT...) and the billing address.',
    },
    nfse: {
      environment: 'Environment',
      codes: 'Codes',
      series: 'series',
      certificate: 'A1 certificate',
      expires: 'expires',
      expiring: 'The A1 certificate expires in less than 30 days: renew it and update the PEM files.',
      disabled: 'Emitter disabled (NFSE_ENABLED=0). Paid invoices are queued and will be issued once it is enabled.',
      status: 'Status',
      all: 'All',
      cols: ['Paid at', 'Status', 'Number', 'Buyer', 'Value', 'Last error', 'Actions'],
      retry: 'Retry',
      cancel: 'Cancel note',
      cancelPrompt: 'Cancellation reason (at least 15 characters):',
      done: 'Done.',
    },
    intent: { title: 'Subscribe interest (CTA clicks) by plan', byPage: 'Subscribe clicks by page', clicks: 'Clicks' },
  },
  br: {
    kicker: 'Admin',
    title: 'Console de administração',
    tabs: { marketing: 'Marketing', subscriptions: 'Assinaturas', nfse: 'Notas fiscais', heatmap: 'Mapas de calor', visitors: 'Visitantes', support: 'Suporte', audit: 'Auditoria' },
    range: { from: 'De', to: 'Até', presets: ['24 horas', '7 dias', '15 dias', '1 mês', '3 meses', '1 ano'] },
    filters: { device: 'Dispositivo', source: 'Fonte UTM', campaign: 'Campanha UTM', lp: 'Variante de LP', all: 'Todos', apply: 'Aplicar filtros', clear: 'Limpar filtros' },
    vsPrevious: 'vs período anterior',
    loading: 'Carregando…',
    failed: 'Não foi possível carregar',
    empty: 'Sem dados neste período.',
    kpi: { views: 'Visualizações', visitors: 'Visitantes', sessions: 'Sessões', avgTime: 'Tempo ativo médio', avgScroll: 'Rolagem média', bounce: 'Taxa de rejeição', clickRate: 'Taxa de clique', anonymous: 'Visualizações anônimas' },
    sections: { daily: 'Visualizações por dia', pages: 'Páginas', landing: 'Variações de landing page', referrers: 'Origens', sources: 'Fontes UTM', campaigns: 'Campanhas UTM', contents: 'Conteúdos UTM (anúncios)', devices: 'Dispositivos', languages: 'Idiomas do navegador' },
    cols: { name: 'Nome', views: 'Visualizações', visitors: 'Visitantes', avgTime: 'Tempo médio', avgScroll: 'Rolagem média', reach: 'Alcance 25/50/75/100%', bounce: 'Rejeição', clickRate: 'Taxa de clique', clicks: 'Cliques' },
    openHeatmap: 'Mapa de calor',
    truncated: 'Linhas demais: este relatório cobre as 200.000 visualizações mais recentes do período.',
    consentNote: 'Visitantes e sessões contam só quem aceitou os cookies de análise; as visualizações anônimas entram em todos os outros números.',
    heat: {
      path: 'Caminho da página',
      device: 'Dispositivo',
      allDevices: 'Todos',
      show: 'Mostrar',
      layers: { clicks: 'Cliques', attention: 'Atenção', scroll: 'Alcance da rolagem' },
      targets: 'Elementos mais clicados',
      reached: (pct) => `${pct}% chegaram`,
      pickPage: 'Escolha uma página em Marketing ou digite o caminho.',
      frameNote: 'A página é renderizada ao vivo; layouts que mudaram depois das visitas podem não alinhar exatamente.',
    },
    visitors: {
      cols: { visitor: 'Visitante', email: 'Conta', source: 'Primeira origem', firstSeen: 'Primeira visita', lastSeen: 'Última visita', views: 'Visualizações', sessions: 'Sessões', pages: 'Páginas', time: 'Tempo ativo', clicks: 'Cliques' },
      journey: 'Jornada',
      back: 'Voltar aos visitantes',
      clickedOn: 'Clicou',
      note: 'Só aparecem visitantes que aceitaram os cookies de análise.',
    },
    support: {
      search: 'Buscar',
      placeholder: 'E-mail, id da organização ou prefixo de 8 caracteres da chave',
      noResult: 'Nada encontrado.',
      account: 'Conta',
      noAccount: 'Sem conta no site',
      org: 'Organização',
      plan: 'Plano',
      none: 'Nenhum',
      status: 'Status',
      credits: 'Créditos',
      suspended: 'Suspensa',
      active: 'Ativa',
      refundOpen: (date) => `Janela de reembolso aberta até ${date}`,
      intro: 'Mês de boas-vindas (50%)',
      retention: 'Mês de permanência (50%)',
      keys: 'Chaves de API',
      createKey: 'Criar chave',
      purpose: 'Finalidade',
      rpm: 'Requisições / min',
      tpm: 'Tokens / min',
      revoke: 'Revogar',
      revoked: 'Revogada',
      plaintextOnce: 'Copie esta chave agora. Ela aparece uma única vez.',
      setPlan: 'Assinatura',
      clearPlan: 'Remover plano',
      usageBased: 'Excedente por uso',
      save: 'Salvar',
      adjustCredits: 'Ajustar créditos',
      usd: 'USD (negativo remove)',
      apply: 'Aplicar',
      reset: 'Dar reset de uso',
      reason: 'Motivo',
      grant: 'Conceder',
      suspend: 'Suspender',
      unsuspend: 'Reativar',
      done: 'Feito.',
      stripeNote: 'Mudanças de plano aqui não alteram a cobrança no Stripe.',
    },
    audit: { when: 'Quando', admin: 'Admin', action: 'Ação', org: 'Organização', detail: 'Detalhe' },
    subs: {
      live: 'Assinaturas ativas',
      monthly: 'Mensais',
      yearly: 'Anuais',
      mrr: 'MRR',
      arr: 'ARR',
      scheduled: 'Cancelando no fim do período',
      newInRange: 'Novas no período',
      canceledInRange: 'Canceladas no período',
      note: 'Ao vivo do Stripe. MRR e ARR usam preço de tabela (sem descontar as ofertas de 50%); a distribuição por plano é a atual, os demais números usam o período.',
      byPlan: 'Por plano',
      plan: 'Plano',
      total: 'Total',
      statuses: 'Status no Stripe',
      funnelPlan: 'Funil de checkout por plano',
      funnelLanding: 'Funil de checkout por landing page',
      funnelOffer: 'Funil de checkout por oferta',
      started: 'Iniciados',
      completed: 'Pagos',
      open: 'Em aberto',
      conversion: 'Conversão',
    },
    profit: {
      title: 'Lucro real',
      note: (revenue, profit, days) => `Lucro = receita - custo do provedor - ${revenue}% de imposto sobre a receita - ${profit}% de imposto sobre o lucro restante. Assinaturas: base mensal (MRR a preço de tabela; custo do provedor do uso incluído nos últimos ${days} dias, proporcional a 30 dias). API e excedente: uso real do período.`,
      subsTitle: 'Assinaturas por mês, por plano e tipo de cobrança',
      type: 'Plano / cobrança',
      subscriptions: 'Assinaturas',
      revenue: 'Receita',
      cost: 'Custo do provedor',
      revenueTax: 'Imposto sobre a receita',
      fee: 'Taxas de pagamento',
      feeAuto: 'medida',
      feeSource: (pct, source) => `Taxas de pagamento de ${pct}% (${source === 'stripe' ? 'medida no Stripe neste período' : source === 'override' ? 'digitada manualmente' : 'valor padrão configurado, sem pagamentos no período'}).`,
      profitTax: 'Imposto sobre o lucro',
      regime: 'Regime tributário',
      regimes: { simples: 'Simples (Anexo III)', presumido: 'Lucro Presumido', real: 'Lucro Real' },
      applyTax: 'Aplicar alíquotas',
      profit: 'Lucro',
      margin: 'Margem',
      perSub: 'Lucro / assinatura',
      total: 'Total',
      annual: 'Lucro anual (x12)',
      apiTitle: 'Uso puro de API (créditos pré-pagos) no período',
      apiNote: 'Receita a preço de tabela do uso por chaves de API, sem contar assinaturas.',
      overageTitle: 'Excedente de assinantes (por uso, créditos pré-pagos) no período',
      requests: 'Requisições',
      orgs: 'Organizações',
      monthlyProfit: 'Lucro mensal (assinaturas)',
      apiProfit: 'Lucro da API (período)',
    },
    refund: {
      open: 'Na janela de reembolso',
      refunded: 'Reembolsadas no período',
      rate: 'Taxa de reembolso',
      byKind: 'Janelas de reembolso por duração',
      kind: 'Janela',
      openNow: 'Abertas agora',
      closingSoon: 'Fecham em 48h',
      opened: 'Abertas no período',
      byPlan: 'Na janela de reembolso por plano',
      byKindPlan: 'Na janela de reembolso por duração e plano',
      byCountry: 'Na janela de reembolso por país',
      count: 'Assinaturas',
      note: 'Taxa de reembolso = janelas reembolsadas no período / janelas abertas no período.',
    },
    buyers: {
      title: 'Compradores das assinaturas ativas',
      kind: 'Comprador',
      kinds: { business: 'Empresa (CNPJ / VAT)', individual: 'Pessoa física', unknown: 'Não identificado (antes da coleta)' },
      count: 'Assinaturas',
      mrr: 'MRR',
      countries: 'Por país de cobrança',
      taxIds: 'Por tipo de documento',
      note: 'O checkout pergunta se a compra é para empresa e coleta o documento fiscal (CNPJ, VAT...) e o endereço de cobrança.',
    },
    nfse: {
      environment: 'Ambiente',
      codes: 'Códigos',
      series: 'série',
      certificate: 'Certificado A1',
      expires: 'vence em',
      expiring: 'O certificado A1 vence em menos de 30 dias: renove e atualize os arquivos PEM.',
      disabled: 'Emissor desligado (NFSE_ENABLED=0). As faturas pagas ficam na fila e serão emitidas quando ele for ligado.',
      status: 'Situação',
      all: 'Todas',
      cols: ['Pago em', 'Situação', 'Número', 'Tomador', 'Valor', 'Último erro', 'Ações'],
      retry: 'Reenviar',
      cancel: 'Cancelar nota',
      cancelPrompt: 'Motivo do cancelamento (mínimo de 15 caracteres):',
      done: 'Feito.',
    },
    intent: { title: 'Interesse em assinar (cliques nos CTAs) por plano', byPage: 'Cliques em assinar por página', clicks: 'Cliques' },
  },
  pt: {
    kicker: 'Admin',
    title: 'Consola de administração',
    tabs: { marketing: 'Marketing', subscriptions: 'Subscrições', nfse: 'Notas fiscais', heatmap: 'Mapas de calor', visitors: 'Visitantes', support: 'Suporte', audit: 'Auditoria' },
    range: { from: 'De', to: 'Até', presets: ['24 horas', '7 dias', '15 dias', '1 mês', '3 meses', '1 ano'] },
    filters: { device: 'Dispositivo', source: 'Fonte UTM', campaign: 'Campanha UTM', lp: 'Variante de LP', all: 'Todos', apply: 'Aplicar filtros', clear: 'Limpar filtros' },
    vsPrevious: 'vs período anterior',
    loading: 'A carregar…',
    failed: 'Não foi possível carregar',
    empty: 'Sem dados neste período.',
    kpi: { views: 'Visualizações', visitors: 'Visitantes', sessions: 'Sessões', avgTime: 'Tempo ativo médio', avgScroll: 'Deslocamento médio', bounce: 'Taxa de rejeição', clickRate: 'Taxa de clique', anonymous: 'Visualizações anónimas' },
    sections: { daily: 'Visualizações por dia', pages: 'Páginas', landing: 'Variações de landing page', referrers: 'Origens', sources: 'Fontes UTM', campaigns: 'Campanhas UTM', contents: 'Conteúdos UTM (anúncios)', devices: 'Dispositivos', languages: 'Idiomas do navegador' },
    cols: { name: 'Nome', views: 'Visualizações', visitors: 'Visitantes', avgTime: 'Tempo médio', avgScroll: 'Deslocamento médio', reach: 'Alcance 25/50/75/100%', bounce: 'Rejeição', clickRate: 'Taxa de clique', clicks: 'Cliques' },
    openHeatmap: 'Mapa de calor',
    truncated: 'Demasiadas linhas: este relatório abrange as 200 000 visualizações mais recentes do período.',
    consentNote: 'Visitantes e sessões contam apenas quem aceitou os cookies de análise; as visualizações anónimas entram em todos os outros números.',
    heat: {
      path: 'Caminho da página',
      device: 'Dispositivo',
      allDevices: 'Todos',
      show: 'Mostrar',
      layers: { clicks: 'Cliques', attention: 'Atenção', scroll: 'Alcance do deslocamento' },
      targets: 'Elementos mais clicados',
      reached: (pct) => `${pct}% chegaram`,
      pickPage: 'Escolha uma página em Marketing ou escreva o caminho.',
      frameNote: 'A página é apresentada ao vivo; layouts alterados depois das visitas podem não coincidir exatamente.',
    },
    visitors: {
      cols: { visitor: 'Visitante', email: 'Conta', source: 'Primeira origem', firstSeen: 'Primeira visita', lastSeen: 'Última visita', views: 'Visualizações', sessions: 'Sessões', pages: 'Páginas', time: 'Tempo ativo', clicks: 'Cliques' },
      journey: 'Percurso',
      back: 'Voltar aos visitantes',
      clickedOn: 'Clicou',
      note: 'Só aparecem visitantes que aceitaram os cookies de análise.',
    },
    support: {
      search: 'Pesquisar',
      placeholder: 'E-mail, id da organização ou prefixo de 8 caracteres da chave',
      noResult: 'Nada encontrado.',
      account: 'Conta',
      noAccount: 'Sem conta no site',
      org: 'Organização',
      plan: 'Plano',
      none: 'Nenhum',
      status: 'Estado',
      credits: 'Créditos',
      suspended: 'Suspensa',
      active: 'Ativa',
      refundOpen: (date) => `Janela de reembolso aberta até ${date}`,
      intro: 'Mês de boas-vindas (50%)',
      retention: 'Mês de permanência (50%)',
      keys: 'Chaves de API',
      createKey: 'Criar chave',
      purpose: 'Finalidade',
      rpm: 'Pedidos / min',
      tpm: 'Tokens / min',
      revoke: 'Revogar',
      revoked: 'Revogada',
      plaintextOnce: 'Copie esta chave agora. Só é apresentada uma vez.',
      setPlan: 'Subscrição',
      clearPlan: 'Remover plano',
      usageBased: 'Excedente por utilização',
      save: 'Guardar',
      adjustCredits: 'Ajustar créditos',
      usd: 'USD (negativo remove)',
      apply: 'Aplicar',
      reset: 'Conceder reposição de utilização',
      reason: 'Motivo',
      grant: 'Conceder',
      suspend: 'Suspender',
      unsuspend: 'Reativar',
      done: 'Feito.',
      stripeNote: 'Alterações de plano aqui não alteram a faturação no Stripe.',
    },
    audit: { when: 'Quando', admin: 'Admin', action: 'Ação', org: 'Organização', detail: 'Detalhe' },
    subs: {
      live: 'Subscrições ativas',
      monthly: 'Mensais',
      yearly: 'Anuais',
      mrr: 'MRR',
      arr: 'ARR',
      scheduled: 'A cancelar no fim do período',
      newInRange: 'Novas no período',
      canceledInRange: 'Canceladas no período',
      note: 'Em direto do Stripe. MRR e ARR usam preço de tabela (sem descontar as ofertas de 50%); a distribuição por plano é a atual, os restantes números usam o período.',
      byPlan: 'Por plano',
      plan: 'Plano',
      total: 'Total',
      statuses: 'Estados no Stripe',
      funnelPlan: 'Funil de checkout por plano',
      funnelLanding: 'Funil de checkout por landing page',
      funnelOffer: 'Funil de checkout por oferta',
      started: 'Iniciados',
      completed: 'Pagos',
      open: 'Em aberto',
      conversion: 'Conversão',
    },
    profit: {
      title: 'Lucro real',
      note: (revenue, profit, days) => `Lucro = receita - custo do fornecedor - ${revenue}% de imposto sobre a receita - ${profit}% de imposto sobre o lucro restante. Subscrições: base mensal (MRR a preço de tabela; custo do fornecedor da utilização incluída nos últimos ${days} dias, proporcional a 30 dias). API e excedente: utilização real do período.`,
      subsTitle: 'Subscrições por mês, por plano e tipo de faturação',
      type: 'Plano / faturação',
      subscriptions: 'Subscrições',
      revenue: 'Receita',
      cost: 'Custo do fornecedor',
      revenueTax: 'Imposto sobre a receita',
      fee: 'Taxas de pagamento',
      feeAuto: 'medida',
      feeSource: (pct, source) => `Taxas de pagamento de ${pct}% (${source === 'stripe' ? 'medida no Stripe neste período' : source === 'override' ? 'digitada manualmente' : 'valor padrão configurado, sem pagamentos no período'}).`,
      profitTax: 'Imposto sobre o lucro',
      regime: 'Regime tributário',
      regimes: { simples: 'Simples (Anexo III)', presumido: 'Lucro Presumido', real: 'Lucro Real' },
      applyTax: 'Aplicar alíquotas',
      profit: 'Lucro',
      margin: 'Margem',
      perSub: 'Lucro / subscrição',
      total: 'Total',
      annual: 'Lucro anual (x12)',
      apiTitle: 'Utilização pura da API (créditos pré-pagos) no período',
      apiNote: 'Receita a preço de tabela da utilização por chaves de API, sem contar subscrições.',
      overageTitle: 'Excedente de subscritores (por utilização, créditos pré-pagos) no período',
      requests: 'Pedidos',
      orgs: 'Organizações',
      monthlyProfit: 'Lucro mensal (subscrições)',
      apiProfit: 'Lucro da API (período)',
    },
    refund: {
      open: 'Na janela de reembolso',
      refunded: 'Reembolsadas no período',
      rate: 'Taxa de reembolso',
      byKind: 'Janelas de reembolso por duração',
      kind: 'Janela',
      openNow: 'Abertas agora',
      closingSoon: 'Fecham em 48h',
      opened: 'Abertas no período',
      byPlan: 'Na janela de reembolso por plano',
      byKindPlan: 'Na janela de reembolso por duração e plano',
      byCountry: 'Na janela de reembolso por país',
      count: 'Subscrições',
      note: 'Taxa de reembolso = janelas reembolsadas no período / janelas abertas no período.',
    },
    buyers: {
      title: 'Compradores das subscrições ativas',
      kind: 'Comprador',
      kinds: { business: 'Empresa (NIF / VAT)', individual: 'Particular', unknown: 'Não identificado (antes da recolha)' },
      count: 'Subscrições',
      mrr: 'MRR',
      countries: 'Por país de faturação',
      taxIds: 'Por tipo de documento',
      note: 'O checkout pergunta se a compra é para empresa e recolhe o número fiscal (NIF, VAT...) e a morada de faturação.',
    },
    nfse: {
      environment: 'Ambiente',
      codes: 'Códigos',
      series: 'série',
      certificate: 'Certificado A1',
      expires: 'expira em',
      expiring: 'O certificado A1 expira em menos de 30 dias: renove-o e atualize os ficheiros PEM.',
      disabled: 'Emissor desligado (NFSE_ENABLED=0). As faturas pagas ficam em fila e serão emitidas quando for ligado.',
      status: 'Estado',
      all: 'Todas',
      cols: ['Pago em', 'Estado', 'Número', 'Adquirente', 'Valor', 'Último erro', 'Ações'],
      retry: 'Reenviar',
      cancel: 'Cancelar nota',
      cancelPrompt: 'Motivo do cancelamento (mínimo de 15 caracteres):',
      done: 'Feito.',
    },
    intent: { title: 'Interesse em subscrever (cliques nos CTAs) por plano', byPage: 'Cliques em subscrever por página', clicks: 'Cliques' },
  },
};

/**
 * Formats milliseconds as `1h 2m`, `3m 4s`, or `5s`.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Formats a percentage value with at most one decimal.
 */
export function formatPct(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

/**
 * Change against the previous period: relative percent for amounts, percentage points for rates.
 */
export function formatDelta(current: number, previous: number, isRate: boolean): string | null {
  if (isRate) {
    const points = Math.round((current - previous) * 10) / 10;
    return `${points > 0 ? '+' : ''}${points} p.p.`;
  }
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${change > 0 ? '+' : ''}${change}%`;
}

/**
 * `YYYY-MM-DD` of a date in UTC (the server buckets days in UTC).
 */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
