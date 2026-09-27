/**
 * @fileoverview Website admin console API: organization lookup and support actions (keys, plans, credits, resets, suspension).
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
 * - Access: signed-in user whose email is in ADMIN_EMAILS and who has an authenticator app (TOTP) enabled;
 *   everyone else gets 404 so the console's existence is not revealed
 * - Every mutation passes CSRF, a fresh reauthentication (`always`), and is written to the audit log
 * - Mirrors faelith_api/scripts (New-TestKey, Revoke-Key, Set-Subscription, Grant-Credits, Show-Org);
 *   plan changes here do not touch Stripe, exactly like the scripts
 */

use crate::audit_store::AuditEntry;
use crate::auth::normalize_email;
use crate::refunds::{open_window, window_json};
use crate::routes::{csrf_origin, err, require_user, usage_payload};
use crate::security::{require_reauth, FactorBody};
use crate::AppState;
use crate::accounts::UserRecord;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use faelith_core::auth::issue_key;
use faelith_core::store::{ApiKeyRecord, OrgSubscription};
use faelith_core::{KeyPurpose, PlanTier};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// Largest credit adjustment per action (USD), a guard against typos.
const MAX_CREDIT_ADJUST_USD: f64 = 10_000.0;

/// Resolves the signed-in admin, or the response to return (404 for non-admins, 403 without TOTP).
pub(crate) async fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<UserRecord, Response> {
    let user = require_user(state, headers).await?;
    let email = normalize_email(&user.email);
    if !state.config.admin_emails.iter().any(|admin| *admin == email) {
        return Err(err(StatusCode::NOT_FOUND, "not found"));
    }
    let mfa = state
        .security
        .get_mfa(user.id)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "mfa lookup failed"))?;
    if !mfa.totp_enabled() {
        return Err(err(StatusCode::FORBIDDEN, "admin access requires an authenticator app (TOTP) enabled in Settings"));
    }
    Ok(user)
}

/// Admin gate for mutations: CSRF, admin, then a fresh reauthentication proof.
async fn require_admin_action(state: &AppState, headers: &HeaderMap, proof: Option<&FactorBody>) -> Result<UserRecord, Response> {
    csrf_origin(state, headers)?;
    let admin = require_admin(state, headers).await?;
    require_reauth(state, &admin, proof, true).await?;
    Ok(admin)
}

/// Appends an audit entry; a failed write is logged but never undoes the action already applied.
async fn audit(state: &AppState, admin: &UserRecord, action: &str, target_org: Option<Uuid>, detail: Value) {
    let entry = AuditEntry { admin_email: admin.email.clone(), action: action.to_string(), target_org, detail, at: Utc::now() };
    if let Err(error) = state.audit.record(&entry).await {
        tracing::error!(error = %error, action, "admin audit write failed");
    }
}

/// GET /api/admin/me — 200 for admins (the SPA uses it to show the console).
pub async fn me(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match require_admin(&state, &headers).await {
        Ok(admin) => Json(json!({ "admin": true, "email": admin.email })).into_response(),
        Err(response) => response,
    }
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    q: String,
}

/// GET /api/admin/orgs/search?q= — by account email, organization id, or 8-hex key prefix.
pub async fn search(State(state): State<AppState>, headers: HeaderMap, Query(query): Query<SearchQuery>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let q = query.q.trim();
    let org_id = if q.contains('@') {
        state.accounts.get_user_by_email(&normalize_email(q)).await.ok().flatten().map(|user| user.org_id)
    } else if let Ok(id) = Uuid::parse_str(q) {
        Some(id)
    } else if q.len() == 8 && q.chars().all(|c| c.is_ascii_hexdigit()) {
        state.store.get_key_by_prefix(&q.to_ascii_lowercase()).await.ok().flatten().map(|key| key.org_id)
    } else {
        return err(StatusCode::BAD_REQUEST, "search by email, organization id, or 8-character key prefix");
    };
    let mut results = Vec::new();
    if let Some(org_id) = org_id {
        let user = state.accounts.list_users_for_org(org_id).await.unwrap_or_default().into_iter().next();
        results.push(json!({
            "org_id": org_id,
            "email": user.as_ref().map(|u| u.email.clone()),
            "name": user.as_ref().map(|u| u.name.clone()),
        }));
    }
    Json(json!({ "results": results })).into_response()
}

/// GET /api/admin/orgs/{id} — everything support needs about one organization.
pub async fn org_detail(State(state): State<AppState>, headers: HeaderMap, Path(org_id): Path<Uuid>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let store = state.store.as_ref();
    let users = state.accounts.list_users_for_org(org_id).await.unwrap_or_default();
    let sub = store.get_subscription(org_id).await.ok().flatten();
    let balance = store.credit_balance(org_id).await.unwrap_or(0);
    let keys = store.list_keys_for_org(org_id).await.unwrap_or_default();
    let suspended = store.is_org_suspended(org_id).await.unwrap_or(false);
    let intro = store.get_intro_offer(org_id).await.ok().flatten();
    let retention = store.latest_retention_offer(org_id).await.ok().flatten();
    let now = Utc::now();
    Json(json!({
        "org_id": org_id,
        "account": users.first().map(|u| json!({ "email": u.email, "name": u.name, "user_id": u.id })),
        "users": users.iter().map(|u| json!({ "email": u.email, "name": u.name, "user_id": u.id })).collect::<Vec<Value>>(),
        "subscription": sub.map(|s| json!({
            "plan": s.plan.map(PlanTier::as_str),
            "status": s.status,
            "usage_based": s.usage_based,
            "stripe_customer_id": s.stripe_customer_id,
            "stripe_subscription_id": s.stripe_subscription_id,
        })),
        "credits_usd": balance as f64 / 1_000_000.0,
        "suspended": suspended,
        "refund": window_json(open_window(&state, org_id).await.as_ref()),
        "intro": intro.map(|offer| json!({ "until": offer.intro_until.to_rfc3339(), "active": offer.is_active(now) })),
        "retention": retention.map(|offer| json!({
            "accepted_at": offer.accepted_at.to_rfc3339(),
            "starts_at": offer.starts_at.to_rfc3339(),
            "ends_at": offer.ends_at.to_rfc3339(),
            "active": offer.is_active(now),
        })),
        "keys": keys.iter().map(|key| json!({
            "prefix": key.prefix, "purpose": key.purpose.as_str(), "rpm": key.rpm, "tpm": key.tpm, "revoked": key.revoked,
        })).collect::<Vec<Value>>(),
        "usage": usage_payload(&state, org_id).await,
    }))
    .into_response()
}

#[derive(Debug, Deserialize)]
pub struct AdminKeyBody {
    purpose: String,
    rpm: Option<u32>,
    tpm: Option<u32>,
    reauth: Option<FactorBody>,
}

/// POST /api/admin/orgs/{id}/keys — issues a key for the org; the plaintext is returned once.
pub async fn create_key(State(state): State<AppState>, headers: HeaderMap, Path(org_id): Path<Uuid>, Json(body): Json<AdminKeyBody>) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    let Some(purpose) = KeyPurpose::parse(&body.purpose) else {
        return err(StatusCode::BAD_REQUEST, "purpose must be code, chat, or api");
    };
    let rpm = body.rpm.unwrap_or(60).clamp(1, 100_000);
    let tpm = body.tpm.unwrap_or(1_000_000).clamp(1_000, 100_000_000);
    let Ok(issued) = issue_key(&state.config.pepper) else {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "key issue failed");
    };
    let record = ApiKeyRecord {
        id: Uuid::new_v4(),
        org_id,
        prefix: issued.prefix.clone(),
        hmac_hex: issued.hmac_hex,
        rpm,
        tpm,
        revoked: false,
        purpose,
    };
    if state.store.insert_key(record).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "key persist failed");
    }
    audit(&state, &admin, "keys.create", Some(org_id), json!({ "prefix": issued.prefix, "purpose": purpose.as_str(), "rpm": rpm, "tpm": tpm })).await;
    Json(json!({ "prefix": issued.prefix, "purpose": purpose.as_str(), "plaintext": issued.plaintext })).into_response()
}

/// Body for actions whose only input is the reauthentication proof.
#[derive(Debug, Default, Deserialize)]
pub struct AdminProofBody {
    reauth: Option<FactorBody>,
}

/// POST /api/admin/keys/{prefix}/revoke — revokes any key by its prefix.
pub async fn revoke_key(State(state): State<AppState>, headers: HeaderMap, Path(prefix): Path<String>, Json(body): Json<AdminProofBody>) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    let Some(key) = state.store.get_key_by_prefix(&prefix).await.ok().flatten() else {
        return err(StatusCode::NOT_FOUND, "no key with that prefix");
    };
    match state.store.revoke_key(&prefix).await {
        Ok(revoked) => {
            audit(&state, &admin, "keys.revoke", Some(key.org_id), json!({ "prefix": prefix })).await;
            Json(json!({ "revoked": revoked })).into_response()
        }
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "revoke failed"),
    }
}

#[derive(Debug, Deserialize)]
pub struct AdminSubscriptionBody {
    /// Plan id, or null to clear the plan.
    plan: Option<String>,
    #[serde(default)]
    usage_based: bool,
    reauth: Option<FactorBody>,
}

/// POST /api/admin/orgs/{id}/subscription — sets an active plan or clears it (no Stripe call).
pub async fn set_subscription(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(org_id): Path<Uuid>,
    Json(body): Json<AdminSubscriptionBody>,
) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    let plan = match body.plan.as_deref() {
        None => None,
        Some(raw) => match PlanTier::parse(raw) {
            Some(plan) => Some(plan),
            None => return err(StatusCode::BAD_REQUEST, "unknown plan"),
        },
    };
    let existing = state.store.get_subscription(org_id).await.ok().flatten();
    let record = OrgSubscription {
        org_id,
        stripe_customer_id: existing.as_ref().and_then(|row| row.stripe_customer_id.clone()),
        stripe_subscription_id: plan.and(existing.as_ref().and_then(|row| row.stripe_subscription_id.clone())),
        plan,
        status: if plan.is_some() { "active" } else { "canceled" }.to_string(),
        usage_based: plan.is_some() && body.usage_based,
    };
    if state.store.upsert_subscription(record).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "subscription update failed");
    }
    let plan_name = plan.map(PlanTier::as_str);
    audit(&state, &admin, "subscription.set", Some(org_id), json!({ "plan": plan_name, "usage_based": body.usage_based })).await;
    Json(json!({ "plan": plan_name, "status": if plan.is_some() { "active" } else { "canceled" } })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct AdminCreditsBody {
    /// Positive grants, negative removes (never below zero).
    usd: f64,
    reauth: Option<FactorBody>,
}

/// POST /api/admin/orgs/{id}/credits — grants or removes prepaid credits.
pub async fn adjust_credits(State(state): State<AppState>, headers: HeaderMap, Path(org_id): Path<Uuid>, Json(body): Json<AdminCreditsBody>) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    if !body.usd.is_finite() || body.usd == 0.0 || body.usd.abs() > MAX_CREDIT_ADJUST_USD {
        return err(StatusCode::BAD_REQUEST, "usd must be non-zero and at most 10000 in absolute value");
    }
    let micros = (body.usd * 1_000_000.0).round() as i64;
    let result = if micros > 0 {
        state.store.grant_credits(org_id, micros).await.map(|_| micros)
    } else {
        state.store.deduct_credits(org_id, -micros).await.map(|removed| -removed)
    };
    let Ok(applied) = result else {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "credit update failed");
    };
    let balance = state.store.credit_balance(org_id).await.unwrap_or(0);
    audit(&state, &admin, "credits.adjust", Some(org_id), json!({ "requested_usd": body.usd, "applied_usd": applied as f64 / 1_000_000.0 })).await;
    Json(json!({ "applied_usd": applied as f64 / 1_000_000.0, "balance_usd": balance as f64 / 1_000_000.0 })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct AdminReasonBody {
    reason: String,
    reauth: Option<FactorBody>,
}

/// Validates a free-text reason (1..=200 characters after trimming).
fn valid_reason(raw: &str) -> Option<String> {
    let reason = raw.trim();
    (!reason.is_empty() && reason.chars().count() <= 200).then(|| reason.to_string())
}

/// POST /api/admin/orgs/{id}/usage-reset — grants one redeemable usage reset.
pub async fn grant_usage_reset(State(state): State<AppState>, headers: HeaderMap, Path(org_id): Path<Uuid>, Json(body): Json<AdminReasonBody>) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    let Some(reason) = valid_reason(&body.reason) else {
        return err(StatusCode::BAD_REQUEST, "reason must be 1 to 200 characters");
    };
    match state.store.grant_usage_reset_to_org(org_id, &reason, &admin.email).await {
        Ok(campaign_id) => {
            audit(&state, &admin, "usage_reset.grant", Some(org_id), json!({ "reason": reason, "campaign_id": campaign_id })).await;
            Json(json!({ "campaign_id": campaign_id })).into_response()
        }
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "usage reset grant failed"),
    }
}

/// POST /api/admin/orgs/{id}/suspend — blocks every key and purchase of the org.
pub async fn suspend(State(state): State<AppState>, headers: HeaderMap, Path(org_id): Path<Uuid>, Json(body): Json<AdminReasonBody>) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    let Some(reason) = valid_reason(&body.reason) else {
        return err(StatusCode::BAD_REQUEST, "reason must be 1 to 200 characters");
    };
    if state.store.suspend_org(org_id, &reason).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "suspend failed");
    }
    audit(&state, &admin, "org.suspend", Some(org_id), json!({ "reason": reason })).await;
    Json(json!({ "suspended": true })).into_response()
}

/// POST /api/admin/orgs/{id}/unsuspend — lifts a suspension.
pub async fn unsuspend(State(state): State<AppState>, headers: HeaderMap, Path(org_id): Path<Uuid>, Json(body): Json<AdminProofBody>) -> Response {
    let admin = match require_admin_action(&state, &headers, body.reauth.as_ref()).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    match state.store.unsuspend_org(org_id).await {
        Ok(lifted) => {
            audit(&state, &admin, "org.unsuspend", Some(org_id), json!({ "lifted": lifted })).await;
            Json(json!({ "suspended": false, "lifted": lifted })).into_response()
        }
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "unsuspend failed"),
    }
}

/// GET /api/admin/audit — latest 200 admin actions.
pub async fn audit_log(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    match state.audit.list(200).await {
        Ok(entries) => Json(json!({
            "entries": entries.iter().map(|entry| json!({
                "admin_email": entry.admin_email,
                "action": entry.action,
                "target_org": entry.target_org,
                "detail": entry.detail,
                "at": entry.at.to_rfc3339(),
            })).collect::<Vec<Value>>(),
        }))
        .into_response(),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "audit query failed"),
    }
}
