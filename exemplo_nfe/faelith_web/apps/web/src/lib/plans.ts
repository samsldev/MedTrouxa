/**
 * @fileoverview Catalog of paid Faelith plans (monthly and yearly) and public model rate cards.
 * @author Samuel S. L.
 * @version 1.9.0
 * @since 2026-09-06
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
 * - Encodes Starter through Scale list prices with no Free plan
 * - Yearly prices are 20 percent below twelve monthly payments ($192, $576, $960, $1,920, $4,800)
 * - Documents Code/CLI/Chat sharing one 5h/weekly pool
 * - Lists Echo/Horizon 256k vs 1M list rates (1M is 1.25x 256k)
 * - Horizon has no separate share; it draws from the same 5h/weekly pool as Echo
 */

import { assertNever } from './assertNever';
import type { BillingInterval, PlanId } from './types';

export interface PlanCatalogEntry {
  id: PlanId;
  name: string;
  monthlyUsd: number;
  yearlyUsd: number;
  code5hUsd: number;
  codeWeeklyUsd: number;
  chat5hUsd: number;
  chatWeeklyUsd: number;
}

export interface ModelRateRow {
  id: string;
  family: string;
  window: string;
  cacheReadUsd: number;
  cacheWrite5mUsd: number;
  cacheWrite1hUsd: number;
  inputUsd: number;
  outputUsd: number;
}

/** Yearly billing is a flat 20 percent below twelve monthly payments on every tier. */
export const YEARLY_DISCOUNT_PCT = 20;

/**
 * Returns the ordered paid catalog used by pricing and billing checkout.
 * Yearly amounts are stored explicitly so they match the Stripe price objects exactly.
 */
export function listPlans(): PlanCatalogEntry[] {
  return [
    {
      id: 'starter',
      name: 'Starter',
      monthlyUsd: 20,
      yearlyUsd: 192,
      code5hUsd: 1.38,
      codeWeeklyUsd: 4.6,
      chat5hUsd: 1.38,
      chatWeeklyUsd: 4.6,
    },
    {
      id: 'pro',
      name: 'Pro',
      monthlyUsd: 60,
      yearlyUsd: 576,
      code5hUsd: 3.73,
      codeWeeklyUsd: 13.81,
      chat5hUsd: 3.73,
      chatWeeklyUsd: 13.81,
    },
    {
      id: 'max',
      name: 'Max',
      monthlyUsd: 100,
      yearlyUsd: 960,
      code5hUsd: 5.52,
      codeWeeklyUsd: 23.01,
      chat5hUsd: 5.52,
      chatWeeklyUsd: 23.01,
    },
    {
      id: 'ultra',
      name: 'Ultra',
      monthlyUsd: 200,
      yearlyUsd: 1920,
      code5hUsd: 9.21,
      codeWeeklyUsd: 46.03,
      chat5hUsd: 9.21,
      chatWeeklyUsd: 46.03,
    },
    {
      id: 'scale',
      name: 'Scale',
      monthlyUsd: 500,
      yearlyUsd: 4800,
      code5hUsd: 18.41,
      codeWeeklyUsd: 115.07,
      chat5hUsd: 18.41,
      chatWeeklyUsd: 115.07,
    },
  ];
}

/**
 * Returns the amount charged per billing cycle for a plan and interval.
 */
export function planCycleUsd(plan: PlanCatalogEntry, interval: BillingInterval): number {
  switch (interval) {
    case 'monthly':
      return plan.monthlyUsd;
    case 'yearly':
      return plan.yearlyUsd;
    default:
      return assertNever(interval, 'billing interval');
  }
}

/**
 * Returns the effective per-month cost, which is what buyers compare across intervals.
 */
export function planEffectiveMonthlyUsd(plan: PlanCatalogEntry, interval: BillingInterval): number {
  switch (interval) {
    case 'monthly':
      return plan.monthlyUsd;
    case 'yearly':
      return plan.yearlyUsd / 12;
    default:
      return assertNever(interval, 'billing interval');
  }
}

/**
 * Returns the whole-dollar amount saved per year by choosing yearly over monthly.
 */
export function planYearlySavingsUsd(plan: PlanCatalogEntry): number {
  return plan.monthlyUsd * 12 - plan.yearlyUsd;
}

/**
 * Returns the yearly discount percentage shared by every tier.
 */
export function yearlyDiscountPct(): number {
  return YEARLY_DISCOUNT_PCT;
}

/**
 * Maps a plan id to its marketing display name.
 */
export function planDisplayName(plan: PlanId): string {
  switch (plan) {
    case 'starter':
      return 'Starter';
    case 'pro':
      return 'Pro';
    case 'max':
      return 'Max';
    case 'ultra':
      return 'Ultra';
    case 'scale':
      return 'Scale';
    default:
      return assertNever(plan, 'plan');
  }
}

/**
 * Returns list rates in USD per 1M tokens. 1M aliases are 1.25x 256k.
 */
export function listModelRates(): ModelRateRow[] {
  return [
    {
      id: 'echo',
      family: 'Echo',
      window: '256k',
      cacheReadUsd: 0.2,
      cacheWrite5mUsd: 0.3,
      cacheWrite1hUsd: 0.375,
      inputUsd: 0.25,
      outputUsd: 0.75,
    },
    {
      id: 'echo1m',
      family: 'Echo',
      window: '1M',
      cacheReadUsd: 0.25,
      cacheWrite5mUsd: 0.375,
      cacheWrite1hUsd: 0.46875,
      inputUsd: 0.3125,
      outputUsd: 0.9375,
    },
    {
      id: 'horizon',
      family: 'Horizon',
      window: '256k',
      cacheReadUsd: 0.35,
      cacheWrite5mUsd: 0.6,
      cacheWrite1hUsd: 0.75,
      inputUsd: 0.5,
      outputUsd: 1.4,
    },
    {
      id: 'horizon1m',
      family: 'Horizon',
      window: '1M',
      cacheReadUsd: 0.4375,
      cacheWrite5mUsd: 0.75,
      cacheWrite1hUsd: 0.9375,
      inputUsd: 0.625,
      outputUsd: 1.75,
    },
  ];
}
