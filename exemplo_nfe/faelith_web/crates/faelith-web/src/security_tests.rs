/**
 * @fileoverview End-to-end route tests for verified signup and two-factor authentication.
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
 * - Signup: no session before the code, uniform response for existing emails, burn after 5 misses
 * - TOTP: QR enrollment, 12 backup codes, login challenge, replay rejection
 * - Email factor: step-up enrollment, emailed sign-in code, proof required to disable
 */

use crate::app;
use crate::mfa::unix_now;
use crate::test_support::{
    body_json, cookie_named, harness, json_request, session_cookie, signup_verified, Harness,
};
use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use serde_json::{json, Value};
use totp_rs::Totp;
use tower::ServiceExt;

/// POSTs JSON and returns the response.
async fn post(router: &Router, uri: &str, body: Value, cookie: Option<&str>) -> axum::http::Response<Body> {
    router
        .clone()
        .oneshot(json_request("POST", uri, body, cookie))
        .await
        .unwrap()
}

/// GETs a path with an optional cookie.
async fn get(router: &Router, uri: &str, cookie: Option<&str>) -> axum::http::Response<Body> {
    let mut builder = Request::builder().uri(uri);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    router
        .clone()
        .oneshot(builder.body(Body::empty()).unwrap())
        .await
        .unwrap()
}

/// Signs up a verified user and returns their session cookie.
async fn signed_in(router: &Router, harness_mailer: &crate::mailer::MemoryMailer, email: &str) -> String {
    let response = signup_verified(router, harness_mailer, email, "Tester").await;
    assert_eq!(response.status(), StatusCode::OK);
    session_cookie(&response)
}

/// Enrolls TOTP for a signed-in user; returns the authenticator and backup codes.
async fn enroll_totp(router: &Router, cookie: &str) -> (Totp, Vec<String>) {
    let setup = post(router, "/api/security/totp/setup", json!({}), Some(cookie)).await;
    assert_eq!(setup.status(), StatusCode::OK);
    let setup = body_json(setup).await;
    assert!(setup["qr"].as_str().unwrap().starts_with("data:image/png;base64,"));
    let totp = Totp::from_url(setup["otpauth_url"].as_str().unwrap()).unwrap();
    let code = totp.generate(unix_now()).to_string();
    let enabled = post(router, "/api/security/totp/enable", json!({ "code": code }), Some(cookie)).await;
    assert_eq!(enabled.status(), StatusCode::OK);
    let enabled = body_json(enabled).await;
    assert_eq!(enabled["totp_enabled"], true);
    let codes: Vec<String> = enabled["backup_codes"]
        .as_array()
        .expect("first factor issues backup codes")
        .iter()
        .map(|code| code.as_str().unwrap().to_string())
        .collect();
    (totp, codes)
}

/// Password login that must stop at the 2FA challenge; returns the challenge cookie.
async fn login_challenge(router: &Router, email: &str) -> String {
    let login = post(
        router,
        "/auth/login",
        json!({"email": email, "password": "correcthorse"}),
        None,
    )
    .await;
    assert_eq!(login.status(), StatusCode::OK);
    assert!(cookie_named(&login, "faelith-sid").is_none(), "no session before 2FA");
    let challenge = cookie_named(&login, "faelith-mfa").expect("challenge cookie");
    let body = body_json(login).await;
    assert_eq!(body["mfa_required"], true);
    challenge
}

/// Signup never creates a session before the emailed code is confirmed.
#[tokio::test]
async fn signup_requires_email_code() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let started = post(
        &router,
        "/auth/signup",
        json!({"email":"new@example.com","password":"correcthorse","name":"New"}),
        None,
    )
    .await;
    assert_eq!(started.status(), StatusCode::ACCEPTED);
    assert!(cookie_named(&started, "faelith-sid").is_none());

    let login = post(&router, "/auth/login", json!({"email":"new@example.com","password":"correcthorse"}), None).await;
    assert_eq!(login.status(), StatusCode::UNAUTHORIZED, "pending signup cannot log in");

    let code = mailer.last_code_for("new@example.com").unwrap();
    let wrong = if code == "000000" { "111111" } else { "000000" };
    let bad = post(&router, "/auth/signup/verify", json!({"email":"new@example.com","code": wrong}), None).await;
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);

    let ok = post(&router, "/auth/signup/verify", json!({"email":"new@example.com","code": code}), None).await;
    assert_eq!(ok.status(), StatusCode::OK);
    assert!(session_cookie(&ok).starts_with("faelith-sid="));

    let reused = post(&router, "/auth/signup/verify", json!({"email":"new@example.com","code": code}), None).await;
    assert_eq!(reused.status(), StatusCode::BAD_REQUEST, "code is single use");
}

/// Signing up with a registered email looks identical but sends no code.
#[tokio::test]
async fn signup_existing_email_is_indistinguishable() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    signed_in(&router, &mailer, "taken@example.com").await;
    let again = post(
        &router,
        "/auth/signup",
        json!({"email":"taken@example.com","password":"anotherpassword","name":"X"}),
        None,
    )
    .await;
    assert_eq!(again.status(), StatusCode::ACCEPTED);
    let last = mailer.sent().pop().unwrap();
    assert_eq!(last.subject, "You already have a Faelith account");
    assert!(!last.text.contains("Your code"), "no verification code is sent");
}

/// Five wrong codes burn the pending signup.
#[tokio::test]
async fn signup_code_burns_after_five_misses() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    post(
        &router,
        "/auth/signup",
        json!({"email":"burn@example.com","password":"correcthorse","name":"Burn"}),
        None,
    )
    .await;
    let code = mailer.last_code_for("burn@example.com").unwrap();
    let wrong = if code == "000000" { "111111" } else { "000000" };
    for _ in 0..4 {
        let miss = post(&router, "/auth/signup/verify", json!({"email":"burn@example.com","code": wrong}), None).await;
        assert_eq!(miss.status(), StatusCode::BAD_REQUEST);
    }
    let fifth = post(&router, "/auth/signup/verify", json!({"email":"burn@example.com","code": wrong}), None).await;
    assert_eq!(fifth.status(), StatusCode::TOO_MANY_REQUESTS);
    let late = post(&router, "/auth/signup/verify", json!({"email":"burn@example.com","code": code}), None).await;
    assert_eq!(late.status(), StatusCode::BAD_REQUEST, "correct code no longer works");
}

/// TOTP enrollment, challenge login, replay rejection, and single-use backup codes.
#[tokio::test]
async fn totp_login_and_backup_codes() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let cookie = signed_in(&router, &mailer, "totp@example.com").await;
    let (totp, backup) = enroll_totp(&router, &cookie).await;
    assert_eq!(backup.len(), 12);

    // The code that confirmed enrollment cannot be replayed for login.
    let challenge = login_challenge(&router, "totp@example.com").await;
    let replay = totp.generate(unix_now()).to_string();
    let replayed = post(&router, "/auth/mfa/verify", json!({"method":"totp","code": replay}), Some(&challenge)).await;
    assert_eq!(replayed.status(), StatusCode::UNAUTHORIZED);

    // The next time step (within the skew window) is accepted exactly once.
    let next = totp.generate(unix_now() + 30).to_string();
    let ok = post(&router, "/auth/mfa/verify", json!({"method":"totp","code": next}), Some(&challenge)).await;
    assert_eq!(ok.status(), StatusCode::OK);
    assert!(session_cookie(&ok).starts_with("faelith-sid="));

    // A backup code works once, then is spent.
    let challenge = login_challenge(&router, "totp@example.com").await;
    let used = post(&router, "/auth/mfa/verify", json!({"method":"backup","code": backup[0].to_lowercase()}), Some(&challenge)).await;
    assert_eq!(used.status(), StatusCode::OK);
    let challenge = login_challenge(&router, "totp@example.com").await;
    let spent = post(&router, "/auth/mfa/verify", json!({"method":"backup","code": backup[0]}), Some(&challenge)).await;
    assert_eq!(spent.status(), StatusCode::UNAUTHORIZED);

    let status = body_json(get(&router, "/api/security", Some(&cookie)).await).await;
    assert_eq!(status["backup_codes_remaining"], 11);
}

/// A challenge is destroyed after five wrong codes.
#[tokio::test]
async fn challenge_burns_after_five_misses() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let cookie = signed_in(&router, &mailer, "lock@example.com").await;
    enroll_totp(&router, &cookie).await;
    let challenge = login_challenge(&router, "lock@example.com").await;
    for _ in 0..4 {
        let miss = post(&router, "/auth/mfa/verify", json!({"method":"backup","code":"AAAAA-AAAAA"}), Some(&challenge)).await;
        assert_eq!(miss.status(), StatusCode::UNAUTHORIZED);
    }
    let fifth = post(&router, "/auth/mfa/verify", json!({"method":"backup","code":"AAAAA-AAAAA"}), Some(&challenge)).await;
    assert_eq!(fifth.status(), StatusCode::TOO_MANY_REQUESTS);
    let after = get(&router, "/auth/mfa", Some(&challenge)).await;
    assert_eq!(after.status(), StatusCode::UNAUTHORIZED);
}

/// Email 2FA: step-up enrollment, emailed sign-in code, and proof required to disable.
#[tokio::test]
async fn email_factor_flow() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let email = "mail@example.com";
    let cookie = signed_in(&router, &mailer, email).await;

    let sent = post(&router, "/api/security/stepup/email", json!({}), Some(&cookie)).await;
    assert_eq!(sent.status(), StatusCode::OK);
    let code = mailer.last_code_for(email).unwrap();
    let enabled = post(&router, "/api/security/email/enable", json!({ "code": code }), Some(&cookie)).await;
    assert_eq!(enabled.status(), StatusCode::OK);
    let enabled = body_json(enabled).await;
    assert_eq!(enabled["email_enabled"], true);
    assert_eq!(enabled["backup_codes"].as_array().unwrap().len(), 12);

    let challenge = login_challenge(&router, email).await;
    let status = body_json(get(&router, "/auth/mfa", Some(&challenge)).await).await;
    assert!(status["methods"].as_array().unwrap().contains(&json!("email")));
    let requested = post(&router, "/auth/mfa/email", json!({}), Some(&challenge)).await;
    assert_eq!(requested.status(), StatusCode::OK);
    let login_code = mailer.last_code_for(email).unwrap();
    let ok = post(&router, "/auth/mfa/verify", json!({"method":"email","code": login_code}), Some(&challenge)).await;
    assert_eq!(ok.status(), StatusCode::OK);

    let no_proof = post(&router, "/api/security/email/disable", json!({}), Some(&cookie)).await;
    assert_eq!(no_proof.status(), StatusCode::FORBIDDEN);

    // Prove with a backup code (a fresh step-up email is blocked by the 60 s resend cooldown).
    let backup = enabled["backup_codes"][0].as_str().unwrap();
    let disabled = post(
        &router,
        "/api/security/email/disable",
        json!({"proof": {"method":"backup","code": backup}}),
        Some(&cookie),
    )
    .await;
    assert_eq!(disabled.status(), StatusCode::OK);
    let disabled = body_json(disabled).await;
    assert_eq!(disabled["mfa_enabled"], false);
    assert_eq!(disabled["backup_codes_remaining"], 0, "codes are removed with the last factor");

    let login = post(&router, "/auth/login", json!({"email": email, "password":"correcthorse"}), None).await;
    assert!(session_cookie(&login).starts_with("faelith-sid="), "2FA off logs in directly");
}

/// Security settings require a session.
#[tokio::test]
async fn security_settings_require_session() {
    let Harness { state, .. } = harness();
    let router = app(state);
    let response = get(&router, "/api/security", None).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let setup = post(&router, "/api/security/totp/setup", json!({}), None).await;
    assert_eq!(setup.status(), StatusCode::UNAUTHORIZED);
}
