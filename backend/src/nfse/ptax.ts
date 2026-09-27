/**
 * Cotação PTAX (USD/BRL). Port 1:1 de faelith-web/src/nfse/ptax.rs.
 *
 * - Taxa: PTAX de venda (cotacaoVenda) do último dia útil antes da data do pagamento
 *   (volta até 10 dias por fins de semana e feriados); a regra deve ser confirmada pelo contador
 * - Fonte: API OData Olinda do BCB, CotacaoDolarDia (pública, sem autenticação)
 * - A taxa é fixada por cobrança quando a NFS-e é renderizada pela primeira vez e guardada no documento
 * - No MedTrouxa as cobranças são em BRL, então a conversão só é usada se houver cobrança em USD
 */

/** Fonte de cotações USD/BRL. */
export interface ExchangeRates {
  /** PTAX de venda do dia (YYYY-MM-DD), ou null sem cotação (fim de semana ou feriado). */
  ptaxSell(day: string): Promise<number | null>;
}

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Taxa usada para um pagamento feito em `paidOn`: a última cotação estritamente anterior a esse dia. */
export async function rateForPayment(rates: ExchangeRates, paidOn: string): Promise<{ day: string; rate: number }> {
  for (let back = 1; back <= 10; back++) {
    const day = addDays(paidOn, -back);
    const rate = await rates.ptaxSell(day);
    if (rate !== null) return { day, rate };
  }
  throw new Error(`nenhuma cotação PTAX nos 10 dias anteriores a ${paidOn}`);
}

/** Converte centavos de USD em centavos de BRL pela taxa, arredondando. */
export const usdToBrlCents = (usdCents: number, rate: number) => Math.round(usdCents * rate);

/** Cliente real do serviço PTAX (Olinda, BCB). Docs: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao */
export class BcbPtax implements ExchangeRates {
  async ptaxSell(day: string): Promise<number | null> {
    const [y, m, d] = day.split('-');
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${m}-${d}-${y}'&$top=1&$format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`consulta PTAX falhou com ${res.status}`);
    const body = (await res.json()) as { value?: { cotacaoVenda?: number }[] };
    return typeof body.value?.[0]?.cotacaoVenda === 'number' ? body.value[0].cotacaoVenda : null;
  }
}
