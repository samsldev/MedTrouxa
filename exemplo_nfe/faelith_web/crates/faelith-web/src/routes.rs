/**
 * @fileoverview HTTP handlers for auth, dashboard APIs, contact, and Stripe webhooks.
 * @author Samuel S. L.
 * @version 2.11.0
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
 * <DETAILED_DESCRIPTION>:
 * - Session cookie rotation on login/signup; CSRF Origin+Host check on mutating routes
 * - Password login with 2FA on returns a challenge (security.rs) instead of a session
 * - Overview activity: tokens per UTC day for the last 53 weeks, split into all / chat / code
 * - Subscribers redeem FIFO usage-reset grants at POST /api/usage/reset/redeem
 * - API key plaintext is returned once and never stored
 * - Keys, billing, password, OAuth unlink, and deletion pass the shared reauth gate
 * - Login is rate limited per IP and per account (credential stuffing)
 * - Account deletion revokes keys, cancels Stripe, and queues capture erasure
 */

use crate::accounts::{OAuthProvider, UserRecord};
use crate::auth::{
    hash_password, issue_session, normalize_email, origin_allowed,
    random_token, read_session_token, request_user_agent, session_clear_cookie,
    session_set_cookie, token_hash, verify_password, ClientIp, INVALID_CREDENTIALS,
    MIN_PASSWORD_LEN,
};
use crate::security::{begin_challenge, challenge_response, notify_change, require_reauth, FactorBody};
use crate::config::{BillingInterval, CreditPack};
use crate::limit::{AUTH_LIMIT, AUTH_WINDOW};
use crate::stripe::{
    checkout_urls, fulfill_stripe_event, unix_now, verify_stripe_signature, MAX_CUSTOM_CREDIT_CENTS,
    MIN_CUSTOM_CREDIT_CENTS,
};
use crate::AppState;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{Duration as ChronoDuration, Utc};
use faelith_core::auth::issue_key;
use faelith_core::plans::{KeyPurpose, MeterReport, PlanTier};
use faelith_core::store::{
    attach_usage_reset_json, load_meter_snapshot, ApiKeyRecord, DailyUsage, OrgSubscription,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// JSON error helper used by the SPA.
pub(crate) fn err(status: StatusCode, message: &str) -> axum::response::Response {
    (status, Json(json!({ "error": message }))).into_response()
}

/// JSON 404 for unknown `/api/*` and `/auth/*` paths (never the SPA shell).
pub async fn api_not_found() -> axum::response::Response {
    err(StatusCode::NOT_FOUND, "endpoint not found")
}

/// Issues a session bound to User-Agent and client IP hashes.
pub(crate) async fn issue_session_for(
    state: &AppState,
    user_id: Uuid,
    headers: &HeaderMap,
    ip: &crate::auth::ClientIp,
) -> Result<String, String> {
    issue_session(
        state.accounts.as_ref(),
        user_id,
        request_user_agent(headers),
        Some(ip.as_str()),
    )
    .await
}

/// Rejects cross-site POSTs that advertise a mismatched Origin.
pub(crate) fn csrf_origin(state: &AppState, headers: &HeaderMap) -> Result<(), axum::response::Response> {
    if origin_allowed(headers, &state.config.public_origin) {
        Ok(())
    } else {
        Err(err(StatusCode::FORBIDDEN, "csrf origin mismatch"))
    }
}

/// Loads the authenticated user from the session cookie.
pub(crate) async fn require_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<UserRecord, axum::response::Response> {
    let token = read_session_token(headers, &state.config)
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "not authenticated"))?;
    let session = state
        .accounts
        .get_session_by_hash(&token_hash(&token))
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "session lookup failed"))?
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "not authenticated"))?;
    state
        .accounts
        .get_user_by_id(session.user_id)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "user lookup failed"))?
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "not authenticated"))
}

/// Serializes the SPA session user, including OAuth link flags and plan.
pub(crate) async fn session_json(state: &AppState, user: &UserRecord) -> Value {
    let linked = state
        .accounts
        .list_oauth(user.id)
        .await
        .unwrap_or_default();
    let sub = state.store.get_subscription(user.org_id).await.ok().flatten();
    json!({
        "id": user.id.to_string(),
        "email": user.email,
        "name": user.name,
        "plan": sub.as_ref().and_then(|row| row.active_plan().map(|p| p.as_str())),
        "usage_based": sub.as_ref().map(|row| row.usage_based).unwrap_or(false),
        "githubLinked": linked.iter().any(|p| *p == OAuthProvider::GitHub),
        "googleLinked": linked.iter().any(|p| *p == OAuthProvider::Google),
        "admin": state.config.admin_emails.contains(&crate::auth::normalize_email(&user.email)),
    })
}

#[derive(Debug, Deserialize)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct SettingsBody {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct PasswordBody {
    pub current: Option<String>,
    pub next: String,
    pub reauth: Option<FactorBody>,
}

#[derive(Debug, Deserialize)]
pub struct UnlinkBody {
    pub provider: String,
    pub reauth: Option<FactorBody>,
}

#[derive(Debug, Deserialize)]
pub struct CreateKeyBody {
    pub purpose: String,
    pub reauth: Option<FactorBody>,
}

/// Body for actions whose only input is the reauthentication proof.
#[derive(Debug, Default, Deserialize)]
pub struct ReauthBody {
    pub reauth: Option<FactorBody>,
}

/// Per-account login cap, higher than the per-IP cap so a victim is not
/// trivially locked out while distributed guessing is still bounded.
const LOGIN_ACCOUNT_LIMIT: u32 = 20;

#[derive(Debug, Deserialize)]
pub struct CheckoutBody {
    pub kind: String,
    pub plan: Option<String>,
    pub pack: Option<String>,
    pub interval: Option<String>,
    /// Custom top-up in US cents (`credits_custom` only).
    pub amount_cents: Option<u64>,
    /// `intro`: 50 percent off the first month (monthly subscriptions, first purchase only).
    pub offer: Option<String>,
    /// Campaign landing tag (`code-2-br`); a canceled checkout returns to the recapture page.
    pub lp: Option<String>,
}

/// Accepts a landing tag only when it is short and made of `[a-z0-9-]`.
fn landing_tag(raw: Option<&str>) -> Option<&str> {
    raw.filter(|tag| !tag.is_empty() && tag.len() <= 32 && tag.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'))
}

/// True when the org never had a subscription and neither it nor this email used the intro.
async fn intro_eligible(state: &AppState, org_id: Uuid, email: &str) -> bool {
    let sub = state.store.get_subscription(org_id).await.ok().flatten();
    if sub.as_ref().is_some_and(|row| row.stripe_subscription_id.is_some()) {
        return false;
    }
    if state.store.get_refund_window(org_id).await.ok().flatten().is_some() {
        return false;
    }
    matches!(state.store.intro_offer_claimed(org_id, email).await, Ok(false))
}

#[derive(Debug, Deserialize)]
pub struct UsageBasedBody {
    pub enabled: bool,
    pub reauth: Option<FactorBody>,
}

#[derive(Debug, Deserialize)]
pub struct ContactBody {
    pub name: String,
    pub email: String,
    pub message: String,
    pub csrf: String,
}

/// GET /healthz
pub async fn healthz() -> &'static str {
    "ok"
}

/// GET /auth/me
pub async fn me(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    match require_user(&state, &headers).await {
        Ok(user) => Json(session_json(&state, &user).await).into_response(),
        Err(response) => response,
    }
}

/// POST /auth/login — uniform failure for unknown emails (dummy Argon2 verify).
pub async fn login(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<LoginBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if !state
        .limiter
        .check("login", ip.as_str(), AUTH_LIMIT, AUTH_WINDOW)
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let email = normalize_email(&body.email);
    if !state
        .limiter
        .check("login-account", &email, LOGIN_ACCOUNT_LIMIT, AUTH_WINDOW)
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let user = state
        .accounts
        .get_user_by_email(&email)
        .await
        .ok()
        .flatten();
    let dummy = &state.dummy_hash;
    let ok = verify_password(
        &body.password,
        user.as_ref().and_then(|row| row.password_hash.as_deref()),
        dummy,
    );
    if !ok {
        return err(StatusCode::UNAUTHORIZED, INVALID_CREDENTIALS);
    }
    let user = user.expect("verified");
    if let Some(token) = read_session_token(&headers, &state.config) {
        let _ = state.accounts.delete_session(&token_hash(&token)).await;
    }
    match begin_challenge(&state, user.id).await {
        Ok(Some((challenge, mfa))) => return challenge_response(&state, &challenge, &mfa, &user.email),
        Ok(None) => {}
        Err(error) => {
            tracing::error!(error = %error, "mfa challenge failed");
            return err(StatusCode::INTERNAL_SERVER_ERROR, "session failed");
        }
    }
    let token = match issue_session_for(&state, user.id, &headers, &ip).await {
        Ok(token) => token,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "session failed"),
    };
    let mut response = Json(session_json(&state, &user).await).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_set_cookie(&state.config, &token));
    response
}

/// POST /auth/logout
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(token) = read_session_token(&headers, &state.config) {
        let _ = state.accounts.delete_session(&token_hash(&token)).await;
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_clear_cookie(&state.config));
    response
}

/// GET /api/csrf
pub async fn csrf_token(State(state): State<AppState>) -> impl IntoResponse {
    let token = random_token();
    let expires = Utc::now() + ChronoDuration::hours(1);
    if state
        .accounts
        .insert_csrf(&token_hash(&token), expires)
        .await
        .is_err()
    {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "csrf persist failed");
    }
    Json(json!({ "csrf": token })).into_response()
}

/// POST /api/contact
pub async fn contact(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<ContactBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if !state
        .limiter
        .check("contact", ip.as_str(), AUTH_LIMIT, AUTH_WINDOW)
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let ok = state
        .accounts
        .consume_csrf(&token_hash(&body.csrf))
        .await
        .unwrap_or(false);
    if !ok {
        return err(StatusCode::FORBIDDEN, "invalid csrf token");
    }
    if body.name.trim().is_empty() || body.message.trim().is_empty() {
        return err(StatusCode::BAD_REQUEST, "name and message are required");
    }
    if state
        .accounts
        .insert_contact(body.name.trim(), &normalize_email(&body.email), body.message.trim())
        .await
        .is_err()
    {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "contact persist failed");
    }
    StatusCode::NO_CONTENT.into_response()
}

/// GET /api/overview
pub async fn overview(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let usage = usage_payload(&state, user.org_id).await;
    let sub = state.store.get_subscription(user.org_id).await.ok().flatten();
    let since = Utc::now() - ChronoDuration::days(ACTIVITY_DAYS);
    let daily = state
        .store
        .daily_usage_tokens(user.org_id, since)
        .await
        .unwrap_or_default();
    Json(json!({
        "plan": sub.as_ref().and_then(|row| row.active_plan().map(|p| p.as_str())),
        "usage_based": sub.as_ref().map(|row| row.usage_based).unwrap_or(false),
        "usage": usage,
        "heatmap": usage_heatmap(&daily),
    }))
    .into_response()
}

/// PATCH /api/settings
pub async fn patch_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SettingsBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if state
        .accounts
        .update_name(user.id, body.name.trim())
        .await
        .is_err()
    {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "update failed");
    }
    StatusCode::NO_CONTENT.into_response()
}

/// POST /api/settings/password
pub async fn change_password(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<PasswordBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if body.next.len() < MIN_PASSWORD_LEN {
        return err(StatusCode::BAD_REQUEST, "password must be at least 10 characters");
    }
    if !state.limiter.check("password-change", &user.id.to_string(), AUTH_LIMIT, AUTH_WINDOW).await {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    // OAuth-only accounts have no current password to confirm, so they always
    // prove inbox control; accounts with 2FA also need a second factor.
    if let Err(response) =
        require_reauth(&state, &user, body.reauth.as_ref(), user.password_hash.is_none()).await
    {
        return response;
    }
    if user.password_hash.is_some() {
        let dummy = &state.dummy_hash;
        let current = body.current.as_deref().unwrap_or("");
        if !verify_password(current, user.password_hash.as_deref(), &dummy) {
            return err(StatusCode::UNAUTHORIZED, INVALID_CREDENTIALS);
        }
    }
    let hash = match hash_password(&body.next) {
        Ok(hash) => hash,
        Err(message) => return err(StatusCode::BAD_REQUEST, &message),
    };
    if state
        .accounts
        .set_password_hash(user.id, Some(hash))
        .await
        .is_err()
    {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "password update failed");
    }
    let _ = state.accounts.delete_sessions_for_user(user.id).await;
    notify_change(&state, &user.email, "your password was changed and other sessions were signed out");
    let token = match issue_session_for(&state, user.id, &headers, &ip).await {
        Ok(token) => token,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "session failed"),
    };
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_set_cookie(&state.config, &token));
    response
}

/// POST /api/settings/oauth/unlink
pub async fn unlink_oauth(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<UnlinkBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(provider) = OAuthProvider::parse(&body.provider) else {
        return err(StatusCode::BAD_REQUEST, "unknown provider");
    };
    let linked = match state.accounts.list_oauth(user.id).await {
        Ok(linked) => linked,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "unlink failed"),
    };
    let other_logins = linked.iter().filter(|item| **item != provider).count();
    if user.password_hash.is_none() && other_logins == 0 {
        return err(
            StatusCode::CONFLICT,
            "set a password or link another sign-in method before unlinking this one",
        );
    }
    if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), false).await {
        return response;
    }
    if state
        .accounts
        .unlink_oauth(user.id, provider)
        .await
        .is_err()
    {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "unlink failed");
    }
    notify_change(&state, &user.email, &format!("{} sign-in was unlinked", body.provider.trim()));
    StatusCode::NO_CONTENT.into_response()
}

/// DELETE /api/account
///
/// Always reauthenticates, then tears down everything that outlives the user
/// row: API keys are revoked (they belong to the organization), the Stripe
/// subscription is cancelled so billing stops, and model I/O captures are
/// queued for erasure in the capture database.
pub async fn delete_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ReauthBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), true).await {
        return response;
    }
    let subscription = state.store.get_subscription(user.org_id).await.ok().flatten();
    if let Some(subscription_id) = subscription.and_then(|row| row.stripe_subscription_id) {
        if let Err(error) = state.stripe.cancel_subscription(&subscription_id).await {
            tracing::error!(error = %error, "subscription cancel failed during account deletion");
            return err(
                StatusCode::BAD_GATEWAY,
                "could not cancel your subscription; try again or contact support",
            );
        }
    }
    match state.store.list_keys_for_org(user.org_id).await {
        Ok(keys) => {
            for key in keys.iter().filter(|key| !key.revoked) {
                let _ = state.store.revoke_key(&key.prefix).await;
            }
        }
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "delete failed"),
    }
    if state.store.request_capture_erasure(user.org_id).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "delete failed");
    }
    notify_change(&state, &user.email, "your account was deleted");
    let _ = state.accounts.delete_sessions_for_user(user.id).await;
    if state.accounts.delete_user(user.id).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "delete failed");
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_clear_cookie(&state.config));
    response
}

/// GET /api/keys
pub async fn list_keys(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let keys = match state.store.list_keys_for_org(user.org_id).await {
        Ok(keys) => keys,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "keys lookup failed"),
    };
    let payload: Vec<Value> = keys
        .into_iter()
        .filter(|key| !key.revoked)
        .map(|key| {
            json!({
                "prefix": key.prefix,
                "purpose": key.purpose.as_str(),
            })
        })
        .collect();
    Json(json!({ "keys": payload })).into_response()
}

/// POST /api/keys — plaintext is returned once and never persisted.
pub async fn create_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateKeyBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(purpose) = KeyPurpose::parse(&body.purpose) else {
        return err(StatusCode::BAD_REQUEST, "purpose must be code, chat, or api");
    };
    if let Err(response) = crate::refunds::reject_if_suspended(&state, user.org_id).await {
        return response;
    }
    if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), false).await {
        return response;
    }
    let issued = match issue_key(&state.config.pepper) {
        Ok(issued) => issued,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "key issue failed"),
    };
    let record = ApiKeyRecord {
        id: Uuid::new_v4(),
        org_id: user.org_id,
        prefix: issued.prefix.clone(),
        hmac_hex: issued.hmac_hex,
        rpm: 60,
        tpm: 1_000_000,
        revoked: false,
        purpose,
    };
    if state.store.insert_key(record).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "key persist failed");
    }
    notify_change(&state, &user.email, &format!("a new {} API key was created", purpose.as_str()));
    Json(json!({
        "prefix": issued.prefix,
        "purpose": purpose.as_str(),
        "plaintext": issued.plaintext,
        "secret": issued.plaintext,
    }))
    .into_response()
}

/// DELETE /api/keys/{prefix}
pub async fn revoke_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(prefix): Path<String>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let keys = match state.store.list_keys_for_org(user.org_id).await {
        Ok(keys) => keys,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "keys lookup failed"),
    };
    if !keys.iter().any(|key| key.prefix == prefix) {
        return err(StatusCode::NOT_FOUND, "key not found");
    }
    let _ = state.store.revoke_key(&prefix).await;
    StatusCode::NO_CONTENT.into_response()
}

/// GET /api/usage
pub async fn usage(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    Json(usage_payload(&state, user.org_id).await).into_response()
}

/// GET /api/spending
pub async fn spending(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let wallet = state.store.credit_balance(user.org_id).await.unwrap_or(0);
    let sub = state.store.get_subscription(user.org_id).await.ok().flatten();
    let events = state
        .store
        .list_usage_for_org(user.org_id, 50)
        .await
        .unwrap_or_default();
    let payload: Vec<Value> = events
        .into_iter()
        .map(|event| {
            json!({
                "id": event.id.to_string(),
                "created_at": event.created_at.to_rfc3339(),
                "purpose": event.surface.as_str(),
                "amount_micros": event.usd_micros,
                "source": event.model_alias,
                // "included" = plan allowance (shown as Included); "credits" = wallet debit.
                "billing": event.charge_source.as_str(),
                // `input_tokens` = cache read + cache write + uncached, so the
                // four buckets below never double count and sum to `total`.
                "tokens": {
                    "input": event.buckets.uncached_tokens,
                    "cache_read": event.buckets.cache_read_tokens,
                    "cache_write": event.buckets.cache_write_tokens,
                    "output": event.buckets.output_tokens,
                    "total": event.buckets.input_tokens.saturating_add(event.buckets.output_tokens),
                },
            })
        })
        .collect();
    Json(json!({
        "wallet_micros": wallet,
        "plan": sub.as_ref().and_then(|row| row.active_plan().map(|p| p.as_str())),
        "events": payload,
    }))
    .into_response()
}

/// GET /api/billing
pub async fn billing(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let sub = state.store.get_subscription(user.org_id).await.ok().flatten();
    let window = crate::refunds::open_window(&state, user.org_id).await;
    Json(json!({
        "plan": sub.as_ref().and_then(|row| row.active_plan().map(|p| p.as_str())),
        "usage_based": sub.as_ref().map(|row| row.usage_based).unwrap_or(false),
        "refund": crate::refunds::window_json(window.as_ref()),
    }))
    .into_response()
}

/// POST /api/billing/checkout
pub async fn checkout(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CheckoutBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if let Err(response) = crate::refunds::reject_if_suspended(&state, user.org_id).await {
        return response;
    }
    // Subscribers cannot buy credit packs while their refund window is open.
    if body.kind.starts_with("credits") && crate::refunds::open_window(&state, user.org_id).await.is_some() {
        return err(
            StatusCode::CONFLICT,
            "credit packs become available once your subscription's refund period ends",
        );
    }
    // Credit purchases start from Spending; subscriptions from Billing.
    let page = if body.kind.starts_with("credits") { "/app/spending" } else { "/app/billing" };
    let (success, mut cancel) = checkout_urls(&state.config, page);
    let lp = landing_tag(body.lp.as_deref());
    // Visitors from a campaign landing who cancel the checkout land on the recapture offer.
    if let (Some(tag), "subscription") = (lp, body.kind.as_str()) {
        cancel = format!("{}/lp/offer?lp={tag}", state.config.public_origin);
    }
    let intro = body.offer.as_deref() == Some("intro");
    if intro {
        if body.kind != "subscription" || body.interval.as_deref().is_some_and(|value| value != "monthly") {
            return err(StatusCode::BAD_REQUEST, "the intro offer applies to monthly subscriptions only");
        }
        if !intro_eligible(&state, user.org_id, &crate::auth::normalize_email(&user.email)).await {
            return err(StatusCode::CONFLICT, "the intro offer is only available on your first subscription");
        }
        if state.config.stripe_intro_coupon.is_none() {
            return err(StatusCode::SERVICE_UNAVAILABLE, "the intro offer is not configured");
        }
    }
    let sub = state.store.get_subscription(user.org_id).await.ok().flatten();
    let customer = sub.as_ref().and_then(|row| row.stripe_customer_id.as_deref());
    let org = user.org_id.to_string();
    let result = match body.kind.as_str() {
        "credits" => {
            let Some(pack) = body.pack.as_deref().and_then(CreditPack::parse) else {
                return err(StatusCode::BAD_REQUEST, "unknown credit pack");
            };
            let Some(price) = state.config.price_for_pack(pack) else {
                return err(StatusCode::SERVICE_UNAVAILABLE, "credit pack is not configured");
            };
            let pack_s = pack.as_str();
            state
                .stripe
                .create_checkout(
                    price,
                    "payment",
                    &success,
                    &cancel,
                    customer,
                    &[
                        ("org_id", &org),
                        ("kind", "credits"),
                        ("pack", pack_s),
                    ],
                    None,
                )
                .await
        }
        "credits_custom" => {
            let Some(cents) = body.amount_cents else {
                return err(StatusCode::BAD_REQUEST, "amount is required");
            };
            if cents < MIN_CUSTOM_CREDIT_CENTS {
                return err(StatusCode::BAD_REQUEST, "the minimum top-up is $5.00");
            }
            if cents > MAX_CUSTOM_CREDIT_CENTS {
                return err(StatusCode::BAD_REQUEST, "the maximum top-up is $10,000.00");
            }
            let cents_s = cents.to_string();
            state
                .stripe
                .create_amount_checkout(
                    cents,
                    "Faelith prepaid credits",
                    &success,
                    &cancel,
                    customer,
                    &[
                        ("org_id", &org),
                        ("kind", "credits_custom"),
                        ("amount_cents", &cents_s),
                    ],
                )
                .await
        }
        "subscription" => {
            let Some(plan) = body.plan.as_deref().and_then(PlanTier::parse) else {
                return err(StatusCode::BAD_REQUEST, "unknown plan");
            };
            let interval = body
                .interval
                .as_deref()
                .and_then(BillingInterval::parse)
                .unwrap_or(BillingInterval::Monthly);
            let Some(price) = state.config.price_for_plan(plan, interval) else {
                return err(StatusCode::SERVICE_UNAVAILABLE, "plan is not configured");
            };
            let plan_s = plan.as_str();
            let interval_s = interval.as_str();
            let mut metadata = vec![
                ("org_id", org.as_str()),
                ("kind", "subscription"),
                ("plan", plan_s),
                ("interval", interval_s),
            ];
            if intro {
                metadata.push(("offer", "intro"));
            }
            if let Some(tag) = lp {
                metadata.push(("lp", tag));
            }
            let coupon = if intro { state.config.stripe_intro_coupon.as_deref() } else { None };
            state
                .stripe
                .create_checkout(price, "subscription", &success, &cancel, customer, &metadata, coupon)
                .await
        }
        _ => return err(StatusCode::BAD_REQUEST, "unknown checkout kind"),
    };
    match result {
        Ok(url) => Json(json!({ "url": url })).into_response(),
        Err(_) => err(StatusCode::BAD_GATEWAY, "stripe checkout failed"),
    }
}

/// GET /api/billing/invoices — paid Stripe invoices for the signed-in org.
///
/// The customer id always comes from the org's own subscription row, never
/// from the request, so one account cannot read another's invoices.
pub async fn invoices(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let customer = state
        .store
        .get_subscription(user.org_id)
        .await
        .ok()
        .flatten()
        .and_then(|row| row.stripe_customer_id);
    let Some(customer) = customer else {
        return Json(json!({ "invoices": [] })).into_response();
    };
    match state.stripe.list_paid_invoices(&customer, 24).await {
        Ok(invoices) => Json(json!({ "invoices": invoices })).into_response(),
        Err(error) => {
            tracing::error!(error = %error, "stripe invoice list failed");
            err(StatusCode::BAD_GATEWAY, "could not load invoices from Stripe")
        }
    }
}

/// POST /api/billing/portal
pub async fn portal(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let sub = state.store.get_subscription(user.org_id).await.ok().flatten();
    let Some(customer) = sub.and_then(|row| row.stripe_customer_id) else {
        return err(StatusCode::BAD_REQUEST, "no stripe customer yet");
    };
    let return_url = format!("{}/app/billing", state.config.public_origin);
    match state.stripe.create_portal(&customer, &return_url).await {
        Ok(url) => Json(json!({ "url": url })).into_response(),
        Err(_) => err(StatusCode::BAD_GATEWAY, "stripe portal failed"),
    }
}

/// POST /api/billing/usage-based
pub async fn set_usage_based(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<UsageBasedBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if body.enabled {
        if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), false).await {
            return response;
        }
    }
    let existing = state.store.get_subscription(user.org_id).await.ok().flatten();
    let record = OrgSubscription {
        org_id: user.org_id,
        stripe_customer_id: existing.as_ref().and_then(|row| row.stripe_customer_id.clone()),
        stripe_subscription_id: existing
            .as_ref()
            .and_then(|row| row.stripe_subscription_id.clone()),
        plan: existing.as_ref().and_then(|row| row.plan),
        status: existing
            .as_ref()
            .map(|row| row.status.clone())
            .unwrap_or_else(|| "none".to_string()),
        usage_based: body.enabled,
    };
    if state.store.upsert_subscription(record).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "update failed");
    }
    StatusCode::NO_CONTENT.into_response()
}

/// POST /api/usage/reset/redeem — consume the oldest unused grant (FIFO).
pub async fn redeem_usage_reset(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.store.redeem_usage_reset(user.org_id).await {
        Ok(_) => Json(usage_payload(&state, user.org_id).await).into_response(),
        Err(faelith_core::FaelithError::InvalidRequest(message)) => {
            err(StatusCode::BAD_REQUEST, &message)
        }
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "redeem failed"),
    }
}

/// POST /stripe/webhook — raw body, signed, idempotent.
pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    let Some(secret) = state.config.stripe_webhook_secret.as_deref() else {
        return err(StatusCode::SERVICE_UNAVAILABLE, "webhook secret missing");
    };
    let Some(signature) = headers
        .get("stripe-signature")
        .and_then(|value| value.to_str().ok())
    else {
        return err(StatusCode::BAD_REQUEST, "missing stripe-signature");
    };
    if let Err(message) = verify_stripe_signature(secret, signature, &body, unix_now()) {
        return err(StatusCode::BAD_REQUEST, &message);
    }
    let event: Value = match serde_json::from_slice(&body) {
        Ok(event) => event,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid json"),
    };
    // NFS-e hooks are idempotent and run first: on failure Stripe redelivers the whole event.
    if let Err(error) = crate::nfse::on_stripe_event(&state, &event).await {
        tracing::error!(error = %error, "nfse webhook hook failed");
        return err(StatusCode::INTERNAL_SERVER_ERROR, "nfse processing failed");
    }
    match fulfill_stripe_event(state.store.as_ref(), state.accounts.as_ref(), state.stripe.as_ref(), &event).await {
        Ok(_) => Json(json!({ "received": true })).into_response(),
        Err(message) => err(StatusCode::INTERNAL_SERVER_ERROR, &message),
    }
}

/// Builds Code/Chat meter bars for the dashboard from the shared core report.
pub(crate) async fn usage_payload(state: &AppState, org_id: Uuid) -> Value {
    let sub = state.store.get_subscription(org_id).await.ok().flatten();
    let snapshot = load_meter_snapshot(state.store.as_ref(), org_id)
        .await
        .unwrap_or_default();
    let intro = faelith_core::intro_active(state.store.as_ref(), org_id).await.unwrap_or(false);
    let body = MeterReport::build_with_intro(
        sub.as_ref().and_then(OrgSubscription::active_plan),
        sub.as_ref()
            .map(|row| row.status.as_str())
            .unwrap_or("none"),
        sub.as_ref().map(|row| row.usage_based).unwrap_or(false),
        KeyPurpose::Code,
        snapshot,
        intro,
    )
    .to_json();
    let grants = state
        .store
        .list_usage_reset_grants(org_id)
        .await
        .unwrap_or_default();
    attach_usage_reset_json(body, &grants)
}

/// Days of history behind the Overview activity grid (53 full weeks).
const ACTIVITY_DAYS: i64 = 371;

/// Sparse per-day token totals for the Overview grid: `all` includes API keys,
/// `chat` and `code` are the product surfaces. Days with no usage are omitted;
/// the SPA lays out the full calendar.
fn usage_heatmap(daily: &[DailyUsage]) -> Vec<Value> {
    let mut days: std::collections::BTreeMap<chrono::NaiveDate, (u64, u64, u64)> = Default::default();
    for row in daily {
        let slot = days.entry(row.day).or_default();
        slot.0 = slot.0.saturating_add(row.tokens);
        match row.surface {
            KeyPurpose::Chat => slot.1 = slot.1.saturating_add(row.tokens),
            KeyPurpose::Code => slot.2 = slot.2.saturating_add(row.tokens),
            KeyPurpose::Api => {}
        }
    }
    days.into_iter()
        .map(|(date, (all, chat, code))| {
            json!({ "date": date.format("%Y-%m-%d").to_string(), "all": all, "chat": chat, "code": code })
        })
        .collect()
}
