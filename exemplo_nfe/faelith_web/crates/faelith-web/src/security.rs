/**
 * @fileoverview Email-verified signup, two-factor login challenge, and 2FA settings handlers.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-23
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
 * - Signup stores a pending row and emails a 6-digit code; the user row exists only after verification
 * - Any login (password or OAuth) with 2FA on yields a challenge cookie, never a session, until verified
 * - Factors: TOTP app (QR), email code, and 12 single-use backup codes; each code has 5 attempts
 * - Security changes require step-up proof once any factor is active; every change emails a notice
 * - Sensitive account actions (keys, billing, password, deletion) share one reauth gate
 * - With an authenticator app on, an emailed code is not accepted as proof (no 2FA downgrade)
 * - Responses never reveal whether an email is registered
 * Primary docs: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
 * https://pages.nist.gov/800-63-4/sp800-63b.html
 */

use crate::accounts::UserRecord;
use crate::auth::{
    hash_password, mfa_clear_cookie, mfa_set_cookie, normalize_email, random_token,
    read_mfa_token, session_set_cookie, token_hash, verify_password, ClientIp,
};
use crate::limit::{AUTH_LIMIT, AUTH_WINDOW};
use crate::mailer::{
    account_exists_email, login_code_email, security_notice_email, signup_code_email,
    stepup_code_email, OutgoingEmail,
};
use crate::mfa::{
    generate_backup_codes, generate_numeric_code, generate_totp_secret, mask_email,
    normalize_backup_code, normalize_numeric_code, totp_enrollment, unix_now, verify_totp,
    CodePurpose, MAX_CODE_ATTEMPTS,
};
use crate::routes::{csrf_origin, err, issue_session_for, require_user, session_json};
use crate::security_store::{MfaChallenge, MfaState, PendingSignup, StepUpCode};
use crate::AppState;
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// Lifetime of every emailed code.
const CODE_TTL_MINUTES: i64 = 10;
/// Minimum gap between two emails for the same pending signup, challenge, or user.
const RESEND_COOLDOWN_SECONDS: i64 = 60;
/// Lifetime of a pending two-factor login (matches the challenge cookie).
const CHALLENGE_TTL_MINUTES: i64 = 10;
/// Generic failure for any wrong, expired, or unknown code.
const INVALID_CODE: &str = "invalid or expired code";
/// Returned when a code or challenge has been burned by too many guesses.
const TOO_MANY_ATTEMPTS: &str = "too many attempts; request a new code";

/// Second-factor method named by the SPA.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Method {
    Totp,
    Email,
    Backup,
}

impl Method {
    /// Parses the wire name; unknown methods are rejected.
    fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "totp" | "app" => Some(Self::Totp),
            "email" => Some(Self::Email),
            "backup" | "recovery" => Some(Self::Backup),
            _ => None,
        }
    }
}

/// Methods a user may present, in the order the SPA should offer them.
fn available_methods(mfa: &MfaState) -> Vec<&'static str> {
    let mut methods = Vec::new();
    if mfa.totp_enabled() {
        methods.push("totp");
    }
    if mfa.email_enabled() {
        methods.push("email");
    }
    if mfa.any_enabled() {
        methods.push("backup");
    }
    methods
}

/// Maps a store error to a 500 without leaking its text to the client.
fn internal(context: &str, error: String) -> Response {
    tracing::error!(error = %error, context, "security store failure");
    err(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
}

/// Applies the shared auth rate limit to one bucket and key.
async fn rate_limited(state: &AppState, bucket: &str, key: &str) -> Option<Response> {
    if state.limiter.check(bucket, key, AUTH_LIMIT, AUTH_WINDOW).await {
        None
    } else {
        Some(err(StatusCode::TOO_MANY_REQUESTS, "rate limited"))
    }
}

/// Sends a transactional email, mapping relay failures to 502.
async fn deliver(state: &AppState, email: OutgoingEmail) -> Result<(), Response> {
    state.mailer.send(email).await.map_err(|error| {
        tracing::error!(error = %error, "transactional email failed");
        err(StatusCode::BAD_GATEWAY, "could not send email; try again shortly")
    })
}

/// Emails a security notice in the background; failure is logged, never surfaced.
pub(crate) fn notify_change(state: &AppState, to: &str, change: &str) {
    let mailer = state.mailer.clone();
    let email = security_notice_email(to, change);
    tokio::spawn(async move {
        if let Err(error) = mailer.send(email).await {
            tracing::warn!(error = %error, "security notice email failed");
        }
    });
}

/// Seconds the caller must still wait before another email, if any.
fn cooldown_remaining(resend_after: chrono::DateTime<Utc>) -> Option<i64> {
    let remaining = (resend_after - Utc::now()).num_seconds();
    (remaining > 0).then_some(remaining)
}

/// 429 with a machine-readable retry hint.
fn cooldown_response(seconds: i64) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(json!({ "error": "please wait before requesting another code", "retry_after": seconds })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Signup with email verification
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SignupBody {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct SignupVerifyBody {
    pub email: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct EmailBody {
    pub email: String,
}

/// Uniform 202 for every accepted signup so registered emails are not revealed.
fn verification_sent(email: &str) -> Response {
    (
        StatusCode::ACCEPTED,
        Json(json!({ "verification_required": true, "email": email, "expires_in": CODE_TTL_MINUTES * 60 })),
    )
        .into_response()
}

/// POST /auth/signup — validates input, stores a pending signup, and emails a code.
///
/// If the address already has an account, the owner gets an "account exists"
/// email instead of a code and the HTTP response is identical, so the form
/// cannot be used to enumerate users.
pub async fn signup(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<SignupBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(response) = rate_limited(&state, "signup", ip.as_str()).await {
        return response;
    }
    let email = normalize_email(&body.email);
    if email.is_empty() || !email.contains('@') || email.len() > 254 {
        return err(StatusCode::BAD_REQUEST, "invalid email");
    }
    let name = body.name.trim();
    if name.chars().count() > 100 {
        return err(StatusCode::BAD_REQUEST, "name is too long");
    }
    let password_hash = match hash_password(&body.password) {
        Ok(hash) => hash,
        Err(message) => return err(StatusCode::BAD_REQUEST, &message),
    };
    match state.accounts.get_user_by_email(&email).await {
        Ok(Some(_)) => {
            if let Err(error) = state
                .mailer
                .send(account_exists_email(&email, &state.config.public_origin))
                .await
            {
                tracing::warn!(error = %error, "account-exists email failed");
            }
            return verification_sent(&email);
        }
        Ok(None) => {}
        Err(error) => return internal("signup lookup", error),
    }
    match state.security.get_pending_signup(&email).await {
        Ok(Some(existing)) => {
            if let Some(seconds) = cooldown_remaining(existing.resend_after) {
                return cooldown_response(seconds);
            }
        }
        Ok(None) => {}
        Err(error) => return internal("pending lookup", error),
    }
    let code = generate_numeric_code();
    let now = Utc::now();
    let pending = PendingSignup {
        email: email.clone(),
        name: name.to_string(),
        password_hash,
        code_hash: state.mfa_keys.code_mac(CodePurpose::Signup, &email, &code),
        attempts: 0,
        expires_at: now + Duration::minutes(CODE_TTL_MINUTES),
        resend_after: now + Duration::seconds(RESEND_COOLDOWN_SECONDS),
    };
    if let Err(error) = state.security.upsert_pending_signup(pending).await {
        return internal("pending upsert", error);
    }
    if let Err(response) = deliver(&state, signup_code_email(&email, &code, CODE_TTL_MINUTES)).await {
        return response;
    }
    verification_sent(&email)
}

/// POST /auth/signup/resend — issues a fresh code for a live pending signup.
///
/// Unknown emails get the same 202 so this endpoint cannot probe for pending rows.
pub async fn signup_resend(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<EmailBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(response) = rate_limited(&state, "signup-resend", ip.as_str()).await {
        return response;
    }
    let email = normalize_email(&body.email);
    let pending = match state.security.get_pending_signup(&email).await {
        Ok(Some(pending)) => pending,
        Ok(None) => return verification_sent(&email),
        Err(error) => return internal("pending lookup", error),
    };
    if let Some(seconds) = cooldown_remaining(pending.resend_after) {
        return cooldown_response(seconds);
    }
    let code = generate_numeric_code();
    let now = Utc::now();
    let refreshed = PendingSignup {
        code_hash: state.mfa_keys.code_mac(CodePurpose::Signup, &email, &code),
        attempts: 0,
        expires_at: now + Duration::minutes(CODE_TTL_MINUTES),
        resend_after: now + Duration::seconds(RESEND_COOLDOWN_SECONDS),
        ..pending
    };
    if let Err(error) = state.security.upsert_pending_signup(refreshed).await {
        return internal("pending upsert", error);
    }
    if let Err(response) = deliver(&state, signup_code_email(&email, &code, CODE_TTL_MINUTES)).await {
        return response;
    }
    verification_sent(&email)
}

/// POST /auth/signup/verify — checks the code, creates org + user, and starts a session.
pub async fn signup_verify(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<SignupVerifyBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(response) = rate_limited(&state, "signup-verify", ip.as_str()).await {
        return response;
    }
    let email = normalize_email(&body.email);
    let Some(code) = normalize_numeric_code(&body.code) else {
        return err(StatusCode::BAD_REQUEST, INVALID_CODE);
    };
    let pending = match state.security.get_pending_signup(&email).await {
        Ok(Some(pending)) => pending,
        Ok(None) => return err(StatusCode::BAD_REQUEST, INVALID_CODE),
        Err(error) => return internal("pending lookup", error),
    };
    if pending.attempts >= MAX_CODE_ATTEMPTS {
        let _ = state.security.delete_pending_signup(&email).await;
        return err(StatusCode::TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS);
    }
    if !state
        .mfa_keys
        .code_matches(CodePurpose::Signup, &email, &code, &pending.code_hash)
    {
        return match state.security.bump_pending_signup_attempts(&email).await {
            Ok(attempts) if attempts >= MAX_CODE_ATTEMPTS => {
                let _ = state.security.delete_pending_signup(&email).await;
                err(StatusCode::TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS)
            }
            Ok(_) => err(StatusCode::BAD_REQUEST, INVALID_CODE),
            Err(error) => internal("pending bump", error),
        };
    }
    if let Err(error) = state.security.delete_pending_signup(&email).await {
        return internal("pending delete", error);
    }
    match state.accounts.get_user_by_email(&email).await {
        Ok(Some(_)) => return err(StatusCode::CONFLICT, "this email already has an account; sign in instead"),
        Ok(None) => {}
        Err(error) => return internal("signup lookup", error),
    }
    let org_id = match state.store.create_org(&format!("user-{email}")).await {
        Ok(id) => id,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "org create failed"),
    };
    let user = UserRecord {
        id: Uuid::new_v4(),
        org_id,
        email,
        password_hash: Some(pending.password_hash),
        name: pending.name,
    };
    if let Err(error) = state.accounts.insert_user(user.clone()).await {
        return internal("user insert", error);
    }
    session_response(&state, &user, &headers, &ip, Json(session_json(&state, &user).await).into_response()).await
}

/// Issues a session cookie onto `response`, clearing any pending challenge cookie.
async fn session_response(
    state: &AppState,
    user: &UserRecord,
    headers: &HeaderMap,
    ip: &ClientIp,
    mut response: Response,
) -> Response {
    let token = match issue_session_for(state, user.id, headers, ip).await {
        Ok(token) => token,
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "session failed"),
    };
    let cookies = response.headers_mut();
    cookies.append(header::SET_COOKIE, session_set_cookie(&state.config, &token));
    cookies.append(header::SET_COOKIE, mfa_clear_cookie(&state.config));
    response
}

// ---------------------------------------------------------------------------
// Login challenge (second factor)
// ---------------------------------------------------------------------------

/// Creates a challenge for a user who passed the first factor.
///
/// Returns the raw token for the signed cookie plus the user's factor state,
/// or `Ok(None)` when 2FA is off and the caller should issue a session.
pub async fn begin_challenge(
    state: &AppState,
    user_id: Uuid,
) -> Result<Option<(String, MfaState)>, String> {
    let mfa = state.security.get_mfa(user_id).await?;
    if !mfa.any_enabled() {
        return Ok(None);
    }
    let token = random_token();
    state
        .security
        .insert_challenge(MfaChallenge {
            token_hash: token_hash(&token),
            user_id,
            attempts: 0,
            email_code_hash: None,
            email_sent_at: None,
            expires_at: Utc::now() + Duration::minutes(CHALLENGE_TTL_MINUTES),
        })
        .await?;
    Ok(Some((token, mfa)))
}

/// JSON the SPA uses to render the challenge screen.
fn challenge_json(mfa: &MfaState, email: &str, email_sent: bool) -> Value {
    json!({
        "mfa_required": true,
        "methods": available_methods(mfa),
        "email_hint": mask_email(email),
        "email_sent": email_sent,
    })
}

/// Password-login response when 2FA is on: challenge cookie + method list, no session.
pub fn challenge_response(state: &AppState, token: &str, mfa: &MfaState, email: &str) -> Response {
    let mut response = Json(challenge_json(mfa, email, false)).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, mfa_set_cookie(&state.config, token));
    response
}

/// Resolves the live challenge and its user from the challenge cookie.
async fn load_challenge(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(MfaChallenge, UserRecord, MfaState), Response> {
    let expired = || err(StatusCode::UNAUTHORIZED, "sign-in expired; start again");
    let token = read_mfa_token(headers, &state.config).ok_or_else(expired)?;
    let challenge = state
        .security
        .get_challenge(&token_hash(&token))
        .await
        .map_err(|error| internal("challenge lookup", error))?
        .ok_or_else(expired)?;
    let user = state
        .accounts
        .get_user_by_id(challenge.user_id)
        .await
        .map_err(|error| internal("challenge user", error))?
        .ok_or_else(expired)?;
    let mfa = state
        .security
        .get_mfa(user.id)
        .await
        .map_err(|error| internal("challenge mfa", error))?;
    Ok((challenge, user, mfa))
}

/// GET /auth/mfa — methods for the pending challenge (used after an OAuth redirect).
pub async fn challenge_status(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match load_challenge(&state, &headers).await {
        Ok((challenge, user, mfa)) => {
            Json(challenge_json(&mfa, &user.email, challenge.email_sent_at.is_some())).into_response()
        }
        Err(response) => response,
    }
}

/// POST /auth/mfa/email — emails a sign-in code for the pending challenge.
pub async fn challenge_send_email(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(response) = rate_limited(&state, "mfa-email", ip.as_str()).await {
        return response;
    }
    let (challenge, user, mfa) = match load_challenge(&state, &headers).await {
        Ok(loaded) => loaded,
        Err(response) => return response,
    };
    if !mfa.email_enabled() {
        return err(StatusCode::BAD_REQUEST, "email codes are not enabled for this account");
    }
    if let Some(sent) = challenge.email_sent_at {
        if let Some(seconds) = cooldown_remaining(sent + Duration::seconds(RESEND_COOLDOWN_SECONDS)) {
            return cooldown_response(seconds);
        }
    }
    let code = generate_numeric_code();
    let code_hash = state
        .mfa_keys
        .code_mac(CodePurpose::LoginEmail, &challenge.token_hash, &code);
    if let Err(error) = state
        .security
        .set_challenge_email_code(&challenge.token_hash, &code_hash, Utc::now())
        .await
    {
        return internal("challenge email", error);
    }
    if let Err(response) = deliver(&state, login_code_email(&user.email, &code, CHALLENGE_TTL_MINUTES)).await {
        return response;
    }
    Json(challenge_json(&mfa, &user.email, true)).into_response()
}

#[derive(Debug, Deserialize)]
pub struct FactorBody {
    pub method: String,
    pub code: String,
}

/// POST /auth/mfa/verify — checks the second factor and converts the challenge into a session.
pub async fn challenge_verify(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<FactorBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(response) = rate_limited(&state, "mfa-verify", ip.as_str()).await {
        return response;
    }
    let (challenge, user, mfa) = match load_challenge(&state, &headers).await {
        Ok(loaded) => loaded,
        Err(response) => return response,
    };
    let Some(method) = Method::parse(&body.method) else {
        return err(StatusCode::BAD_REQUEST, "unknown method");
    };
    let verified = match method {
        Method::Email => Ok(mfa.email_enabled()
            && challenge.email_code_hash.as_deref().is_some_and(|stored| {
                normalize_numeric_code(&body.code).is_some_and(|code| {
                    state
                        .mfa_keys
                        .code_matches(CodePurpose::LoginEmail, &challenge.token_hash, &code, stored)
                })
            })),
        other => check_app_or_backup(&state, user.id, &mfa, other, &body.code).await,
    };
    match verified {
        Ok(true) => {}
        Ok(false) => {
            return match state.security.bump_challenge_attempts(&challenge.token_hash).await {
                Ok(attempts) if attempts >= MAX_CODE_ATTEMPTS => {
                    let _ = state.security.take_challenge(&challenge.token_hash).await;
                    let mut response = err(StatusCode::TOO_MANY_REQUESTS, "too many attempts; sign in again");
                    response
                        .headers_mut()
                        .insert(header::SET_COOKIE, mfa_clear_cookie(&state.config));
                    response
                }
                Ok(_) => err(StatusCode::UNAUTHORIZED, INVALID_CODE),
                Err(error) => internal("challenge bump", error),
            };
        }
        Err(error) => return internal("factor check", error),
    }
    match state.security.take_challenge(&challenge.token_hash).await {
        Ok(true) => {}
        Ok(false) => return err(StatusCode::UNAUTHORIZED, "sign-in expired; start again"),
        Err(error) => return internal("challenge take", error),
    }
    if method == Method::Backup {
        let remaining = state.security.count_backup_codes(user.id).await.unwrap_or(0);
        notify_change(&state, &user.email, &format!("a backup code was used to sign in ({remaining} left)"));
    }
    let body = session_json(&state, &user).await;
    session_response(&state, &user, &headers, &ip, Json(body).into_response()).await
}

/// Verifies an authenticator-app or backup code for a user.
///
/// TOTP steps are recorded atomically, so the same code cannot be used twice
/// even by concurrent requests; backup codes are consumed atomically.
async fn check_app_or_backup(
    state: &AppState,
    user_id: Uuid,
    mfa: &MfaState,
    method: Method,
    code: &str,
) -> Result<bool, String> {
    match method {
        Method::Totp => {
            let Some(sealed) = mfa.totp_secret_enc.as_deref().filter(|_| mfa.totp_enabled()) else {
                return Ok(false);
            };
            let secret = state.mfa_keys.open(sealed)?;
            match verify_totp(&secret, code, mfa.totp_last_step, unix_now()) {
                Some(step) => state.security.advance_totp_step(user_id, step).await,
                None => Ok(false),
            }
        }
        Method::Backup => {
            if !mfa.any_enabled() {
                return Ok(false);
            }
            let Some(canonical) = normalize_backup_code(code) else {
                return Ok(false);
            };
            let hash = state
                .mfa_keys
                .code_mac(CodePurpose::Backup, &user_id.to_string(), &canonical);
            state.security.consume_backup_code(user_id, &hash).await
        }
        Method::Email => Ok(false),
    }
}

// ---------------------------------------------------------------------------
// Security settings (signed-in user)
// ---------------------------------------------------------------------------

/// Proof of a second factor required for sensitive changes once 2FA is on.
#[derive(Debug, Deserialize)]
pub struct ProofBody {
    #[serde(alias = "reauth")]
    pub proof: Option<FactorBody>,
}

#[derive(Debug, Deserialize)]
pub struct TotpEnableBody {
    pub code: String,
    #[serde(alias = "reauth")]
    pub proof: Option<FactorBody>,
}

#[derive(Debug, Deserialize)]
pub struct EmailEnableBody {
    pub code: String,
}

/// Loads the signed-in user and their 2FA state for a mutating settings call.
async fn settings_context(
    state: &AppState,
    headers: &HeaderMap,
    mutating: bool,
) -> Result<(UserRecord, MfaState), Response> {
    if mutating {
        csrf_origin(state, headers)?;
    }
    let user = require_user(state, headers).await?;
    let mfa = state
        .security
        .get_mfa(user.id)
        .await
        .map_err(|error| internal("mfa lookup", error))?;
    Ok((user, mfa))
}

/// Verifies a step-up email code for the signed-in user, burning it after use or 5 misses.
async fn check_stepup_email(state: &AppState, user_id: Uuid, code: &str) -> Result<bool, String> {
    let Some(stepup) = state.security.get_stepup(user_id).await? else {
        return Ok(false);
    };
    if stepup.attempts >= MAX_CODE_ATTEMPTS {
        state.security.delete_stepup(user_id).await?;
        return Ok(false);
    }
    let matched = normalize_numeric_code(code).is_some_and(|code| {
        state
            .mfa_keys
            .code_matches(CodePurpose::StepUp, &user_id.to_string(), &code, &stepup.code_hash)
    });
    if matched {
        state.security.delete_stepup(user_id).await?;
        return Ok(true);
    }
    if state.security.bump_stepup_attempts(user_id).await? >= MAX_CODE_ATTEMPTS {
        state.security.delete_stepup(user_id).await?;
    }
    Ok(false)
}

/// Enforces step-up when any factor is active: a valid TOTP, backup, or emailed code.
async fn require_proof(
    state: &AppState,
    user: &UserRecord,
    mfa: &MfaState,
    proof: Option<&FactorBody>,
) -> Result<(), Response> {
    reauth_with(state, user, mfa, proof, false).await
}

/// Proof methods accepted for a sensitive action.
///
/// With 2FA on, only second factors count, and an emailed code is refused
/// while an authenticator app is enabled so a compromised inbox cannot
/// downgrade the account. With 2FA off, `always` actions still need the
/// password (or, for OAuth-only accounts, an emailed code).
fn reauth_methods(user: &UserRecord, mfa: &MfaState, always: bool) -> Vec<&'static str> {
    if mfa.any_enabled() {
        let mut methods = Vec::new();
        if mfa.totp_enabled() {
            methods.push("totp");
        } else if mfa.email_enabled() {
            methods.push("email");
        }
        methods.push("backup");
        return methods;
    }
    if !always {
        return Vec::new();
    }
    if user.password_hash.is_some() {
        vec!["password"]
    } else {
        vec!["email"]
    }
}

/// 403 carrying the accepted methods so the SPA can prompt and retry.
fn reauth_required(user: &UserRecord, methods: &[&str], message: &str) -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({
            "error": message,
            "reauth": { "methods": methods, "email_hint": mask_email(&user.email) },
        })),
    )
        .into_response()
}

/// Shared reauthentication gate with the user's factor state already loaded.
async fn reauth_with(
    state: &AppState,
    user: &UserRecord,
    mfa: &MfaState,
    proof: Option<&FactorBody>,
    always: bool,
) -> Result<(), Response> {
    let methods = reauth_methods(user, mfa, always);
    if methods.is_empty() {
        return Ok(());
    }
    let Some(proof) = proof else {
        return Err(reauth_required(user, &methods, "confirm it is you to continue"));
    };
    if let Some(response) = rate_limited(state, "mfa-proof", &user.id.to_string()).await {
        return Err(response);
    }
    let method = proof.method.trim().to_ascii_lowercase();
    if !methods.contains(&method.as_str()) {
        return Err(reauth_required(user, &methods, "that verification method is not accepted here"));
    }
    let verified = match method.as_str() {
        "password" => Ok(verify_password(&proof.code, user.password_hash.as_deref(), &state.dummy_hash)),
        "email" => check_stepup_email(state, user.id, &proof.code).await,
        other => match Method::parse(other) {
            Some(parsed) => check_app_or_backup(state, user.id, mfa, parsed, &proof.code).await,
            None => Ok(false),
        },
    }
    .map_err(|error| internal("proof check", error))?;
    if verified {
        Ok(())
    } else {
        Err(reauth_required(user, &methods, INVALID_CODE))
    }
}

/// Reauthentication for sensitive account actions (keys, billing, password, deletion).
///
/// `always` also demands proof when 2FA is off (account deletion, OAuth-only
/// password setup); otherwise only accounts with 2FA are asked.
pub(crate) async fn require_reauth(
    state: &AppState,
    user: &UserRecord,
    proof: Option<&FactorBody>,
    always: bool,
) -> Result<(), Response> {
    let mfa = state
        .security
        .get_mfa(user.id)
        .await
        .map_err(|error| internal("mfa lookup", error))?;
    reauth_with(state, user, &mfa, proof, always).await
}

/// Public view of the user's 2FA configuration.
async fn security_json(state: &AppState, user_id: Uuid) -> Result<Value, String> {
    let mfa = state.security.get_mfa(user_id).await?;
    let remaining = state.security.count_backup_codes(user_id).await?;
    Ok(json!({
        "totp_enabled": mfa.totp_enabled(),
        "email_enabled": mfa.email_enabled(),
        "backup_codes_remaining": remaining,
        "mfa_enabled": mfa.any_enabled(),
    }))
}

/// Creates and stores a fresh backup-code set, returning the plaintext once.
async fn issue_backup_codes(state: &AppState, user_id: Uuid) -> Result<Vec<String>, String> {
    let codes = generate_backup_codes();
    let subject = user_id.to_string();
    let hashes = codes
        .iter()
        .filter_map(|code| normalize_backup_code(code))
        .map(|canonical| state.mfa_keys.code_mac(CodePurpose::Backup, &subject, &canonical))
        .collect();
    state.security.replace_backup_codes(user_id, hashes).await?;
    Ok(codes)
}

/// Generates backup codes the first time a factor is turned on.
async fn backup_codes_if_first(
    state: &AppState,
    user_id: Uuid,
    was_enabled: bool,
) -> Result<Option<Vec<String>>, String> {
    if was_enabled && state.security.count_backup_codes(user_id).await? > 0 {
        return Ok(None);
    }
    issue_backup_codes(state, user_id).await.map(Some)
}

/// Removes backup codes once no factor remains, so they cannot bypass a disabled 2FA.
async fn cleanup_if_last(state: &AppState, user_id: Uuid) -> Result<(), String> {
    if !state.security.get_mfa(user_id).await?.any_enabled() {
        state.security.delete_backup_codes(user_id).await?;
    }
    Ok(())
}

/// Settings response: current state plus plaintext backup codes when newly issued.
async fn settings_result(state: &AppState, user_id: Uuid, codes: Option<Vec<String>>) -> Response {
    match security_json(state, user_id).await {
        Ok(mut body) => {
            if let Some(codes) = codes {
                body["backup_codes"] = json!(codes);
            }
            Json(body).into_response()
        }
        Err(error) => internal("security view", error),
    }
}

/// GET /api/security — 2FA status for the settings page.
pub async fn security_status(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match settings_context(&state, &headers, false).await {
        Ok((user, _)) => settings_result(&state, user.id, None).await,
        Err(response) => response,
    }
}

/// POST /api/security/stepup/email — emails a code that confirms the next security change.
pub async fn stepup_send_email(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let (user, _) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if let Some(response) = rate_limited(&state, "stepup-email", &user.id.to_string()).await {
        return response;
    }
    match state.security.get_stepup(user.id).await {
        Ok(Some(existing)) => {
            if let Some(seconds) = cooldown_remaining(existing.resend_after) {
                return cooldown_response(seconds);
            }
        }
        Ok(None) => {}
        Err(error) => return internal("stepup lookup", error),
    }
    let code = generate_numeric_code();
    let now = Utc::now();
    let stepup = StepUpCode {
        user_id: user.id,
        code_hash: state
            .mfa_keys
            .code_mac(CodePurpose::StepUp, &user.id.to_string(), &code),
        attempts: 0,
        expires_at: now + Duration::minutes(CODE_TTL_MINUTES),
        resend_after: now + Duration::seconds(RESEND_COOLDOWN_SECONDS),
    };
    if let Err(error) = state.security.upsert_stepup(stepup).await {
        return internal("stepup upsert", error);
    }
    if let Err(response) = deliver(&state, stepup_code_email(&user.email, &code, CODE_TTL_MINUTES)).await {
        return response;
    }
    Json(json!({ "sent": true, "email_hint": mask_email(&user.email) })).into_response()
}

/// POST /api/security/totp/setup — creates a pending seed and returns its QR code.
///
/// The seed only becomes active after `/totp/enable` proves the app produces
/// valid codes, so a half-finished enrollment can never lock the user out.
pub async fn totp_setup(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let (user, mfa) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if mfa.totp_enabled() {
        return err(StatusCode::CONFLICT, "authenticator app is already enabled");
    }
    let secret = generate_totp_secret();
    let enrollment = match totp_enrollment(&secret, &user.email) {
        Ok(enrollment) => enrollment,
        Err(error) => return internal("totp enrollment", error),
    };
    let sealed = match state.mfa_keys.seal(&secret) {
        Ok(sealed) => sealed,
        Err(error) => return internal("totp seal", error),
    };
    if let Err(error) = state.security.set_totp_pending(user.id, Some(sealed)).await {
        return internal("totp pending", error);
    }
    Json(json!({
        "qr": enrollment.qr_data_url,
        "secret": enrollment.secret_base32,
        "otpauth_url": enrollment.otpauth_url,
    }))
    .into_response()
}

/// POST /api/security/totp/enable — confirms the pending seed with a code from the app.
pub async fn totp_enable(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<TotpEnableBody>,
) -> Response {
    let (user, mfa) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if mfa.totp_enabled() {
        return err(StatusCode::CONFLICT, "authenticator app is already enabled");
    }
    if let Err(response) = require_proof(&state, &user, &mfa, body.proof.as_ref()).await {
        return response;
    }
    let Some(sealed) = mfa.totp_pending_enc.clone() else {
        return err(StatusCode::BAD_REQUEST, "start setup again to get a new QR code");
    };
    let secret = match state.mfa_keys.open(&sealed) {
        Ok(secret) => secret,
        Err(error) => return internal("totp open", error),
    };
    let Some(step) = verify_totp(&secret, &body.code, 0, unix_now()) else {
        return err(StatusCode::BAD_REQUEST, "code does not match; check the time on your phone");
    };
    if let Err(error) = state.security.enable_totp(user.id, sealed, step).await {
        return internal("totp enable", error);
    }
    let codes = match backup_codes_if_first(&state, user.id, mfa.any_enabled()).await {
        Ok(codes) => codes,
        Err(error) => return internal("backup issue", error),
    };
    notify_change(&state, &user.email, "authenticator app two-factor enabled");
    settings_result(&state, user.id, codes).await
}

/// POST /api/security/totp/disable — removes the authenticator app after step-up.
pub async fn totp_disable(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ProofBody>,
) -> Response {
    let (user, mfa) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if !mfa.totp_enabled() {
        return err(StatusCode::BAD_REQUEST, "authenticator app is not enabled");
    }
    if let Err(response) = require_proof(&state, &user, &mfa, body.proof.as_ref()).await {
        return response;
    }
    if let Err(error) = state.security.disable_totp(user.id).await {
        return internal("totp disable", error);
    }
    if let Err(error) = cleanup_if_last(&state, user.id).await {
        return internal("mfa cleanup", error);
    }
    notify_change(&state, &user.email, "authenticator app two-factor disabled");
    settings_result(&state, user.id, None).await
}

/// POST /api/security/email/enable — turns on email codes using a step-up code as inbox proof.
pub async fn email_enable(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<EmailEnableBody>,
) -> Response {
    let (user, mfa) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if mfa.email_enabled() {
        return err(StatusCode::CONFLICT, "email codes are already enabled");
    }
    if let Some(response) = rate_limited(&state, "mfa-proof", &user.id.to_string()).await {
        return response;
    }
    match check_stepup_email(&state, user.id, &body.code).await {
        Ok(true) => {}
        Ok(false) => return err(StatusCode::BAD_REQUEST, INVALID_CODE),
        Err(error) => return internal("stepup check", error),
    }
    if let Err(error) = state.security.set_email_enabled(user.id, true).await {
        return internal("email enable", error);
    }
    let codes = match backup_codes_if_first(&state, user.id, mfa.any_enabled()).await {
        Ok(codes) => codes,
        Err(error) => return internal("backup issue", error),
    };
    notify_change(&state, &user.email, "email two-factor enabled");
    settings_result(&state, user.id, codes).await
}

/// POST /api/security/email/disable — turns off email codes after step-up.
pub async fn email_disable(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ProofBody>,
) -> Response {
    let (user, mfa) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if !mfa.email_enabled() {
        return err(StatusCode::BAD_REQUEST, "email codes are not enabled");
    }
    if let Err(response) = require_proof(&state, &user, &mfa, body.proof.as_ref()).await {
        return response;
    }
    if let Err(error) = state.security.set_email_enabled(user.id, false).await {
        return internal("email disable", error);
    }
    if let Err(error) = cleanup_if_last(&state, user.id).await {
        return internal("mfa cleanup", error);
    }
    notify_change(&state, &user.email, "email two-factor disabled");
    settings_result(&state, user.id, None).await
}

/// POST /api/security/backup-codes — replaces the backup-code set after step-up.
pub async fn backup_regenerate(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ProofBody>,
) -> Response {
    let (user, mfa) = match settings_context(&state, &headers, true).await {
        Ok(context) => context,
        Err(response) => return response,
    };
    if !mfa.any_enabled() {
        return err(StatusCode::BAD_REQUEST, "turn on two-factor authentication first");
    }
    if let Err(response) = require_proof(&state, &user, &mfa, body.proof.as_ref()).await {
        return response;
    }
    let codes = match issue_backup_codes(&state, user.id).await {
        Ok(codes) => codes,
        Err(error) => return internal("backup issue", error),
    };
    notify_change(&state, &user.email, "backup codes regenerated (old codes no longer work)");
    settings_result(&state, user.id, Some(codes)).await
}
