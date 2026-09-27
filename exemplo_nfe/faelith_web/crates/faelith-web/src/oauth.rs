/**
 * @fileoverview GitHub OAuth and Google OIDC Authorization Code + PKCE S256.
 * @author Samuel S. L.
 * @version 1.3.0
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
 * - state is required; Google id_token is verified RS256 via JWKS plus nonce
 * - OAuth start is rate-limited like login/signup
 * - PKCE S256 per RFC 9700; tokens are exchanged server-side only
 * - Accounts with 2FA on are redirected to /login/mfa with a challenge cookie, not a session
 * - `state` is bound to the starting browser by a signed cookie (login CSRF defence)
 * - Only provider-verified emails are accepted; an existing password account is never
 *   auto-linked by email (the owner links from Settings while signed in)
 * Primary docs: https://developers.google.com/identity/openid-connect/openid-connect
 * https://www.rfc-editor.org/rfc/rfc9700
 */

use crate::accounts::{OAuthPending, OAuthProvider, UserRecord};
use crate::auth::{
    issue_session, oauth_clear_cookie, oauth_set_cookie, pkce_challenge, pkce_verifier,
    random_token, read_oauth_state, request_user_agent, ClientIp,
};
use crate::routes::require_user;
use crate::security::notify_change;
use crate::config::WebConfig;
use crate::limit::{AUTH_LIMIT, AUTH_WINDOW};
use crate::AppState;
use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Redirect};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

/// Identity returned by a provider after code exchange.
pub struct OAuthProfile {
    pub subject: String,
    pub email: String,
    pub name: String,
}

/// Starts the GitHub Authorization Code + PKCE redirect.
pub async fn github_start(
    State(state): State<AppState>,
    ip: ClientIp,
) -> impl IntoResponse {
    if !state
        .limiter
        .check("oauth", ip.as_str(), AUTH_LIMIT, AUTH_WINDOW)
        .await
    {
        return (StatusCode::TOO_MANY_REQUESTS, "rate limited").into_response();
    }
    start_oauth(&state, OAuthProvider::GitHub).await
}

/// Starts the Google OIDC Authorization Code + PKCE redirect (includes nonce).
pub async fn google_start(
    State(state): State<AppState>,
    ip: ClientIp,
) -> impl IntoResponse {
    if !state
        .limiter
        .check("oauth", ip.as_str(), AUTH_LIMIT, AUTH_WINDOW)
        .await
    {
        return (StatusCode::TOO_MANY_REQUESTS, "rate limited").into_response();
    }
    start_oauth(&state, OAuthProvider::Google).await
}

/// Exchanges the GitHub callback code and establishes a session.
pub async fn github_callback(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Query(query): Query<OAuthCallbackQuery>,
) -> impl IntoResponse {
    finish_oauth(&state, OAuthProvider::GitHub, query, &headers, &ip).await
}

/// Exchanges the Google callback code, checks nonce, and establishes a session.
pub async fn google_callback(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Query(query): Query<OAuthCallbackQuery>,
) -> impl IntoResponse {
    finish_oauth(&state, OAuthProvider::Google, query, &headers, &ip).await
}

/// Builds the provider authorize URL after persisting PKCE state.
async fn start_oauth(state: &AppState, provider: OAuthProvider) -> axum::response::Response {
    let (client_id, authorize, extra_nonce) = match provider {
        OAuthProvider::GitHub => {
            let Some(id) = state.config.github_client_id.as_deref() else {
                return (StatusCode::SERVICE_UNAVAILABLE, "github oauth is not configured").into_response();
            };
            (id, "https://github.com/login/oauth/authorize", false)
        }
        OAuthProvider::Google => {
            let Some(id) = state.config.google_client_id.as_deref() else {
                return (StatusCode::SERVICE_UNAVAILABLE, "google oauth is not configured").into_response();
            };
            (
                id,
                "https://accounts.google.com/o/oauth2/v2/auth",
                true,
            )
        }
    };
    let state_token = random_token();
    let verifier = pkce_verifier();
    let nonce = extra_nonce.then(random_token);
    let pending = OAuthPending {
        state: state_token.clone(),
        provider,
        code_verifier: verifier.clone(),
        nonce: nonce.clone(),
        expires_at: Utc::now() + Duration::minutes(10),
    };
    if state.accounts.insert_oauth_pending(pending).await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "oauth state persist failed").into_response();
    }
    let redirect_uri = callback_url(&state.config, provider);
    let challenge = pkce_challenge(&verifier);
    let mut url = format!(
        "{authorize}?client_id={}&redirect_uri={}&response_type=code&state={}&code_challenge={}&code_challenge_method=S256",
        urlencoding(&client_id.to_string()),
        urlencoding(&redirect_uri),
        urlencoding(&state_token),
        urlencoding(&challenge),
    );
    match provider {
        OAuthProvider::GitHub => {
            url.push_str("&scope=read:user%20user:email");
        }
        OAuthProvider::Google => {
            url.push_str("&scope=openid%20email%20profile");
            if let Some(nonce) = nonce {
                url.push_str("&nonce=");
                url.push_str(&urlencoding(&nonce));
            }
        }
    }
    let mut response = Redirect::to(&url).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, oauth_set_cookie(&state.config, &state_token));
    response
}

/// Why an OAuth identity could not be turned into a signed-in user.
#[derive(Debug)]
enum OAuthUserError {
    /// The email belongs to a password account; the owner must link while signed in.
    LinkRequired,
    /// The provider identity is already linked to a different Faelith account.
    LinkedElsewhere,
    /// Store failure.
    Store(String),
}

impl From<String> for OAuthUserError {
    fn from(error: String) -> Self {
        Self::Store(error)
    }
}

/// Redirects back to the login page with an error code and clears the state cookie.
fn oauth_failure(state: &AppState, code: &str) -> axum::response::Response {
    let mut response = Redirect::to(&format!("/login?error={code}")).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, oauth_clear_cookie(&state.config));
    response
}

/// Completes the OAuth callback, creating or linking a user then setting the cookie.
async fn finish_oauth(
    state: &AppState,
    expected: OAuthProvider,
    query: OAuthCallbackQuery,
    headers: &HeaderMap,
    ip: &ClientIp,
) -> axum::response::Response {
    if query.error.is_some() {
        return oauth_failure(state, "oauth");
    }
    let (Some(code), Some(state_token)) = (query.code, query.state) else {
        return (StatusCode::BAD_REQUEST, "missing oauth code or state").into_response();
    };
    let bound = read_oauth_state(headers, &state.config);
    let same_browser = bound.as_deref().is_some_and(|expected| {
        bool::from(subtle::ConstantTimeEq::ct_eq(expected.as_bytes(), state_token.as_bytes()))
    });
    if !same_browser {
        return (StatusCode::BAD_REQUEST, "oauth state mismatch").into_response();
    }
    let pending = match state.accounts.take_oauth_pending(&state_token).await {
        Ok(Some(pending)) if pending.provider == expected => pending,
        Ok(Some(_)) => {
            return (StatusCode::BAD_REQUEST, "oauth provider mismatch").into_response();
        }
        _ => return (StatusCode::BAD_REQUEST, "oauth state mismatch").into_response(),
    };
    let profile = match expected {
        OAuthProvider::GitHub => exchange_github(state, &code, &pending.code_verifier).await,
        OAuthProvider::Google => {
            exchange_google(state, &code, &pending.code_verifier, pending.nonce.as_deref()).await
        }
    };
    let profile = match profile {
        Ok(profile) => profile,
        Err(error) => {
            tracing::error!(error = %error, "oauth exchange failed");
            return oauth_failure(state, "oauth");
        }
    };
    let session_user = require_user(state, headers).await.ok();
    let linking = session_user.is_some();
    let user = match upsert_oauth_user(state, expected, &profile, session_user).await {
        Ok(user) => user,
        Err(OAuthUserError::LinkRequired) => return oauth_failure(state, "oauth_link"),
        Err(OAuthUserError::LinkedElsewhere) => return oauth_failure(state, "oauth_taken"),
        Err(OAuthUserError::Store(error)) => {
            tracing::error!(error = %error, "oauth user failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "oauth user failed").into_response();
        }
    };
    if linking {
        notify_change(state, &user.email, &format!("{expected:?} sign-in was linked"));
        let mut response = Redirect::to("/app/settings").into_response();
        response
            .headers_mut()
            .insert(header::SET_COOKIE, oauth_clear_cookie(&state.config));
        return response;
    }
    match crate::security::begin_challenge(state, user.id).await {
        Ok(Some((challenge, _))) => {
            let mut response = Redirect::to("/login/mfa").into_response();
            let cookies = response.headers_mut();
            cookies.append(
                header::SET_COOKIE,
                crate::auth::mfa_set_cookie(&state.config, &challenge),
            );
            cookies.append(header::SET_COOKIE, oauth_clear_cookie(&state.config));
            return response;
        }
        Ok(None) => {}
        Err(error) => {
            tracing::error!(error = %error, "mfa challenge failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "session failed").into_response();
        }
    }
    let token = match issue_session(
        state.accounts.as_ref(),
        user.id,
        request_user_agent(headers),
        Some(ip.as_str()),
    )
    .await {
        Ok(token) => token,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "session failed").into_response(),
    };
    let mut response = Redirect::to("/app").into_response();
    let cookies = response.headers_mut();
    cookies.append(header::SET_COOKIE, crate::auth::session_set_cookie(&state.config, &token));
    cookies.append(header::SET_COOKIE, oauth_clear_cookie(&state.config));
    response
}

/// Resolves the Faelith user for a verified provider identity.
///
/// Order: an identity already linked wins; a signed-in user links explicitly;
/// an OAuth-only account with the same verified email is joined; a password
/// account is never auto-linked (that would let anyone who controls a
/// provider account with the victim's email take over the account); otherwise
/// a new organization and user are created.
async fn upsert_oauth_user(
    state: &AppState,
    provider: OAuthProvider,
    profile: &OAuthProfile,
    session_user: Option<UserRecord>,
) -> Result<UserRecord, OAuthUserError> {
    if let Some(existing) = state
        .accounts
        .get_user_by_oauth(provider, &profile.subject)
        .await?
    {
        if session_user.as_ref().is_some_and(|current| current.id != existing.id) {
            return Err(OAuthUserError::LinkedElsewhere);
        }
        return Ok(existing);
    }
    if let Some(current) = session_user {
        state
            .accounts
            .link_oauth(current.id, provider, &profile.subject)
            .await?;
        return Ok(current);
    }
    let email = crate::auth::normalize_email(&profile.email);
    if let Some(existing) = state.accounts.get_user_by_email(&email).await? {
        if existing.password_hash.is_some() {
            return Err(OAuthUserError::LinkRequired);
        }
        state
            .accounts
            .link_oauth(existing.id, provider, &profile.subject)
            .await?;
        return Ok(existing);
    }
    let org_id = state
        .store
        .create_org(&format!("user-{}", &email))
        .await
        .map_err(|_| OAuthUserError::Store("create org failed".to_string()))?;
    let user = UserRecord {
        id: Uuid::new_v4(),
        org_id,
        email,
        password_hash: None,
        name: profile.name.clone(),
    };
    state.accounts.insert_user(user.clone()).await?;
    state
        .accounts
        .link_oauth(user.id, provider, &profile.subject)
        .await?;
    Ok(user)
}

/// Exchanges a GitHub code and loads the public profile plus primary email.
async fn exchange_github(
    state: &AppState,
    code: &str,
    verifier: &str,
) -> Result<OAuthProfile, String> {
    let client_id = state
        .config
        .github_client_id
        .as_deref()
        .ok_or_else(|| "github oauth is not configured".to_string())?;
    let client_secret = state
        .config
        .github_client_secret
        .as_deref()
        .ok_or_else(|| "github oauth is not configured".to_string())?;
    let redirect_uri = callback_url(&state.config, OAuthProvider::GitHub);
    let token_json: Value = state
        .http
        .post("https://github.com/login/oauth/access_token")
        .header(header::ACCEPT, "application/json")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code),
            ("redirect_uri", &redirect_uri),
            ("code_verifier", verifier),
        ])
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    let access = token_json
        .get("access_token")
        .and_then(Value::as_str)
        .ok_or_else(|| "github token missing".to_string())?;
    let user: Value = state
        .http
        .get("https://api.github.com/user")
        .header(header::USER_AGENT, "faelith-web")
        .header(header::AUTHORIZATION, format!("Bearer {access}"))
        .header(header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    let subject = user
        .get("id")
        .map(|value| match value {
            Value::Number(number) => number.to_string(),
            Value::String(raw) => raw.clone(),
            _ => String::new(),
        })
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "github subject missing".to_string())?;
    // The profile `email` field carries no verification flag, so the address
    // always comes from /user/emails and must be both primary and verified.
    // Docs: https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user
    let emails: Value = state
        .http
        .get("https://api.github.com/user/emails")
        .header(header::USER_AGENT, "faelith-web")
        .header(header::AUTHORIZATION, format!("Bearer {access}"))
        .header(header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    let email = verified_primary_github_email(&emails)
        .ok_or_else(|| "github primary email missing or unverified".to_string())?;
    let name = user
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| user.get("login").and_then(Value::as_str))
        .unwrap_or("GitHub user")
        .to_string();
    Ok(OAuthProfile {
        subject,
        email,
        name,
    })
}

/// Exchanges a Google code and checks nonce/aud/iss on the id_token payload.
async fn exchange_google(
    state: &AppState,
    code: &str,
    verifier: &str,
    nonce: Option<&str>,
) -> Result<OAuthProfile, String> {
    let client_id = state
        .config
        .google_client_id
        .as_deref()
        .ok_or_else(|| "google oauth is not configured".to_string())?;
    let client_secret = state
        .config
        .google_client_secret
        .as_deref()
        .ok_or_else(|| "google oauth is not configured".to_string())?;
    let redirect_uri = callback_url(&state.config, OAuthProvider::Google);
    let token_json: Value = state
        .http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", &redirect_uri),
            ("code_verifier", verifier),
        ])
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    let id_token = token_json
        .get("id_token")
        .and_then(Value::as_str)
        .ok_or_else(|| "google id_token missing".to_string())?;
    let claims = verify_google_id_token(&state.http, id_token, client_id).await?;
    if let Some(expected_nonce) = nonce {
        let got = claims.nonce.as_deref().unwrap_or("");
        if got != expected_nonce {
            return Err("google nonce mismatch".to_string());
        }
    }
    if claims.email_verified != Some(true) {
        return Err("google email is not verified".to_string());
    }
    let email = claims
        .email
        .ok_or_else(|| "google email missing".to_string())?;
    let name = claims.name.unwrap_or_else(|| "Google user".to_string());
    Ok(OAuthProfile {
        subject: claims.sub,
        email,
        name,
    })
}

/// Google ID token claims after RS256 verification (iss/aud/exp enforced by jsonwebtoken).
#[derive(Debug, Deserialize)]
struct GoogleIdClaims {
    sub: String,
    email: Option<String>,
    email_verified: Option<bool>,
    name: Option<String>,
    nonce: Option<String>,
}

/// How long fetched Google signing keys are reused before refreshing.
const JWKS_TTL: std::time::Duration = std::time::Duration::from_secs(3_600);

/// Process-wide JWKS cache: (fetched at, document).
static JWKS_CACHE: std::sync::Mutex<Option<(std::time::Instant, Value)>> = std::sync::Mutex::new(None);

/// Returns Google's JWKS, refetching when stale or when `kid` is unknown (key rotation).
async fn google_jwks(http: &reqwest::Client, kid: &str) -> Result<Value, String> {
    let has_kid = |jwks: &Value| {
        jwks.get("keys")
            .and_then(Value::as_array)
            .is_some_and(|keys| keys.iter().any(|key| key.get("kid").and_then(Value::as_str) == Some(kid)))
    };
    if let Ok(cache) = JWKS_CACHE.lock() {
        if let Some((fetched, jwks)) = cache.as_ref() {
            if fetched.elapsed() < JWKS_TTL && has_kid(jwks) {
                return Ok(jwks.clone());
            }
        }
    }
    let jwks: Value = http
        .get("https://www.googleapis.com/oauth2/v3/certs")
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;
    if let Ok(mut cache) = JWKS_CACHE.lock() {
        *cache = Some((std::time::Instant::now(), jwks.clone()));
    }
    Ok(jwks)
}

/// Verifies Google's id_token with RS256 keys from the official JWKS endpoint.
///
/// Docs: https://developers.google.com/identity/openid-connect/openid-connect
/// JWKS: https://www.googleapis.com/oauth2/v3/certs
async fn verify_google_id_token(
    http: &reqwest::Client,
    token: &str,
    client_id: &str,
) -> Result<GoogleIdClaims, String> {
    let header = decode_header(token).map_err(|_| "id_token header invalid".to_string())?;
    if header.alg != Algorithm::RS256 {
        return Err("id_token alg must be RS256".to_string());
    }
    let kid = header
        .kid
        .ok_or_else(|| "id_token kid missing".to_string())?;
    let jwks = google_jwks(http, &kid).await?;
    let keys = jwks
        .get("keys")
        .and_then(Value::as_array)
        .ok_or_else(|| "jwks keys missing".to_string())?;
    let jwk = keys
        .iter()
        .find(|key| key.get("kid").and_then(Value::as_str) == Some(kid.as_str()))
        .ok_or_else(|| "jwks kid not found".to_string())?;
    let n = jwk
        .get("n")
        .and_then(Value::as_str)
        .ok_or_else(|| "jwk n missing".to_string())?;
    let e = jwk
        .get("e")
        .and_then(Value::as_str)
        .ok_or_else(|| "jwk e missing".to_string())?;
    let key = DecodingKey::from_rsa_components(n, e)
        .map_err(|_| "jwk rsa key failed".to_string())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[client_id]);
    validation.set_issuer(&["https://accounts.google.com", "accounts.google.com"]);
    validation.validate_exp = true;
    decode::<GoogleIdClaims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(|_| "id_token verify failed".to_string())
}

/// Picks the primary address from GitHub's `/user/emails`, only when verified.
pub(crate) fn verified_primary_github_email(emails: &Value) -> Option<String> {
    emails.as_array()?.iter().find_map(|row| {
        let primary = row.get("primary").and_then(Value::as_bool).unwrap_or(false);
        let verified = row.get("verified").and_then(Value::as_bool).unwrap_or(false);
        let email = row.get("email").and_then(Value::as_str)?.trim();
        (primary && verified && !email.is_empty()).then(|| email.to_string())
    })
}

/// Callback URL registered with the identity provider.
fn callback_url(config: &WebConfig, provider: OAuthProvider) -> String {
    match provider {
        OAuthProvider::GitHub => format!("{}/auth/github/callback", config.public_origin),
        OAuthProvider::Google => format!("{}/auth/google/callback", config.public_origin),
    }
}

/// Minimal URL encoder for query values.
fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
