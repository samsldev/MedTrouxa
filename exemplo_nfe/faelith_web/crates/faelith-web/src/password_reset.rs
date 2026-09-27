/**
 * @fileoverview Self-service password reset by emailed single-use link.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Forgot always answers 202 so the form cannot enumerate registered emails
 * - Tokens are 256-bit random, stored only as SHA-256, single use, 30-minute TTL
 * - The link carries the token in the URL fragment (never logged or sent as Referer)
 * - A reset revokes every session and never signs the user in: 2FA still applies at login
 * Primary docs: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
 */

use crate::auth::{hash_password, normalize_email, random_token, token_hash, ClientIp};
use crate::limit::{AUTH_LIMIT, AUTH_WINDOW};
use crate::mailer::password_reset_email;
use crate::routes::{csrf_origin, err};
use crate::security::notify_change;
use crate::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::json;

/// Lifetime of a reset link.
const RESET_TTL_MINUTES: i64 = 30;

#[derive(Debug, Deserialize)]
pub struct ForgotBody {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetBody {
    pub token: String,
    pub password: String,
}

/// Applies the shared auth limit; returns a 429 when the caller is over it.
async fn limited(state: &AppState, bucket: &str, key: &str) -> Option<Response> {
    (!state.limiter.check(bucket, key, AUTH_LIMIT, AUTH_WINDOW).await)
        .then(|| err(StatusCode::TOO_MANY_REQUESTS, "rate limited"))
}

/// POST /auth/password/forgot — emails a reset link when the account exists.
///
/// The response is identical for unknown emails, and delivery runs in the
/// background so response timing does not reveal registration either.
pub async fn forgot_password(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<ForgotBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let email = normalize_email(&body.email);
    if let Some(response) = limited(&state, "reset-ip", ip.as_str()).await {
        return response;
    }
    if let Some(response) = limited(&state, "reset-email", &email).await {
        return response;
    }
    let accepted = (StatusCode::ACCEPTED, Json(json!({ "sent": true }))).into_response();
    let user = match state.accounts.get_user_by_email(&email).await {
        Ok(Some(user)) => user,
        Ok(None) => return accepted,
        Err(error) => {
            tracing::error!(error = %error, "reset lookup failed");
            return accepted;
        }
    };
    let token = random_token();
    let expires = Utc::now() + Duration::minutes(RESET_TTL_MINUTES);
    if let Err(error) = state
        .security
        .insert_password_reset(&token_hash(&token), user.id, expires)
        .await
    {
        tracing::error!(error = %error, "reset persist failed");
        return err(StatusCode::INTERNAL_SERVER_ERROR, "internal error");
    }
    let link = format!(
        "{}/reset-password#token={token}",
        state.config.public_origin.trim_end_matches('/')
    );
    let mailer = state.mailer.clone();
    let email = password_reset_email(&user.email, &link, RESET_TTL_MINUTES);
    tokio::spawn(async move {
        if let Err(error) = mailer.send(email).await {
            tracing::warn!(error = %error, "password reset email failed");
        }
    });
    accepted
}

/// POST /auth/password/reset — consumes the token, sets the password, and revokes sessions.
pub async fn reset_password(
    State(state): State<AppState>,
    ip: ClientIp,
    headers: HeaderMap,
    Json(body): Json<ResetBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    if let Some(response) = limited(&state, "reset-ip", ip.as_str()).await {
        return response;
    }
    let hash = match hash_password(&body.password) {
        Ok(hash) => hash,
        Err(message) => return err(StatusCode::BAD_REQUEST, &message),
    };
    let user_id = match state.security.take_password_reset(&token_hash(body.token.trim())).await {
        Ok(Some(user_id)) => user_id,
        Ok(None) => return err(StatusCode::BAD_REQUEST, "this reset link is invalid or expired"),
        Err(error) => {
            tracing::error!(error = %error, "reset take failed");
            return err(StatusCode::INTERNAL_SERVER_ERROR, "internal error");
        }
    };
    let user = match state.accounts.get_user_by_id(user_id).await {
        Ok(Some(user)) => user,
        _ => return err(StatusCode::BAD_REQUEST, "this reset link is invalid or expired"),
    };
    if state.accounts.set_password_hash(user.id, Some(hash)).await.is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "password update failed");
    }
    let _ = state.accounts.delete_sessions_for_user(user.id).await;
    notify_change(&state, &user.email, "your password was reset and every session was signed out");
    StatusCode::NO_CONTENT.into_response()
}
