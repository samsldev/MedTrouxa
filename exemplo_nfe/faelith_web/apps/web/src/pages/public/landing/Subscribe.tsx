/**
 * @fileoverview One-click subscribe bridge: sign up if needed, then open Stripe Checkout for a plan.
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
 * - `/subscribe?plan=&interval=&offer=&lp=`: the landing CTAs point here
 * - Signed-out visitors go to /signup and come back here (`next`), so the purchase
 *   continues right after the account exists
 * - Signed-in visitors are sent straight to Stripe Checkout for the chosen plan, as if
 *   they had picked it on /pricing; a refused intro offer falls back to /pricing
 */

import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ApiError, startCheckout } from '../../../lib/api';
import { useAuth } from '../../../lib/AuthContext';
import type { BillingInterval, PlanId } from '../../../lib/types';
import { isLandingLocale, type LandingLocale } from './copy';
import { OFFER_COPY } from './offerCopy';

const PLANS: readonly PlanId[] = ['starter', 'pro', 'max', 'ultra', 'scale'];

/** Locale from the landing tag suffix (`code-2-br` -> br), English otherwise. */
function tagLocale(tag: string | null): LandingLocale {
  const suffix = tag?.split('-').pop();
  return isLandingLocale(suffix) ? suffix : 'en';
}

/**
 * Resolves auth, then starts checkout once; renders a short status meanwhile.
 */
export function SubscribePage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const plan = PLANS.find((id) => id === params.get('plan')) ?? 'starter';
  const interval: BillingInterval = params.get('interval') === 'yearly' ? 'yearly' : 'monthly';
  const offer = params.get('offer') === 'intro' ? 'intro' : undefined;
  const lp = params.get('lp') ?? undefined;
  const copy = OFFER_COPY[tagLocale(lp ?? null)];

  useEffect(() => {
    if (loading || !user || started.current) return;
    started.current = true;
    startCheckout({ kind: 'subscription', plan, interval, offer, lp })
      .then((url) => window.location.assign(url))
      .catch((failure: unknown) => {
        const refused = offer && failure instanceof ApiError && failure.status === 409;
        setError(refused ? copy.unavailable : copy.checkoutFailed);
      });
  }, [loading, user, plan, interval, offer, lp, copy]);

  if (!loading && !user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/signup?next=${encodeURIComponent(next)}`} replace />;
  }

  return (
    <div className="page-narrow" style={{ paddingTop: 120, textAlign: 'center' }}>
      {error ? (
        <>
          <p className="notice notice-error">{error}</p>
          <p style={{ marginTop: 20 }}>
            <Link className="btn btn-primary" to={`/pricing${lp ? `?lp=${encodeURIComponent(lp)}` : ''}`}>
              {copy.explorePlans}
            </Link>
          </p>
        </>
      ) : (
        <p className="lede">{copy.redirecting}</p>
      )}
    </div>
  );
}
