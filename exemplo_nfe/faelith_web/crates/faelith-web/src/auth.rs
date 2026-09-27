/**
 * @fileoverview Argon2id passwords, session cookies, CSRF tokens, and Origin checks.
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
 * - Uniform login errors so account existence is not leaked
 * - Session cookie is HttpOnly, SameSite=Lax, Path=/, HMAC-signed with COOKIE_SECRET, and Secure when HTTPS
 * - CSRF requires Origin AND Host to match PUBLIC_ORIGIN on mutating requests
 * - Pending 2FA logins ride a separate 10-minute signed cookie that never grants a session
 * Primary docs: https://docs.rs/argon2/latest/argon2/
 * https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
 */

use crate::accounts::{AccountStore, SessionRecord, session_ttl};
use crate::config::WebConfig;
use crate::AppState;
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::{ConnectInfo, FromRequestParts, Request, State};
use axum::http::request::Parts;
use axum::http::{header, HeaderMap, HeaderValue};
use axum::middleware::Next;
use axum::response::Response;
use chrono::Utc;
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::net::{IpAddr, SocketAddr};
use subtle::ConstantTimeEq;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// Minimum password length accepted at signup and password change.
pub const MIN_PASSWORD_LEN: usize = 10;

/// Maximum password length; bounds Argon2 input so huge bodies cannot burn CPU.
pub const MAX_PASSWORD_LEN: usize = 256;

/// Uniform message used for every credential failure.
pub const INVALID_CREDENTIALS: &str = "invalid email or password";

/// Dummy Argon2 hash used when the email is unknown so verify still runs.
pub fn dummy_password_hash() -> String {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(b"timing-pad-password", &salt)
        .expect("argon2 dummy")
        .to_string()
}

/// Hashes a password with Argon2id. Rejects short secrets.
pub fn hash_password(password: &str) -> Result<String, String> {
    if password.len() < MIN_PASSWORD_LEN {
        return Err("password must be at least 10 characters".to_string());
    }
    if password.len() > MAX_PASSWORD_LEN {
        return Err("password must be at most 256 characters".to_string());
    }
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| err.to_string())
}

/// Verifies a password against a PHC string. Always hashes when hash is missing.
pub fn verify_password(password: &str, stored: Option<&str>, dummy: &str) -> bool {
    if password.len() > MAX_PASSWORD_LEN {
        return false;
    }
    let hash = stored.unwrap_or(dummy);
    let parsed = match PasswordHash::new(hash) {
        Ok(parsed) => parsed,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
        && stored.is_some()
}

/// Lowercases and trims an email address.
pub fn normalize_email(email: &str) -> String {
    email.trim().to_ascii_lowercase()
}

/// SHA-256 hex of a session or CSRF token.
pub fn token_hash(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Generates a 32-byte hex token for cookies and CSRF.
pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Issues a new session row and returns the unsigned token (HMAC-signed when set as a cookie).
pub async fn issue_session(
    accounts: &dyn AccountStore,
    user_id: Uuid,
    user_agent: Option<&str>,
    ip: Option<&str>,
) -> Result<String, String> {
    let token = random_token();
    let now = Utc::now();
    let record = SessionRecord {
        id: Uuid::new_v4(),
        user_id,
        token_hash: token_hash(&token),
        expires_at: now + session_ttl(),
        rotated_at: now,
        user_agent_hash: user_agent.map(token_hash),
        ip_hash: ip.map(token_hash),
    };
    accounts.insert_session(record).await?;
    Ok(token)
}

/// HMAC-SHA256 hex of the session token using COOKIE_SECRET.
pub fn sign_session_token(secret: &[u8], token: &str) -> Result<String, String> {
    let mut mac = HmacSha256::new_from_slice(secret).map_err(|err| err.to_string())?;
    mac.update(token.as_bytes());
    Ok(format!(
        "{token}.{}",
        hex::encode(mac.finalize().into_bytes())
    ))
}

/// Verifies the cookie MAC and returns the raw session token.
pub fn verify_session_token(secret: &[u8], value: &str) -> Option<String> {
    let (token, sig) = value.rsplit_once('.')?;
    if token.is_empty() || sig.is_empty() {
        return None;
    }
    let mut mac = HmacSha256::new_from_slice(secret).ok()?;
    mac.update(token.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    if expected.as_bytes().ct_eq(sig.as_bytes()).into() {
        Some(token.to_string())
    } else {
        None
    }
}

/// Builds a Set-Cookie header for the HMAC-signed session token.
pub fn session_set_cookie(config: &WebConfig, token: &str) -> HeaderValue {
    let signed = sign_session_token(&config.cookie_secret, token).unwrap_or_default();
    cookie_header(
        config.session_cookie_name(),
        &signed,
        config.cookie_secure,
        1_209_600,
    )
}

/// Builds a Set-Cookie header that expires the session.
pub fn session_clear_cookie(config: &WebConfig) -> HeaderValue {
    cookie_header(config.session_cookie_name(), "", config.cookie_secure, 0)
}

/// Formats an HttpOnly SameSite=Lax cookie, adding Secure when required.
fn cookie_header(name: &str, value: &str, secure: bool, max_age: i64) -> HeaderValue {
    let mut raw = format!("{name}={value}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}");
    if secure {
        raw.push_str("; Secure");
    }
    HeaderValue::from_str(&raw).unwrap_or_else(|_| HeaderValue::from_static("faelith-sid=; Path=/"))
}

/// Lifetime of the OAuth state cookie, matching the pending row.
pub const OAUTH_COOKIE_MAX_AGE: i64 = 600;

/// Builds a Set-Cookie header binding the OAuth `state` to this browser.
///
/// Without it a callback URL minted by an attacker could log a victim into
/// the attacker's account (login CSRF, RFC 9700 section 4.7).
pub fn oauth_set_cookie(config: &WebConfig, state_token: &str) -> HeaderValue {
    let signed = sign_session_token(&config.cookie_secret, state_token).unwrap_or_default();
    cookie_header(config.oauth_cookie_name(), &signed, config.cookie_secure, OAUTH_COOKIE_MAX_AGE)
}

/// Builds a Set-Cookie header that expires the OAuth state cookie.
pub fn oauth_clear_cookie(config: &WebConfig) -> HeaderValue {
    cookie_header(config.oauth_cookie_name(), "", config.cookie_secure, 0)
}

/// Reads the verified OAuth state bound to this browser.
pub fn read_oauth_state(headers: &HeaderMap, config: &WebConfig) -> Option<String> {
    read_signed_cookie(headers, config, config.oauth_cookie_name())
}

/// Lifetime of the pending two-factor login cookie, matching the challenge row.
pub const MFA_COOKIE_MAX_AGE: i64 = 600;

/// Builds a Set-Cookie header for the HMAC-signed two-factor challenge token.
pub fn mfa_set_cookie(config: &WebConfig, token: &str) -> HeaderValue {
    let signed = sign_session_token(&config.cookie_secret, token).unwrap_or_default();
    cookie_header(
        config.mfa_cookie_name(),
        &signed,
        config.cookie_secure,
        MFA_COOKIE_MAX_AGE,
    )
}

/// Builds a Set-Cookie header that expires the two-factor challenge.
pub fn mfa_clear_cookie(config: &WebConfig) -> HeaderValue {
    cookie_header(config.mfa_cookie_name(), "", config.cookie_secure, 0)
}

/// Reads the verified two-factor challenge token from the Cookie header.
pub fn read_mfa_token(headers: &HeaderMap, config: &WebConfig) -> Option<String> {
    read_signed_cookie(headers, config, config.mfa_cookie_name())
}

/// Reads the session token from the Cookie header.
pub fn read_session_token(headers: &HeaderMap, config: &WebConfig) -> Option<String> {
    read_signed_cookie(headers, config, config.session_cookie_name())
}

/// Finds cookie `name` and returns its token only when the HMAC verifies.
fn read_signed_cookie(headers: &HeaderMap, config: &WebConfig, name: &str) -> Option<String> {
    let cookie = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in cookie.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix(name).and_then(|rest| rest.strip_prefix('=')) {
            if !value.is_empty() {
                return verify_session_token(&config.cookie_secret, value);
            }
        }
    }
    None
}

/// Returns true when Origin is present and matches PUBLIC_ORIGIN, and Host matches the origin host.
/// Missing Origin is rejected. Stripe webhooks are exempt at the call site.
pub fn origin_allowed(headers: &HeaderMap, public_origin: &str) -> bool {
    let Some(origin) = headers.get(header::ORIGIN).and_then(|value| value.to_str().ok()) else {
        return false;
    };
    if origin != public_origin {
        return false;
    }
    let Ok(parsed) = url::Url::parse(public_origin) else {
        return false;
    };
    let expected_host = match parsed.port() {
        Some(port) => format!("{}:{port}", parsed.host_str().unwrap_or("")),
        None => parsed.host_str().unwrap_or("").to_string(),
    };
    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .or_else(|| {
            headers
                .get("x-forwarded-host")
                .and_then(|value| value.to_str().ok())
                .and_then(|raw| raw.split(',').next())
                .map(str::trim)
        });
    host == Some(expected_host.as_str())
}

/// Client IP used as the rate-limit and session-binding key.
///
/// The peer address is authoritative. `X-Forwarded-For` is used only when
/// `TRUST_FORWARDED_HEADERS=1` (reverse proxy that overwrites the header).
#[derive(Clone, Debug)]
pub struct ClientIp(String);

impl ClientIp {
    /// Address string (`unknown` when the peer is missing).
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S> FromRequestParts<S> for ClientIp
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Ok(parts
            .extensions
            .get::<ClientIp>()
            .cloned()
            .unwrap_or_else(|| ClientIp("unknown".into())))
    }
}

/// Resolves the client IP from the TCP peer, optionally trusting X-Forwarded-For.
pub fn resolve_client_ip(headers: &HeaderMap, peer: Option<&str>, trust_forwarded: bool) -> String {
    if trust_forwarded {
        if let Some(ip) = forwarded_client_ip(headers) {
            return ip;
        }
    }
    peer.filter(|value| !value.is_empty())
        .filter(|value| value.parse::<IpAddr>().is_ok())
        .unwrap_or("unknown")
        .to_string()
}

/// Right-most X-Forwarded-For hop when it parses as an IP address.
///
/// The right-most entry is the one appended by the trusted reverse proxy; the
/// left-most entry is client-controlled and would let callers rotate fake IPs
/// to evade every rate limit.
fn forwarded_client_ip(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get("x-forwarded-for")?.to_str().ok()?;
    let last = raw.rsplit(',').next()?.trim();
    last
        .parse::<IpAddr>()
        .ok()
        .map(|ip| ip.to_string())
}

/// Inserts `ClientIp` from the TCP peer (or trusted forwarded headers).
pub async fn attach_client_ip(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| addr.ip().to_string());
    let ip = resolve_client_ip(
        request.headers(),
        peer.as_deref(),
        state.config.trust_forwarded,
    );
    request.extensions_mut().insert(ClientIp(ip));
    next.run(request).await
}

/// User-Agent string when the header is valid UTF-8.
pub fn request_user_agent(headers: &HeaderMap) -> Option<&str> {
    headers.get(header::USER_AGENT).and_then(|value| value.to_str().ok())
}

/// PKCE S256 code_challenge = BASE64URL(SHA256(verifier)).
pub fn pkce_challenge(verifier: &str) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// Generates a high-entropy PKCE code_verifier (43–128 unreserved chars).
pub fn pkce_verifier() -> String {
    random_token()
}

#[cfg(test)]
mod tests {
    use super::resolve_client_ip;
    use axum::http::{HeaderMap, HeaderValue};

    fn headers_with_xff(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_str(value).unwrap());
        headers
    }

    #[test]
    fn untrusted_forwarded_for_is_ignored() {
        let headers = headers_with_xff("203.0.113.9, 10.0.0.1");
        assert_eq!(
            resolve_client_ip(&headers, Some("192.0.2.10"), false),
            "192.0.2.10"
        );
        assert_eq!(resolve_client_ip(&headers, None, false), "unknown");
    }

    #[test]
    fn trusted_forwarded_for_uses_rightmost_ip() {
        let headers = headers_with_xff("203.0.113.9, 10.0.0.1");
        assert_eq!(
            resolve_client_ip(&headers, Some("192.0.2.10"), true),
            "10.0.0.1"
        );
    }

    #[test]
    fn non_ip_forwarded_for_is_rejected() {
        let headers = headers_with_xff("not-an-ip");
        assert_eq!(
            resolve_client_ip(&headers, Some("192.0.2.10"), true),
            "192.0.2.10"
        );
    }
}
