/**
 * @fileoverview Shared in-memory harness for Axum route tests.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Builds AppState on memory stores, a fake Stripe client, and a recording mailer
 * - `signup_verified` runs the full email-code signup so tests get a real session
 * - Compiled only under cfg(test)
 */

use crate::accounts::{AccountStore, MemoryAccounts};
use crate::chat_store::MemoryWebChat;
use crate::config::WebConfig;
use crate::limit::MemoryLimiter;
use crate::mailer::MemoryMailer;
use crate::security_store::MemorySecurity;
use crate::stripe::FakeStripe;
use crate::AppState;
use axum::body::Body;
use axum::http::{header, Request, Response, StatusCode};
use axum::Router;
use faelith_core::store::{MemoryStore, PlatformStore};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

/// Handles a test needs to reach behind the router.
pub struct Harness {
    pub state: AppState,
    pub mailer: Arc<MemoryMailer>,
}

/// Builds state from explicit store and account backends plus a recording mailer.
pub fn harness_with(store: Arc<dyn PlatformStore>, accounts: Arc<dyn AccountStore>) -> Harness {
    let mailer = Arc::new(MemoryMailer::new());
    let state = AppState::new(
        WebConfig::test_config(),
        store,
        accounts,
        Arc::new(MemoryLimiter::new()),
        Arc::new(FakeStripe {
            checkout_url: "https://checkout.stripe.com/c/pay/cs_test_fake".to_string(),
            portal_url: "https://billing.stripe.com/p/session/fake".to_string(),
        }),
        reqwest::Client::new(),
        Arc::new(MemoryWebChat::new()),
        Arc::new(MemorySecurity::new()),
        mailer.clone(),
    );
    Harness { state, mailer }
}

/// Builds a fully in-memory harness.
pub fn harness() -> Harness {
    harness_with(Arc::new(MemoryStore::new()), Arc::new(MemoryAccounts::new()))
}

/// Sends JSON with the SPA Origin so CSRF Origin checks pass.
pub fn json_request(method: &str, uri: &str, body: Value, cookie: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ORIGIN, "http://127.0.0.1:5173")
        .header(header::HOST, "127.0.0.1:5173");
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    builder.body(Body::from(body.to_string())).unwrap()
}

/// First Set-Cookie pair (`name=value`) on a response.
pub fn session_cookie(response: &Response<Body>) -> String {
    cookie_named(response, "faelith-sid").unwrap_or_default()
}

/// The `name=value` pair of the Set-Cookie header whose name matches, if any.
pub fn cookie_named(response: &Response<Body>, name: &str) -> Option<String> {
    response
        .headers()
        .get_all(header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .filter_map(|raw| raw.split(';').next())
        .find(|pair| pair.starts_with(&format!("{name}=")))
        .map(str::to_string)
}

/// Reads a JSON response body.
pub async fn body_json(response: Response<Body>) -> Value {
    use http_body_util::BodyExt;
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

/// Runs signup + email verification and returns the verify response (with session cookie).
pub async fn signup_verified(router: &Router, mailer: &MemoryMailer, email: &str, name: &str) -> Response<Body> {
    let started = router
        .clone()
        .oneshot(json_request(
            "POST",
            "/auth/signup",
            json!({"email": email, "password": "correcthorse", "name": name}),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(started.status(), StatusCode::ACCEPTED, "signup should await verification");
    let code = mailer.last_code_for(email).expect("verification email sent");
    router
        .clone()
        .oneshot(json_request(
            "POST",
            "/auth/signup/verify",
            json!({"email": email, "code": code}),
            None,
        ))
        .await
        .unwrap()
}
