/**
 * @fileoverview Axum origin for the Faelith Industries website.
 * @author Samuel S. L.
 * @version 1.12.0
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
 * - Same-origin SPA + dashboard API with HttpOnly session cookies
 * - Subscribers redeem admin-granted usage resets at POST /api/usage/reset/redeem
 * - Stripe webhooks verified on the raw body; OAuth uses PKCE S256
 * - Email-verified signup and TOTP / email / backup-code 2FA (security.rs)
 * Primary docs: https://docs.rs/axum/latest/axum/
 * https://docs.stripe.com/webhooks
 * https://vite.dev/guide/
 */

pub mod accounts;
pub mod admin;
pub mod admin_billing;
pub mod analytics;
pub mod analytics_store;
pub mod audit_store;
pub mod auth;
pub mod chat;
pub mod chat_store;
pub mod cli_device;
pub mod config;
pub mod headers;
pub mod limit;
pub mod mailer;
pub mod mfa;
pub mod nfse;
pub mod oauth;
pub mod password_reset;
pub mod refunds;
pub mod retention;
pub mod routes;
pub mod security;
pub mod security_store;
pub mod stripe;
#[cfg(test)]
mod hardening_tests;
#[cfg(test)]
mod security_tests;
#[cfg(test)]
mod test_support;

use crate::accounts::AccountStore;
use crate::analytics_store::{AnalyticsStore, MemoryAnalytics};
use crate::audit_store::{AuditStore, MemoryAudit};
use crate::auth::{
    attach_client_ip, dummy_password_hash,
};
use crate::chat_store::WebChatStore;
use crate::config::WebConfig;
use crate::headers::security_headers;
use crate::limit::AuthLimiter;
use crate::mailer::Mailer;
use crate::mfa::MfaKeys;
use crate::security_store::SecurityStore;
use crate::stripe::StripeClient;
use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::{any, delete, get, patch, post};
use axum::Router;
use faelith_core::store::PlatformStore;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;

/// Shared web origin state. Clone is cheap (Arcs).
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<WebConfig>,
    pub store: Arc<dyn PlatformStore>,
    pub accounts: Arc<dyn AccountStore>,
    pub limiter: Arc<dyn AuthLimiter>,
    pub stripe: Arc<dyn StripeClient>,
    pub http: reqwest::Client,
    pub dummy_hash: String,
    /// Website Chat threads and the encrypted server-managed chat key.
    pub chat: Arc<dyn WebChatStore>,
    /// Abort flags for running chat turns, keyed by `user_id:thread_id`.
    pub chat_runs: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    /// Pending signups, 2FA factors, challenges, and step-up codes.
    pub security: Arc<dyn SecurityStore>,
    /// Transactional email (verification and 2FA codes, security notices).
    pub mailer: Arc<dyn Mailer>,
    /// Subkeys derived from MFA_SECRET for sealing seeds and MACing codes.
    pub mfa_keys: MfaKeys,
    /// First-party marketing tracker rows (page views, click points).
    pub analytics: Arc<dyn AnalyticsStore>,
    /// Append-only log of admin console actions.
    pub audit: Arc<dyn AuditStore>,
    /// NFS-e documents and fiscal identities (always available, so webhooks can enqueue).
    pub nfse: Arc<dyn crate::nfse::store::NfseStore>,
    /// Configured NFS-e emitter; None when NFSE_ENABLED is off.
    pub nfse_service: Option<Arc<crate::nfse::service::NfseService>>,
}

impl AppState {
    /// Builds state with a cached Argon2 dummy hash for uniform login timing.
    pub fn new(
        config: WebConfig,
        store: Arc<dyn PlatformStore>,
        accounts: Arc<dyn AccountStore>,
        limiter: Arc<dyn AuthLimiter>,
        stripe: Arc<dyn StripeClient>,
        http: reqwest::Client,
        chat: Arc<dyn WebChatStore>,
        security: Arc<dyn SecurityStore>,
        mailer: Arc<dyn Mailer>,
    ) -> Self {
        let mfa_keys = MfaKeys::derive(&config.mfa_secret);
        Self {
            config: Arc::new(config),
            store,
            accounts,
            limiter,
            stripe,
            http,
            dummy_hash: dummy_password_hash(),
            chat,
            chat_runs: Arc::new(Mutex::new(HashMap::new())),
            security,
            mailer,
            mfa_keys,
            analytics: Arc::new(MemoryAnalytics::new()),
            audit: Arc::new(MemoryAudit::new()),
            nfse: Arc::new(crate::nfse::store::MemoryNfse::new()),
            nfse_service: None,
        }
    }

    /// Replaces the in-memory analytics and audit stores (production passes Postgres).
    pub fn with_insight_stores(mut self, analytics: Arc<dyn AnalyticsStore>, audit: Arc<dyn AuditStore>) -> Self {
        self.analytics = analytics;
        self.audit = audit;
        self
    }

    /// Replaces the NFS-e store and sets the emitter (production passes Postgres and, when enabled, the service).
    pub fn with_nfse(
        mut self,
        store: Arc<dyn crate::nfse::store::NfseStore>,
        service: Option<Arc<crate::nfse::service::NfseService>>,
    ) -> Self {
        self.nfse = store;
        self.nfse_service = service;
        self
    }
}

/// Request body cap. Chat attachments (base64 images) need more than the
/// previous 1 MiB; the chat handler applies its own per-message limits.
const CHAT_BODY_LIMIT: usize = 8 * 1_048_576;

/// Builds the public router (auth, dashboard API, chat, webhook, optional SPA).
pub fn app(state: AppState) -> Router {
    let secure = state.config.cookie_secure;
    let dist = state.config.dist_dir.clone();
    let mut router = Router::new()
        .route("/healthz", get(routes::healthz))
        .route("/auth/me", get(routes::me))
        .route("/auth/signup", post(security::signup))
        .route("/auth/signup/verify", post(security::signup_verify))
        .route("/auth/signup/resend", post(security::signup_resend))
        .route("/auth/mfa", get(security::challenge_status))
        .route("/auth/mfa/email", post(security::challenge_send_email))
        .route("/auth/mfa/verify", post(security::challenge_verify))
        .route("/api/security", get(security::security_status))
        .route("/api/security/stepup/email", post(security::stepup_send_email))
        .route("/api/security/totp/setup", post(security::totp_setup))
        .route("/api/security/totp/enable", post(security::totp_enable))
        .route("/api/security/totp/disable", post(security::totp_disable))
        .route("/api/security/email/enable", post(security::email_enable))
        .route("/api/security/email/disable", post(security::email_disable))
        .route("/api/security/backup-codes", post(security::backup_regenerate))
        .route("/auth/login", post(routes::login))
        .route("/auth/logout", post(routes::logout))
        .route("/auth/password/forgot", post(password_reset::forgot_password))
        .route("/auth/password/reset", post(password_reset::reset_password))
        .route("/auth/github", get(oauth::github_start))
        .route("/auth/github/callback", get(oauth::github_callback))
        .route("/auth/google", get(oauth::google_start))
        .route("/auth/google/callback", get(oauth::google_callback))
        .route("/api/csrf", get(routes::csrf_token))
        .route("/api/contact", post(routes::contact))
        .route("/api/overview", get(routes::overview))
        .route("/api/settings", patch(routes::patch_settings))
        .route("/api/settings/password", post(routes::change_password))
        .route("/api/settings/oauth/unlink", post(routes::unlink_oauth))
        .route("/api/account", delete(routes::delete_account))
        .route("/api/keys", get(routes::list_keys).post(routes::create_key))
        .route("/api/keys/{prefix}", delete(routes::revoke_key))
        .route("/api/usage", get(routes::usage))
        .route("/api/usage/reset/redeem", post(routes::redeem_usage_reset))
        .route("/api/spending", get(routes::spending))
        .route("/api/billing", get(routes::billing))
        .route("/api/billing/checkout", post(routes::checkout))
        .route("/api/billing/portal", post(routes::portal))
        .route("/api/billing/invoices", get(routes::invoices))
        .route("/api/billing/refund", post(refunds::refund))
        .route("/api/billing/cancel", post(refunds::cancel))
        .route("/api/t", post(analytics::collect))
        .route("/api/admin/me", get(admin::me))
        .route("/api/admin/orgs/search", get(admin::search))
        .route("/api/admin/orgs/{id}", get(admin::org_detail))
        .route("/api/admin/orgs/{id}/keys", post(admin::create_key))
        .route("/api/admin/orgs/{id}/subscription", post(admin::set_subscription))
        .route("/api/admin/orgs/{id}/credits", post(admin::adjust_credits))
        .route("/api/admin/orgs/{id}/usage-reset", post(admin::grant_usage_reset))
        .route("/api/admin/orgs/{id}/suspend", post(admin::suspend))
        .route("/api/admin/orgs/{id}/unsuspend", post(admin::unsuspend))
        .route("/api/admin/keys/{prefix}/revoke", post(admin::revoke_key))
        .route("/api/admin/audit", get(admin::audit_log))
        .route("/api/admin/nfse", get(nfse::routes::admin_list))
        .route("/api/admin/nfse/{id}/{action}", get(nfse::routes::admin_download).post(nfse::routes::admin_action))
        .route("/api/billing/nfse", get(nfse::routes::my_notes))
        .route("/api/billing/nfse/{id}/{kind}", get(nfse::routes::my_download))
        .route("/api/billing/fiscal-identity", axum::routing::put(nfse::routes::set_identity))
        .route("/api/admin/subscriptions", get(admin_billing::subscriptions))
        .route("/api/admin/analytics/overview", get(analytics::overview))
        .route("/api/admin/analytics/page", get(analytics::page))
        .route("/api/admin/analytics/visitors", get(analytics::visitors))
        .route("/api/admin/analytics/visitors/{id}", get(analytics::visitor))
        .route("/api/billing/retention", get(retention::retention_offer))
        .route("/api/billing/retention/accept", post(retention::accept_retention_offer))
        .route("/api/billing/usage-based", post(routes::set_usage_based))
        .route("/api/cli/device", post(cli_device::start_cli_device))
        .route("/api/cli/device/poll", post(cli_device::poll_cli_device))
        .route("/api/cli/device/{code}", get(cli_device::get_cli_device))
        .route(
            "/api/cli/device/{code}/approve",
            post(cli_device::approve_cli_device),
        )
        .route("/stripe/webhook", post(routes::stripe_webhook))
        .route("/api/chat/threads", get(chat::list_threads).post(chat::new_thread))
        .route(
            "/api/chat/threads/{id}",
            get(chat::get_thread).delete(chat::delete_thread).patch(chat::patch_thread),
        )
        .route("/api/chat/threads/{id}/fork", post(chat::fork_thread))
        .route("/api/chat/purge-temporary", post(chat::purge_temporary))
        .route("/api/chat/usage", get(chat::usage))
        .route("/api/chat/send", post(chat::send))
        .route("/api/chat/abort", post(chat::abort))
        // Unknown API paths answer JSON 404 instead of falling through to the
        // SPA index.html, which the dashboard would otherwise render as an error.
        .route("/api/{*rest}", any(routes::api_not_found))
        .route("/auth/{*rest}", any(routes::api_not_found))
        .layer(DefaultBodyLimit::max(CHAT_BODY_LIMIT))
        .layer(RequestBodyLimitLayer::new(CHAT_BODY_LIMIT))
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn_with_state(secure, security_headers))
        .layer(middleware::from_fn_with_state(state.clone(), attach_client_ip))
        .with_state(state);
    let index = dist.join("index.html");
    if index.exists() {
        router = router.fallback_service(
            ServeDir::new(&dist).not_found_service(ServeFile::new(index)),
        );
    }
    router
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::accounts::{AccountStore, MemoryAccounts};
    use crate::stripe::verify_stripe_signature;
    use axum::body::Body;
    use axum::http::{header, Request, StatusCode};
    use faelith_core::store::{MemoryStore, PlatformStore};
    use http_body_util::BodyExt;
    use serde_json::{json, Value};
    use tower::ServiceExt;
    use crate::test_support::{harness, Harness, harness_with, json_request, session_cookie, signup_verified};

    /// In-memory state for tests that do not need the mailer.
    fn test_state() -> AppState {
        harness().state
    }

    /// Verified signup sets an HttpOnly session cookie that /auth/me accepts.
    #[tokio::test]
    async fn signup_and_login_sets_httponly_cookie() {
        let Harness { state, mailer } = harness();
        let router = app(state);
        let response = signup_verified(&router, &mailer, "a@example.com", "Ada").await;
        assert_eq!(response.status(), StatusCode::OK);
        let cookie = session_cookie(&response);
        assert!(cookie.starts_with("faelith-sid="));
        let set_cookie = response
            .headers()
            .get(header::SET_COOKIE)
            .unwrap()
            .to_str()
            .unwrap();
        assert!(set_cookie.contains("HttpOnly"));
        assert!(set_cookie.contains("SameSite=Lax"));

        let me = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/auth/me")
                    .header(header::COOKIE, &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(me.status(), StatusCode::OK);
        let bytes = me.into_body().collect().await.unwrap().to_bytes();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["email"], "a@example.com");

        let login = router
            .oneshot(json_request(
                "POST",
                "/auth/login",
                json!({"email":"a@example.com","password":"correcthorse"}),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(login.status(), StatusCode::OK);
        assert!(session_cookie(&login).starts_with("faelith-sid="));
    }

    /// Unknown emails use the same error as a bad password.
    #[tokio::test]
    async fn login_unknown_email_is_uniform() {
        let router = app(test_state());
        let response = router
            .oneshot(json_request(
                "POST",
                "/auth/login",
                json!({"email":"missing@example.com","password":"correcthorse"}),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["error"], "invalid email or password");
    }

    /// Cross-site Origin is rejected on POST.
    #[tokio::test]
    async fn csrf_origin_mismatch_is_forbidden() {
        let router = app(test_state());
        let response = router
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/login")
                    .header(header::CONTENT_TYPE, "application/json")
                    .header(header::ORIGIN, "https://evil.example")
                    .body(Body::from(
                        json!({"email":"a@example.com","password":"correcthorse"}).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    /// OAuth callback without a matching state fails closed.
    #[tokio::test]
    async fn oauth_state_mismatch_is_rejected() {
        let router = app(test_state());
        let response = router
            .oneshot(
                Request::builder()
                    .uri("/auth/github/callback?code=abc&state=nope")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    /// Checkout requires an authenticated session.
    #[tokio::test]
    async fn checkout_requires_auth() {
        let router = app(test_state());
        let response = router
            .oneshot(json_request(
                "POST",
                "/api/billing/checkout",
                json!({"kind":"subscription","plan":"starter"}),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    /// Authenticated Checkout returns the hosted Stripe URL from the fake client.
    #[tokio::test]
    async fn checkout_authenticated_returns_url() {
        let Harness { state, mailer } = harness();
        let router = app(state);
        let signup = signup_verified(&router, &mailer, "bill@example.com", "Bill").await;
        let cookie = session_cookie(&signup);
        let response = router
            .oneshot(json_request(
                "POST",
                "/api/billing/checkout",
                json!({"kind":"subscription","plan":"starter"}),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(body["url"].as_str().unwrap().contains("checkout.stripe.com"));
    }

    /// Unsigned webhooks are rejected; replays are acknowledged without double grant.
    #[tokio::test]
    async fn webhook_rejects_bad_signature_and_is_idempotent() {
        let router = app(test_state());
        let bad = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/stripe/webhook")
                    .header("stripe-signature", "t=1,v1=deadbeef")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad.status(), StatusCode::BAD_REQUEST);

        let payload = json!({
            "id": "evt_1",
            "type": "checkout.session.completed",
            "data": {"object": {
                "customer": "cus_1",
                "subscription": "sub_1",
                "metadata": {
                    "org_id": "00000000-0000-0000-0000-000000000001",
                    "kind": "subscription",
                    "plan": "starter"
                }
            }}
        })
        .to_string();
        let secret = "whsec_test_secret";
        let ts = crate::stripe::unix_now();
        use hmac::Mac;
        let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(format!("{ts}.").as_bytes());
        mac.update(payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());
        let header = format!("t={ts},v1={sig}");
        assert!(verify_stripe_signature(secret, &header, payload.as_bytes(), ts).is_ok());

        let first = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/stripe/webhook")
                    .header("stripe-signature", &header)
                    .body(Body::from(payload.clone()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(first.status(), StatusCode::OK);
        let second = router
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/stripe/webhook")
                    .header("stripe-signature", &header)
                    .body(Body::from(payload))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(second.status(), StatusCode::OK);
    }

    /// Contact form requires a one-time CSRF token.
    #[tokio::test]
    async fn contact_requires_csrf_token() {
        let router = app(test_state());
        let denied = router
            .clone()
            .oneshot(json_request(
                "POST",
                "/api/contact",
                json!({"name":"A","email":"a@b.c","message":"hi","csrf":"nope"}),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(denied.status(), StatusCode::FORBIDDEN);

        let token_response = router
            .clone()
            .oneshot(Request::builder().uri("/api/csrf").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let bytes = token_response.into_body().collect().await.unwrap().to_bytes();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        let csrf = body["csrf"].as_str().unwrap();
        let ok = router
            .oneshot(json_request(
                "POST",
                "/api/contact",
                json!({"name":"A","email":"a@b.c","message":"scale quote","csrf":csrf}),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(ok.status(), StatusCode::NO_CONTENT);
    }

    /// Missing Origin is rejected even when Host matches PUBLIC_ORIGIN.
    #[tokio::test]
    async fn csrf_missing_origin_is_forbidden() {
        let router = app(test_state());
        let response = router
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/auth/login")
                    .header(header::CONTENT_TYPE, "application/json")
                    .header(header::HOST, "127.0.0.1:5173")
                    .body(Body::from(
                        json!({"email":"a@example.com","password":"correcthorse"}).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    /// Login lockout returns 429 after AUTH_LIMIT failed attempts.
    #[tokio::test]
    async fn login_lockout_returns_too_many_requests() {
        let router = app(test_state());
        for attempt in 0..10 {
            let response = router
                .clone()
                .oneshot(json_request(
                    "POST",
                    "/auth/login",
                    json!({"email":"lock@example.com","password":"wrong-password"}),
                    None,
                ))
                .await
                .unwrap();
            assert_eq!(
                response.status(),
                StatusCode::UNAUTHORIZED,
                "attempt {attempt}"
            );
        }
        let blocked = router
            .oneshot(json_request(
                "POST",
                "/auth/login",
                json!({"email":"lock@example.com","password":"wrong-password"}),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(blocked.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    /// Yearly Checkout uses the configured yearly Price ID path and still returns a URL.
    #[tokio::test]
    async fn checkout_yearly_authenticated_returns_url() {
        let Harness { state, mailer } = harness();
        let router = app(state);
        let signup = signup_verified(&router, &mailer, "year@example.com", "Year").await;
        let cookie = session_cookie(&signup);
        let response = router
            .oneshot(json_request(
                "POST",
                "/api/billing/checkout",
                json!({"kind":"subscription","plan":"starter","interval":"yearly"}),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(body["url"].as_str().unwrap().contains("checkout.stripe.com"));
    }

    /// CLI device login mints a Code key after the signed-in user approves in the browser.
    #[tokio::test]
    async fn cli_device_login_approves_and_returns_key() {
        let Harness { state, mailer } = harness();
        let router = app(state);
        let start = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/cli/device")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(start.status(), StatusCode::OK);
        let bytes = start.into_body().collect().await.unwrap().to_bytes();
        let started: Value = serde_json::from_slice(&bytes).unwrap();
        let device_code = started["device_code"].as_str().unwrap().to_string();
        let user_code = started["user_code"].as_str().unwrap().to_string();
        assert!(started["verification_uri"]
            .as_str()
            .unwrap()
            .contains("/cli/login?code="));

        let pending = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/cli/device/poll")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(json!({ "device_code": device_code }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(pending.status(), StatusCode::OK);
        let pending_body: Value = serde_json::from_slice(
            &pending.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap();
        assert_eq!(pending_body["status"], "pending");

        let signup = signup_verified(&router, &mailer, "cli@example.com", "Cli").await;
        let cookie = session_cookie(&signup);
        let approve = router
            .clone()
            .oneshot(json_request(
                "POST",
                &format!("/api/cli/device/{user_code}/approve"),
                json!({ "user_code": user_code }),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert_eq!(approve.status(), StatusCode::OK);

        let done = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/cli/device/poll")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(json!({ "device_code": device_code }).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(done.status(), StatusCode::OK);
        let body: Value = serde_json::from_slice(&done.into_body().collect().await.unwrap().to_bytes())
            .unwrap();
        assert_eq!(body["status"], "approved");
        assert!(body["api_key"].as_str().unwrap().starts_with("sk-fae_"));
        assert_ne!(body["api_key"].as_str().unwrap(), "approved");
    }

    /// Approving from the URL code without typing the same code is rejected.
    #[tokio::test]
    async fn cli_device_approve_requires_typed_user_code() {
        let Harness { state, mailer } = harness();
        let router = app(state);
        let start = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/cli/device")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        let started: Value = serde_json::from_slice(
            &start.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap();
        let user_code = started["user_code"].as_str().unwrap().to_string();
        let signup = signup_verified(&router, &mailer, "cli-mismatch@example.com", "Cli").await;
        let cookie = session_cookie(&signup);
        let mismatched = router
            .clone()
            .oneshot(json_request(
                "POST",
                &format!("/api/cli/device/{user_code}/approve"),
                json!({ "user_code": "AAAA-AAAA" }),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert_eq!(mismatched.status(), StatusCode::BAD_REQUEST);
        let one_click = router
            .oneshot(json_request(
                "POST",
                &format!("/api/cli/device/{user_code}/approve"),
                json!({}),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert!(
            one_click.status() == StatusCode::UNPROCESSABLE_ENTITY
                || one_click.status() == StatusCode::BAD_REQUEST
        );
    }

    /// Spoofed X-Forwarded-For cannot split the device-start rate limit.
    #[tokio::test]
    async fn cli_device_start_ignores_spoofed_forwarded_for() {
        let router = app(test_state());
        let mut last = StatusCode::OK;
        for index in 0..11 {
            let response = router
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/cli/device")
                        .header(header::CONTENT_TYPE, "application/json")
                        .header("x-forwarded-for", format!("203.0.113.{index}"))
                        .body(Body::from("{}"))
                        .unwrap(),
                )
                .await
                .unwrap();
            last = response.status();
        }
        assert_eq!(last, StatusCode::TOO_MANY_REQUESTS);
    }

    /// Chat threads need a session, are scoped per user, and fork/delete/purge round-trip.
    #[tokio::test]
    async fn chat_threads_crud_is_session_scoped() {
        let Harness { state, mailer } = harness();
        let router = app(state);
        let denied = router
            .clone()
            .oneshot(Request::builder().uri("/api/chat/threads").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(denied.status(), StatusCode::UNAUTHORIZED);

        let signup = signup_verified(&router, &mailer, "chat@example.com", "Chat").await;
        let cookie = session_cookie(&signup);
        let created = router
            .clone()
            .oneshot(json_request("POST", "/api/chat/threads", json!({"model":"echo"}), Some(&cookie)))
            .await
            .unwrap();
        assert_eq!(created.status(), StatusCode::OK);
        let thread: Value = serde_json::from_slice(&created.into_body().collect().await.unwrap().to_bytes()).unwrap();
        let id = thread["id"].as_str().unwrap().to_string();
        assert!(id.starts_with("chat_"));
        assert_eq!(thread["title"], "New chat");

        let forked = router
            .clone()
            .oneshot(json_request("POST", &format!("/api/chat/threads/{id}/fork"), json!({}), Some(&cookie)))
            .await
            .unwrap();
        assert_eq!(forked.status(), StatusCode::OK);
        let fork: Value = serde_json::from_slice(&forked.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(fork["title"], "Fork: New chat");

        let temp = router
            .clone()
            .oneshot(json_request("PATCH", &format!("/api/chat/threads/{id}"), json!({"temporary": true}), Some(&cookie)))
            .await
            .unwrap();
        assert_eq!(temp.status(), StatusCode::OK);

        let listed = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/chat/threads")
                    .header(header::COOKIE, &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&listed.into_body().collect().await.unwrap().to_bytes()).unwrap();
        // The temporary original is hidden; only the fork is listed.
        assert_eq!(body["threads"].as_array().unwrap().len(), 1);

        let purged = router
            .clone()
            .oneshot(json_request("POST", "/api/chat/purge-temporary", json!({}), Some(&cookie)))
            .await
            .unwrap();
        let purged_body: Value = serde_json::from_slice(&purged.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(purged_body["removed"], 1);

        let other = signup_verified(&router, &mailer, "other@example.com", "Other").await;
        let other_cookie = session_cookie(&other);
        let fork_id = fork["id"].as_str().unwrap();
        let cross = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/chat/threads/{fork_id}"))
                    .header(header::COOKIE, &other_cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(cross.status(), StatusCode::NOT_FOUND);

        let usage = router
            .oneshot(
                Request::builder()
                    .uri(format!("/api/chat/usage?threadId={fork_id}&model=echo"))
                    .header(header::COOKIE, &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(usage.status(), StatusCode::OK);
        let usage_body: Value = serde_json::from_slice(&usage.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert!(usage_body["limit"].as_u64().unwrap() > 0);
    }

    /// GET /api/usage includes unused grants; POST redeem zeros rolling meters and needs CSRF Origin.
    #[tokio::test]
    async fn usage_reset_redeem_requires_session_and_active_plan() {
        let store = Arc::new(MemoryStore::new());
        let accounts = Arc::new(MemoryAccounts::new());
        let Harness { state, mailer } = harness_with(store.clone(), accounts.clone());
        let router = app(state);
        let signup = signup_verified(&router, &mailer, "reset@example.com", "Reset").await;
        assert_eq!(signup.status(), StatusCode::OK);
        let cookie = session_cookie(&signup);
        let user = accounts
            .get_user_by_email("reset@example.com")
            .await
            .unwrap()
            .unwrap();
        store
            .upsert_subscription(faelith_core::store::OrgSubscription {
                org_id: user.org_id,
                stripe_customer_id: None,
                stripe_subscription_id: None,
                plan: Some(faelith_core::PlanTier::Starter),
                status: "active".to_string(),
                usage_based: false,
            })
            .await
            .unwrap();
        store
            .grant_usage_reset_to_org(user.org_id, "launch", "admin")
            .await
            .unwrap();

        let listed = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/usage")
                    .header(header::COOKIE, &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(listed.status(), StatusCode::OK);
        let listed_body: Value = serde_json::from_slice(
            &listed.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap();
        assert_eq!(listed_body["available_resets"], 1);
        assert_eq!(listed_body["usage_reset_grants"][0]["reason"], "launch");

        let csrf_fail = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/usage/reset/redeem")
                    .header(header::CONTENT_TYPE, "application/json")
                    .header(header::ORIGIN, "https://evil.example")
                    .header(header::COOKIE, &cookie)
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(csrf_fail.status(), StatusCode::FORBIDDEN);

        let redeemed = router
            .clone()
            .oneshot(json_request(
                "POST",
                "/api/usage/reset/redeem",
                json!({}),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert_eq!(redeemed.status(), StatusCode::OK);
        let body: Value = serde_json::from_slice(
            &redeemed.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap();
        assert_eq!(body["available_resets"], 0);

        let again = router
            .oneshot(json_request(
                "POST",
                "/api/usage/reset/redeem",
                json!({}),
                Some(&cookie),
            ))
            .await
            .unwrap();
        assert_eq!(again.status(), StatusCode::BAD_REQUEST);
    }
}
