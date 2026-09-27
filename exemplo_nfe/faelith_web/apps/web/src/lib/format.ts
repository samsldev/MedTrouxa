/**
 * @fileoverview Display formatters for USD micros, meters, and OAuth labels.
 * @author Samuel S. L.
 * @version 1.2.5
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
 * - Converts integer USD micros into en-US currency strings
 * - Renders meter percentages without dividing by zero
 * - Labels OAuth providers for settings and login
 */

import { assertNever } from './assertNever';
import type { MeterBar, OAuthProvider } from './types';

/**
 * Formats a USD micros integer as an en-US currency string.
 */
export function formatUsdMicros(micros: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(micros / 1_000_000);
}

/**
 * Formats a dollar amount already expressed in USD.
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 1 ? 0 : 2,
  }).format(amount);
}

/**
 * Formats an allowance that must keep cents (5h / weekly caps).
 */
export function formatUsdAllowance(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a list rate with exactly three decimals for display ($0.150, $0.313).
 * Display only: billing uses the exact micro-dollar card on the server.
 */
export function formatUsdRate(amount: number): string {
  return `$${amount.toFixed(3)}`;
}

/**
 * Returns a 0-100 width for a usage bar, treating a zero limit as empty.
 */
export function meterPercent(bar: MeterBar): number {
  if (bar.limit <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (bar.used / bar.limit) * 100));
}

/**
 * Returns the public OAuth button label for a provider.
 */
export function oauthLabel(provider: OAuthProvider): string {
  switch (provider) {
    case 'github':
      return 'GitHub';
    case 'google':
      return 'Google';
    default:
      return assertNever(provider, 'oauth provider');
  }
}

/**
 * Returns the same-origin path that starts an OAuth handshake via full-page navigation.
 */
export function oauthPath(provider: OAuthProvider): string {
  switch (provider) {
    case 'github':
      return '/auth/github';
    case 'google':
      return '/auth/google';
    default:
      return assertNever(provider, 'oauth provider');
  }
}
