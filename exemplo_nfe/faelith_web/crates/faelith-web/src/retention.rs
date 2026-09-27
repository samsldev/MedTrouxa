/**
 * @fileoverview Retention offer: 50 percent off the next month for monthly subscribers who try to cancel.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Shown when a monthly subscriber clicks cancel after the refund window closed
 * - Same rules as the landing intro offer: the discounted month halves the allowances
 *   and meters included usage at upstream cost (via `faelith_core::intro_active`)
 * - Accepting puts the one-time intro coupon on the next renewal, clears a pending
 *   cancel, and starts a two-month cooldown before the offer can be shown again
 * - Declining costs nothing: the offer stays available on the next cancel attempt
 */

use crate::refunds::{open_window, reject_if_suspended};
use crate::routes::{csrf_origin, err, require_user};
use crate::security::notify_change;
use crate::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Duration, Months, Utc};
use faelith_core::store::{IntroOffer, RetentionOffer};
use serde_json::json;
use uuid::Uuid;

/// How long after an accepted offer (or an intro month) the offer stays hidden.
pub const RETENTION_COOLDOWN: Duration = Duration::days(60);

/// Outcome of the eligibility rules: the renewal the offer would discount, or nothing.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Eligibility {
    /// The offer applies to the billing period that starts at `renews_at`.
    Eligible { subscription_id: String, coupon: String, renews_at: DateTime<Utc> },
    Ineligible,
}

/// True when neither a retention offer nor the intro month was used within the cooldown.
///
/// The intro month counts from its start (`intro_until` minus one month), so an intro
/// buyer sees the retention offer at the earliest two months after that purchase.
fn cooldown_over(latest: Option<&RetentionOffer>, intro: Option<&IntroOffer>, now: DateTime<Utc>) -> bool {
    let retention_ok = latest.is_none_or(|offer| offer.accepted_at + RETENTION_COOLDOWN <= now);
    let intro_ok = intro.is_none_or(|offer| {
        let started = offer.intro_until.checked_sub_months(Months::new(1)).unwrap_or(offer.intro_until);
        started + RETENTION_COOLDOWN <= now
    });
    retention_ok && intro_ok
}

/// Evaluates every eligibility rule: intro coupon configured, not suspended, refund
/// window closed, active plan, cooldown over, and a monthly Stripe cycle with a future
/// renewal. Any store or Stripe failure yields `Ineligible`, so the offer can never
/// block the cancel flow.
async fn evaluate(state: &AppState, org_id: Uuid) -> Eligibility {
    let Some(coupon) = state.config.stripe_intro_coupon.clone() else {
        return Eligibility::Ineligible;
    };
    if reject_if_suspended(state, org_id).await.is_err() || open_window(state, org_id).await.is_some() {
        return Eligibility::Ineligible;
    }
    let Some(subscription_id) = state
        .store
        .get_subscription(org_id)
        .await
        .ok()
        .flatten()
        .filter(|sub| sub.active_plan().is_some())
        .and_then(|sub| sub.stripe_subscription_id)
    else {
        return Eligibility::Ineligible;
    };
    let (Ok(latest), Ok(intro)) = (
        state.store.latest_retention_offer(org_id).await,
        state.store.get_intro_offer(org_id).await,
    ) else {
        return Eligibility::Ineligible;
    };
    let now = Utc::now();
    if !cooldown_over(latest.as_ref(), intro.as_ref(), now) {
        return Eligibility::Ineligible;
    }
    let billing = match state.stripe.subscription_billing(&subscription_id).await {
        Ok(billing) => billing,
        Err(error) => {
            tracing::warn!(error = %error, "retention offer billing lookup failed");
            return Eligibility::Ineligible;
        }
    };
    let renews_at = billing.current_period_end.and_then(|secs| DateTime::from_timestamp(secs, 0));
    match (billing.interval.as_deref(), renews_at) {
        (Some("month"), Some(renews_at)) if renews_at > now => {
            Eligibility::Eligible { subscription_id, coupon, renews_at }
        }
        _ => Eligibility::Ineligible,
    }
}

/// GET /api/billing/retention — whether the cancel flow should show the 50 percent offer.
pub async fn retention_offer(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match evaluate(&state, user.org_id).await {
        Eligibility::Eligible { renews_at, .. } => {
            Json(json!({ "eligible": true, "renews_at": renews_at.to_rfc3339() })).into_response()
        }
        Eligibility::Ineligible => Json(json!({ "eligible": false })).into_response(),
    }
}

/// POST /api/billing/retention/accept — discounts the next month and keeps the plan renewing.
///
/// No reauth: accepting only lowers the next charge and cannot move money out.
pub async fn accept_retention_offer(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Eligibility::Eligible { subscription_id, coupon, renews_at } = evaluate(&state, user.org_id).await else {
        return err(StatusCode::CONFLICT, "the retention offer is not available for this subscription");
    };
    let Some(ends_at) = renews_at.checked_add_months(Months::new(1)) else {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "retention period overflow");
    };
    if let Err(error) = state.stripe.apply_retention_coupon(&subscription_id, &coupon).await {
        tracing::error!(error = %error, "stripe retention coupon failed");
        return err(StatusCode::BAD_GATEWAY, "could not reach the payment provider; try again");
    }
    let offer = RetentionOffer { org_id: user.org_id, accepted_at: Utc::now(), starts_at: renews_at, ends_at };
    if let Err(error) = state.store.record_retention_offer(&offer).await {
        // The coupon is already on Stripe; the missing row only relaxes the cooldown.
        tracing::error!(error = ?error, org_id = %user.org_id, "retention offer record failed");
    }
    notify_change(&state, &user.email, "your next month is 50 percent off and your subscription will keep renewing");
    Json(json!({ "accepted": true, "starts_at": renews_at.to_rfc3339(), "ends_at": ends_at.to_rfc3339() }))
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a retention offer accepted `days_ago` days before `now`.
    fn accepted(now: DateTime<Utc>, days_ago: i64) -> RetentionOffer {
        let accepted_at = now - Duration::days(days_ago);
        RetentionOffer { org_id: Uuid::nil(), accepted_at, starts_at: accepted_at, ends_at: accepted_at }
    }

    /// The offer returns only after the two-month cooldown of the last acceptance.
    #[test]
    fn retention_cooldown_is_two_months() {
        let now = Utc::now();
        assert!(cooldown_over(None, None, now));
        assert!(!cooldown_over(Some(&accepted(now, 59)), None, now));
        assert!(cooldown_over(Some(&accepted(now, 60)), None, now));
    }

    /// An intro month counts as a use of the offer from the day it started.
    #[test]
    fn intro_month_starts_the_cooldown() {
        let now = Utc::now();
        let intro = |days_since_start: i64| IntroOffer {
            org_id: Uuid::nil(),
            email: "a@example.com".into(),
            intro_until: (now - Duration::days(days_since_start)).checked_add_months(Months::new(1)).unwrap(),
        };
        assert!(!cooldown_over(None, Some(&intro(40)), now));
        assert!(cooldown_over(None, Some(&intro(61)), now));
    }
}
