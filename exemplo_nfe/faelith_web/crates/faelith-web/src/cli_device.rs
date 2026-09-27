/**
 * @fileoverview Cursor-style CLI website login: start, poll, claim, approve.
 * @author Samuel S. L.
 * @version 1.4.0
 * @since 2026-09-07
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 *
 * DETAILED_DESCRIPTION:
 * - Approve records a boolean; the Code key is minted on poll and never stored
 * - Typed user_code must match the path (constant-time)
 * - The approval page shows the requesting IP, user agent, and time (RFC 8628 section 5.4)
 * - Approving passes the shared reauth gate and emails the account owner
 */

use crate::accounts::CliDeviceGrant;
use crate::auth::{random_token, request_user_agent, token_hash, ClientIp};
use crate::security::{notify_change, require_reauth, FactorBody};
use crate::limit::AUTH_WINDOW;
use crate::routes::{csrf_origin, err, require_user};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{Duration as ChronoDuration, Utc};
use faelith_core::auth::issue_key;
use faelith_core::plans::KeyPurpose;
use faelith_core::store::ApiKeyRecord;
use serde::Deserialize;
use serde_json::json;
use subtle::ConstantTimeEq;
use uuid::Uuid;

const CLI_DEVICE_TTL_SECS: i64 = 600;
const CLI_DEVICE_START_LIMIT: u32 = 10;
const CLI_DEVICE_POLL_LIMIT: u32 = 400;
const CLI_DEVICE_PAGE_LIMIT: u32 = 20;

#[derive(Debug, Deserialize)]
pub struct CliDevicePollBody {
    pub device_code: String,
    /// Defaults true so the existing CLI keeps minting a Code key.
    #[serde(default = "default_true")]
    pub mint_code: bool,
    /// Desktop login also mints a Chat key (`purpose=chat`).
    #[serde(default)]
    pub mint_chat: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct CliDeviceApproveBody {
    pub user_code: String,
    pub reauth: Option<FactorBody>,
}

/// Longest user agent kept on a grant; the rest is display noise.
const MAX_AGENT_CHARS: usize = 200;

/// POST /api/cli/device — CLI starts a website login (no session, no CSRF).
pub async fn start_cli_device(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _ = state.accounts.purge_expired_cli_devices().await;
    if !state
        .limiter
        .check(
            "cli-device-start",
            ip.as_str(),
            CLI_DEVICE_START_LIMIT,
            AUTH_WINDOW,
        )
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let device_code = random_token();
    let user_code = generate_user_code();
    let grant = CliDeviceGrant {
        user_code: user_code.clone(),
        device_code_hash: token_hash(&device_code),
        expires_at: Utc::now() + ChronoDuration::seconds(CLI_DEVICE_TTL_SECS),
        user_id: None,
        approved: false,
        plan: None,
        requester_ip: Some(ip.as_str().to_string()),
        requester_agent: request_user_agent(&headers)
            .map(|agent| agent.chars().take(MAX_AGENT_CHARS).collect()),
        created_at: Utc::now(),
    };
    if state.accounts.insert_cli_device(grant).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "device grant failed");
    }
    let verification_uri = format!(
        "{}/cli/login?code={}",
        state.config.public_origin.trim_end_matches('/'),
        user_code
    );
    Json(json!({
        "device_code": device_code,
        "user_code": user_code,
        "verification_uri": verification_uri,
        "expires_in": CLI_DEVICE_TTL_SECS,
    }))
    .into_response()
}

/// POST /api/cli/device/poll — CLI waits until the user approves in the browser.
pub async fn poll_cli_device(
    State(state): State<AppState>,
    ip: ClientIp,
    Json(body): Json<CliDevicePollBody>,
) -> impl IntoResponse {
    let _ = state.accounts.purge_expired_cli_devices().await;
    if !state
        .limiter
        .check(
            "cli-device-poll",
            ip.as_str(),
            CLI_DEVICE_POLL_LIMIT,
            AUTH_WINDOW,
        )
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let hash = token_hash(body.device_code.trim());
    let pending = match state.accounts.get_cli_device_by_device_hash(&hash).await {
        Ok(pending) => pending,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "device lookup failed"),
    };
    let Some(pending) = pending else {
        return err(StatusCode::NOT_FOUND, "device grant expired or unknown");
    };
    if !pending.approved {
        return Json(json!({ "status": "pending" })).into_response();
    }
    let approved = match state.accounts.take_cli_device_by_device_hash(&hash).await {
        Ok(Some(grant)) => grant,
        Ok(None) => return err(StatusCode::NOT_FOUND, "device grant expired or unknown"),
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "device consume failed"),
    };
    if !body.mint_code && !body.mint_chat {
        return err(StatusCode::BAD_REQUEST, "mint_code or mint_chat is required");
    }
    let api_key = if body.mint_code {
        match mint_purpose_key(&state, &approved, KeyPurpose::Code).await {
            Ok(key) => Some(key),
            Err(response) => return response,
        }
    } else {
        None
    };
    let chat_api_key = if body.mint_chat {
        match mint_purpose_key(&state, &approved, KeyPurpose::Chat).await {
            Ok(key) => Some(key),
            Err(response) => return response,
        }
    } else {
        None
    };
    let mut payload = json!({
        "status": "approved",
        "plan": approved.plan,
    });
    if let Some(api_key) = api_key {
        payload["api_key"] = json!(api_key);
    }
    if let Some(chat_api_key) = chat_api_key {
        payload["chat_api_key"] = json!(chat_api_key);
    }
    Json(payload).into_response()
}

/// GET /api/cli/device/{code} — SPA shows the pending CLI login.
pub async fn get_cli_device(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let _ = state.accounts.purge_expired_cli_devices().await;
    if !state
        .limiter
        .check(
            "cli-device-page",
            ip.as_str(),
            CLI_DEVICE_PAGE_LIMIT,
            AUTH_WINDOW,
        )
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let normalized = normalize_user_code(&code);
    match state.accounts.claim_cli_device(&normalized, user.id).await {
        Ok(Some(grant)) if !grant.approved => Json(json!({
            "user_code": grant.user_code,
            "status": "pending",
            "requester": {
                "ip": grant.requester_ip,
                "user_agent": grant.requester_agent,
                "created_at": grant.created_at.to_rfc3339(),
            },
        }))
        .into_response(),
        Ok(Some(_)) => Json(json!({
            "user_code": normalized,
            "status": "approved",
        }))
        .into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "unknown or expired CLI login"),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "device lookup failed"),
    }
}

/// POST /api/cli/device/{code}/approve — logged-in user authorizes this CLI.
pub async fn approve_cli_device(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Path(code): Path<String>,
    Json(body): Json<CliDeviceApproveBody>,
) -> impl IntoResponse {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if !state
        .limiter
        .check(
            "cli-device-page",
            ip.as_str(),
            CLI_DEVICE_PAGE_LIMIT,
            AUTH_WINDOW,
        )
        .await
    {
        return err(StatusCode::TOO_MANY_REQUESTS, "rate limited");
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if !user_codes_match(&code, &body.user_code) {
        return err(StatusCode::BAD_REQUEST, "CLI login code does not match");
    }
    if let Err(response) = crate::refunds::reject_if_suspended(&state, user.org_id).await {
        return response;
    }
    if let Err(response) = require_reauth(&state, &user, body.reauth.as_ref(), false).await {
        return response;
    }
    let _ = state.accounts.purge_expired_cli_devices().await;
    let normalized = normalize_user_code(&body.user_code);
    let Some(mut grant) = state
        .accounts
        .claim_cli_device(&normalized, user.id)
        .await
        .ok()
        .flatten()
    else {
        return err(StatusCode::NOT_FOUND, "unknown or expired CLI login");
    };
    if grant.approved {
        return Json(json!({ "status": "approved" })).into_response();
    }
    let plan = state
        .store
        .get_subscription(user.org_id)
        .await
        .ok()
        .flatten()
        .and_then(|row| row.active_plan().map(|tier| tier.as_str().to_string()));
    grant.user_id = Some(user.id);
    grant.approved = true;
    grant.plan = plan;
    let requester_ip = grant.requester_ip.clone().unwrap_or_else(|| "unknown".into());
    match state.accounts.approve_cli_device(&grant).await {
        Ok(true) => {
            notify_change(
                &state,
                &user.email,
                &format!("a device sign-in (Faelith CLI or desktop app) was approved for a request from IP {requester_ip}"),
            );
            Json(json!({ "status": "approved" })).into_response()
        }
        Ok(false) => err(StatusCode::CONFLICT, "CLI login already approved"),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "device approve failed"),
    }
}

/// Mints a key of the requested purpose. Secrets are returned once on poll.
async fn mint_purpose_key(
    state: &AppState,
    grant: &CliDeviceGrant,
    purpose: KeyPurpose,
) -> Result<String, axum::response::Response> {
    let user_id = grant
        .user_id
        .ok_or_else(|| err(StatusCode::INTERNAL_SERVER_ERROR, "device grant missing user"))?;
    let user = state
        .accounts
        .get_user_by_id(user_id)
        .await
        .ok()
        .flatten()
        .ok_or_else(|| err(StatusCode::INTERNAL_SERVER_ERROR, "device grant user missing"))?;
    let issued = issue_key(&state.config.pepper)
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "key issue failed"))?;
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
    state
        .store
        .insert_key(record)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "key persist failed"))?;
    Ok(issued.plaintext)
}

/// Constant-time compare of normalized CLI user codes.
fn user_codes_match(left: &str, right: &str) -> bool {
    let left = normalize_user_code(left);
    let right = normalize_user_code(right);
    if left.len() != right.len() {
        let _ = left.as_bytes().ct_eq(left.as_bytes());
        return false;
    }
    bool::from(left.as_bytes().ct_eq(right.as_bytes()))
}

/// Formats an 8-character user code as XXXX-XXXX.
fn generate_user_code() -> String {
    const ALPH: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    let mut chars = [0u8; 8];
    for slot in &mut chars {
        *slot = ALPH[rand::Rng::gen_range(&mut rng, 0..ALPH.len())];
    }
    format!(
        "{}-{}",
        std::str::from_utf8(&chars[..4]).unwrap_or("AAAA"),
        std::str::from_utf8(&chars[4..]).unwrap_or("AAAA")
    )
}

/// Accepts `abcd1234` or `ABCD-1234`.
fn normalize_user_code(raw: &str) -> String {
    let compact: String = raw
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .map(|ch| ch.to_ascii_uppercase())
        .collect();
    if compact.len() == 8 {
        format!("{}-{}", &compact[..4], &compact[4..])
    } else {
        raw.trim().to_ascii_uppercase()
    }
}
