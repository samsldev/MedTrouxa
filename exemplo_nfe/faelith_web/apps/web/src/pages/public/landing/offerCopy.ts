/**
 * @fileoverview Localized copy for the recapture offer (50 percent off the first month) and landing CTAs.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-25
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
 * DETAILED_DESCRIPTION:
 * - Landing CTA labels: subscribe to Starter directly, or explore every plan on /pricing
 * - Recapture page and exit-intent modal copy for pt-BR, pt-PT and en
 * - The fine print states every condition the backend enforces: first subscription only,
 *   monthly only, 50 percent limits in the first month, full price on renewal
 */

import type { LandingLocale } from './copy';

export interface OfferCopy {
  title: string;
  /** Landing hero/pricing CTA pair. */
  subscribeNote: string;
  explorePlans: string;
  kicker: string;
  headline: [string, string];
  lede: string;
  perMonth: string;
  firstMonth: string;
  thenLabel: (price: string) => string;
  claim: (plan: string) => string;
  finePrint: string;
  guarantee: string | null;
  noThanks: string;
  modalTitle: string;
  modalBody: string;
  modalCta: string;
  modalDismiss: string;
  unavailable: string;
  redirecting: string;
  checkoutFailed: string;
}

export const OFFER_COPY: Record<LandingLocale, OfferCopy> = {
  br: {
    title: 'Faelith | 50% de desconto no primeiro mês',
    subscribeNote: 'Plano Starter, US$ 20/mês. Cancela quando quiser.',
    explorePlans: 'Explorar planos',
    kicker: 'Espera! Uma oferta só para você',
    headline: ['Sua primeira assinatura com ', '50% de desconto.'],
    lede: 'Comece pelo Starter por US$ 10 no primeiro mês, em vez de US$ 20. O desconto vale para todos os planos.',
    perMonth: '/mês',
    firstMonth: 'no primeiro mês',
    thenLabel: (price) => `depois ${price}/mês`,
    claim: (plan) => `Garantir 50% no ${plan}`,
    finePrint:
      'Oferta válida apenas na primeira assinatura, no plano mensal. No primeiro mês você paga 50% do plano e os limites de uso também ficam em 50%, com o uso cobrado a preço de custo, então ele rende mais. Depois, a assinatura renova pelo preço normal do plano. Cancele quando quiser.',
    guarantee: 'E ainda com a garantia de 7 dias: reembolso integral pelo site.',
    noThanks: 'Não, obrigado. Prefiro pagar o preço cheio.',
    modalTitle: 'Antes de ir: 50% de desconto',
    modalBody: 'Sua primeira assinatura pela metade do preço no primeiro mês. Em qualquer plano.',
    modalCta: 'Quero 50% de desconto',
    modalDismiss: 'Agora não',
    unavailable: 'A oferta de 50% vale apenas para a primeira assinatura. Veja os planos com preço normal.',
    redirecting: 'Abrindo o pagamento seguro…',
    checkoutFailed: 'Não foi possível abrir o pagamento. Tente de novo.',
  },
  pt: {
    title: 'Faelith | 50% de desconto no primeiro mês',
    subscribeNote: 'Plano Starter, 20 USD/mês. Cancele quando quiser.',
    explorePlans: 'Explorar planos',
    kicker: 'Espere! Uma oferta só para si',
    headline: ['A sua primeira subscrição com ', '50% de desconto.'],
    lede: 'Comece pelo Starter por 10 USD no primeiro mês, em vez de 20 USD. O desconto aplica-se a todos os planos.',
    perMonth: '/mês',
    firstMonth: 'no primeiro mês',
    thenLabel: (price) => `depois ${price}/mês`,
    claim: (plan) => `Garantir 50% no ${plan}`,
    finePrint:
      'Oferta válida apenas na primeira subscrição, no plano mensal. No primeiro mês paga 50% do plano e os limites de utilização também ficam em 50%, com a utilização cobrada a preço de custo, por isso rende mais. Depois, a subscrição renova pelo preço normal do plano. Cancele quando quiser.',
    guarantee: 'E ainda com a garantia de 14 dias: reembolso total no site.',
    noThanks: 'Não, obrigado. Prefiro pagar o preço total.',
    modalTitle: 'Antes de sair: 50% de desconto',
    modalBody: 'A sua primeira subscrição a metade do preço no primeiro mês. Em qualquer plano.',
    modalCta: 'Quero 50% de desconto',
    modalDismiss: 'Agora não',
    unavailable: 'A oferta de 50% aplica-se apenas à primeira subscrição. Veja os planos com o preço normal.',
    redirecting: 'A abrir o pagamento seguro…',
    checkoutFailed: 'Não foi possível abrir o pagamento. Tente novamente.',
  },
  en: {
    title: 'Faelith | 50% off your first month',
    subscribeNote: 'Starter plan, US$20/month. Cancel any time.',
    explorePlans: 'Explore plans',
    kicker: 'Wait! An offer just for you',
    headline: ['Your first subscription at ', '50% off.'],
    lede: 'Start on Starter for US$10 in your first month instead of US$20. The discount applies to every plan.',
    perMonth: '/month',
    firstMonth: 'first month',
    thenLabel: (price) => `then ${price}/month`,
    claim: (plan) => `Claim 50% off ${plan}`,
    finePrint:
      'Valid on your first subscription only, on monthly billing. In the first month you pay 50% of the plan and usage limits are 50% too, with usage metered at cost so it goes further. After that the subscription renews at the regular plan price. Cancel any time.',
    guarantee: null,
    noThanks: 'No thanks, I will pay full price.',
    modalTitle: 'Before you go: 50% off',
    modalBody: 'Your first subscription at half price for the first month. On any plan.',
    modalCta: 'Get 50% off',
    modalDismiss: 'Not now',
    unavailable: 'The 50% offer is only for a first subscription. See the plans at regular price.',
    redirecting: 'Opening secure checkout…',
    checkoutFailed: 'Could not open checkout. Please try again.',
  },
};
