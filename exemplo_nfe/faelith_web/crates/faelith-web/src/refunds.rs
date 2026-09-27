/**
 * @fileoverview Subscription cancellation: statutory full refund inside the window, otherwise cancel at period end.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-24
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
 * - Refund (website only): open window, not already refunded, card fingerprint and email
 *   not on the blocklist; refunds the latest charge in full, cancels the subscription
 *   immediately, revokes every key, and records the card and email
 * - Cancel: stops renewal; access continues until the end of the paid month or year
 * - Credit packs are blocked for subscribers while the window is open
 * - Both actions pass the shared reauth gate and email the owner
 */

use crate::auth::normalize_email;
use crate::routes::{csrf_origin, err, require_user};
use crate::security::{notify_change, require_reauth, FactorBody};
use crate::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use faelith_core::refund::RefundWindow;
use faelith_core::store::OrgSubscription;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Default, Deserialize)]
pub struct BillingActionBody {
    pub reauth: Option<FactorBody>,
}

/// The open refund window of an organization, if any.
pub(crate) async fn open_window(state: &AppState, org_id: Uuid) -> Option<RefundWindow> {
    state
        .store
        .get_refund_window(org_id)
        .await
        .ok()
        .flatten()
        .filter(|window| window.is_open(Utc::now()))
}

/// 403 when the organization is suspended (chargeback); store errors fail closed.
pub(crate) async fn reject_if_suspended(state: &AppState, org_id: Uuid) -> Result<(), Response> {
    match state.store.is_org_suspended(org_id).await {
        Ok(false) => Ok(()),
        Ok(true) => Err(err(StatusCode::FORBIDDEN, "this account is suspended because of a payment dispute; contact support")),
        Err(_) => Err(err(StatusCode::INTERNAL_SERVER_ERROR, "account check failed")),
    }
}

/// JSON for the Billing page: when the full refund is available and until when.
pub(crate) fn window_json(window: Option<&RefundWindow>) -> Value {
    match window {
        Some(window) => json!({ "available": true, "closes_at": window.closes_at.to_rfc3339() }),
        None => json!({ "available": false }),
    }
}

/// POST /api/billing/refund — full statutory refund inside the window.
pub async fn refund(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BillingActionBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if open_window(&state, user.org_id).await.is_none() {
        return err(StatusCode::CONFLICT, "the refund period for this subscription has ended");
    }
    if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), true).await {
        return response;
    }
    let Some(sub) = state.store.get_subscription(user.org_id).await.ok().flatten() else {
        return err(StatusCode::CONFLICT, "no active subscription");
    };
    let (Some(customer), Some(subscription_id)) = (sub.stripe_customer_id.clone(), sub.stripe_subscription_id.clone()) else {
        return err(StatusCode::CONFLICT, "no active subscription");
    };
    let charge = match state.stripe.latest_charge(&customer).await {
        Ok(Some(charge)) => charge,
        Ok(None) => return err(StatusCode::CONFLICT, "no payment to refund"),
        Err(error) => {
            tracing::error!(error = %error, "stripe charge lookup failed");
            return err(StatusCode::BAD_GATEWAY, "could not reach the payment provider; try again");
        }
    };
    let email = normalize_email(&user.email);
    match state.store.refund_blocked(charge.fingerprint.as_deref(), &email).await {
        Ok(false) => {}
        Ok(true) => {
            return err(
                StatusCode::FORBIDDEN,
                "this card or email already received a refund; cancel at the end of the period instead or contact support",
            )
        }
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "refund check failed"),
    }
    if let Err(error) = state.stripe.refund_charge(&charge.id).await {
        tracing::error!(error = %error, "stripe refund failed");
        return err(StatusCode::BAD_GATEWAY, "the refund could not be processed; try again");
    }
    // The money is back: record the refund first so a later failure cannot allow a second one.
    let _ = state.store.add_refund_block(charge.fingerprint.as_deref(), &email).await;
    let _ = state.store.mark_refunded(user.org_id).await;
    if let Err(error) = state.stripe.cancel_subscription(&subscription_id).await {
        tracing::error!(error = %error, "subscription cancel after refund failed");
    }
    if let Ok(keys) = state.store.list_keys_for_org(user.org_id).await {
        for key in keys.iter().filter(|key| !key.revoked) {
            let _ = state.store.revoke_key(&key.prefix).await;
        }
    }
    let _ = state
        .store
        .upsert_subscription(OrgSubscription { status: "canceled".to_string(), usage_based: false, ..sub })
        .await;
    notify_change(&state, &user.email, "your subscription was cancelled and fully refunded");
    Json(json!({ "refunded": true })).into_response()
}

/// POST /api/billing/cancel — no refund; access continues until the paid period ends.
pub async fn cancel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BillingActionBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), false).await {
        return response;
    }
    let Some(subscription_id) = state
        .store
        .get_subscription(user.org_id)
        .await
        .ok()
        .flatten()
        .filter(|sub| sub.active_plan().is_some())
        .and_then(|sub| sub.stripe_subscription_id)
    else {
        return err(StatusCode::CONFLICT, "no active subscription");
    };
    if let Err(error) = state.stripe.cancel_at_period_end(&subscription_id).await {
        tracing::error!(error = %error, "stripe cancel failed");
        return err(StatusCode::BAD_GATEWAY, "could not reach the payment provider; try again");
    }
    notify_change(&state, &user.email, "your subscription will end at the close of the current billing period");
    Json(json!({ "canceled_at_period_end": true })).into_response()
}
