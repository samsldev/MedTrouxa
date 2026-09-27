/**
 * @fileoverview Regression tests for the pre-launch security hardening (reauth, reset, OAuth, deletion).
 * @author Samuel S. L.
 * @version 1.2.1
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
 * - Account deletion demands the password, revokes keys, and queues capture erasure
 * - With 2FA on, creating API keys requires a second factor and refuses emailed codes
 * - Password reset links are single use and revoke existing sessions
 * - The last sign-in method cannot be unlinked
 */

use crate::app;
use crate::mfa::unix_now;
use crate::test_support::{body_json, harness, json_request, session_cookie, signup_verified, Harness};
use axum::body::Body;
use axum::http::StatusCode;
use axum::Router;
use serde_json::{json, Value};
use totp_rs::Totp;
use tower::ServiceExt;

/// Sends a JSON request and returns the response.
async fn send(router: &Router, method: &str, uri: &str, body: Value, cookie: Option<&str>) -> axum::http::Response<Body> {
    router.clone().oneshot(json_request(method, uri, body, cookie)).await.unwrap()
}

/// Enables TOTP for a signed-in user and returns the authenticator.
async fn enable_totp(router: &Router, cookie: &str) -> Totp {
    let setup = body_json(send(router, "POST", "/api/security/totp/setup", json!({}), Some(cookie)).await).await;
    let totp = Totp::from_url(setup["otpauth_url"].as_str().unwrap()).unwrap();
    let code = totp.generate(unix_now()).to_string();
    let enabled = send(router, "POST", "/api/security/totp/enable", json!({ "code": code }), Some(cookie)).await;
    assert_eq!(enabled.status(), StatusCode::OK);
    totp
}

/// Waits for background email tasks (notices, reset links) to reach the outbox.
async fn settle() {
    for _ in 0..20 {
        tokio::task::yield_now().await;
    }
}

/// Deleting the account needs the password and tears down keys and captures.
#[tokio::test]
async fn delete_account_requires_password_and_revokes_keys() {
    let Harness { state, mailer } = harness();
    let store = state.store.clone();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "del@example.com", "Del").await);
    let key = send(&router, "POST", "/api/keys", json!({ "purpose": "code" }), Some(&cookie)).await;
    assert_eq!(key.status(), StatusCode::OK);

    let missing = send(&router, "DELETE", "/api/account", json!({}), Some(&cookie)).await;
    assert_eq!(missing.status(), StatusCode::FORBIDDEN);
    assert_eq!(body_json(missing).await["reauth"]["methods"], json!(["password"]));

    let wrong = send(&router, "DELETE", "/api/account", json!({ "reauth": { "method": "password", "code": "not-the-password" } }), Some(&cookie)).await;
    assert_eq!(wrong.status(), StatusCode::FORBIDDEN);

    let ok = send(&router, "DELETE", "/api/account", json!({ "reauth": { "method": "password", "code": "correcthorse" } }), Some(&cookie)).await;
    assert_eq!(ok.status(), StatusCode::NO_CONTENT);
    let pending = store.pending_capture_erasures(10).await.unwrap();
    assert_eq!(pending.len(), 1, "captures queued for erasure");
    let keys = store.list_keys_for_org(pending[0]).await.unwrap();
    assert!(keys.iter().all(|key| key.revoked), "org keys revoked");
}

/// With an authenticator app on, key creation needs TOTP; email codes are refused.
#[tokio::test]
async fn create_key_with_totp_requires_second_factor() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "key@example.com", "Key").await);
    let totp = enable_totp(&router, &cookie).await;

    let missing = send(&router, "POST", "/api/keys", json!({ "purpose": "code" }), Some(&cookie)).await;
    assert_eq!(missing.status(), StatusCode::FORBIDDEN);
    let methods = body_json(missing).await["reauth"]["methods"].clone();
    assert_eq!(methods, json!(["totp", "backup"]), "email is not offered while TOTP is on");

    let email = send(&router, "POST", "/api/keys", json!({ "purpose": "code", "reauth": { "method": "email", "code": "123456" } }), Some(&cookie)).await;
    assert_eq!(email.status(), StatusCode::FORBIDDEN);

    // The enrollment code consumed the current step; use the next one.
    let code = totp.generate(unix_now() + 30).to_string();
    let ok = send(&router, "POST", "/api/keys", json!({ "purpose": "code", "reauth": { "method": "totp", "code": code } }), Some(&cookie)).await;
    assert_eq!(ok.status(), StatusCode::OK);
}

/// A reset link works once, sets the password, and signs out every session.
#[tokio::test]
async fn password_reset_is_single_use_and_revokes_sessions() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "reset@example.com", "Reset").await);

    let unknown = send(&router, "POST", "/auth/password/forgot", json!({ "email": "nobody@example.com" }), None).await;
    assert_eq!(unknown.status(), StatusCode::ACCEPTED, "no enumeration");
    let known = send(&router, "POST", "/auth/password/forgot", json!({ "email": "reset@example.com" }), None).await;
    assert_eq!(known.status(), StatusCode::ACCEPTED);
    settle().await;
    let text = mailer
        .sent()
        .into_iter()
        .rev()
        .find(|email| email.to == "reset@example.com" && email.text.contains("#token="))
        .expect("reset email")
        .text;
    let token: String = text
        .split("#token=")
        .nth(1)
        .unwrap()
        .chars()
        .take_while(|c| c.is_ascii_hexdigit())
        .collect();

    let reset = send(&router, "POST", "/auth/password/reset", json!({ "token": token, "password": "brand-new-password" }), None).await;
    assert_eq!(reset.status(), StatusCode::NO_CONTENT);
    let again = send(&router, "POST", "/auth/password/reset", json!({ "token": token, "password": "another-password1" }), None).await;
    assert_eq!(again.status(), StatusCode::BAD_REQUEST, "single use");

    let me = send(&router, "GET", "/auth/me", json!(null), Some(&cookie)).await;
    assert_eq!(me.status(), StatusCode::UNAUTHORIZED, "old session revoked");
    let login = send(&router, "POST", "/auth/login", json!({ "email": "reset@example.com", "password": "brand-new-password" }), None).await;
    assert_eq!(login.status(), StatusCode::OK);
}

/// A password account can still unlink a provider it does not have; an OAuth-only
/// account cannot drop its last method (covered by the conflict branch).
#[tokio::test]
async fn unlink_without_link_is_harmless_for_password_accounts() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "unlink@example.com", "U").await);
    let response = send(&router, "POST", "/api/settings/oauth/unlink", json!({ "provider": "github" }), Some(&cookie)).await;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

/// An OAuth-only account cannot unlink its only sign-in method.
#[tokio::test]
async fn oauth_only_account_keeps_last_login_method() {
    use crate::accounts::{OAuthProvider, UserRecord};
    let Harness { state, .. } = harness();
    let org_id = state.store.create_org("user-oauth@example.com").await.unwrap();
    let user = UserRecord {
        id: uuid::Uuid::new_v4(),
        org_id,
        email: "oauth@example.com".to_string(),
        password_hash: None,
        name: "OAuth".to_string(),
    };
    state.accounts.insert_user(user.clone()).await.unwrap();
    state.accounts.link_oauth(user.id, OAuthProvider::GitHub, "gh-1").await.unwrap();
    let token = crate::auth::issue_session(state.accounts.as_ref(), user.id, None, None).await.unwrap();
    let signed = crate::auth::sign_session_token(&state.config.cookie_secret, &token).unwrap();
    let cookie = format!("{}={signed}", state.config.session_cookie_name());
    let router = app(state);
    let response = send(&router, "POST", "/api/settings/oauth/unlink", json!({ "provider": "github" }), Some(&cookie)).await;
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

/// GitHub emails count only when primary and verified.
#[test]
fn github_email_must_be_primary_and_verified() {
    use crate::oauth::verified_primary_github_email;
    let unverified = json!([{ "email": "victim@example.com", "primary": true, "verified": false }]);
    assert_eq!(verified_primary_github_email(&unverified), None);
    let verified = json!([
        { "email": "other@example.com", "primary": false, "verified": true },
        { "email": "me@example.com", "primary": true, "verified": true }
    ]);
    assert_eq!(verified_primary_github_email(&verified).as_deref(), Some("me@example.com"));
}

/// Custom top-ups enforce the $5 minimum server-side.
#[tokio::test]
async fn custom_credit_checkout_enforces_minimum() {
    let Harness { state, mailer } = harness();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "topup@example.com", "Top").await);
    let low = send(&router, "POST", "/api/billing/checkout", json!({ "kind": "credits_custom", "amount_cents": 499 }), Some(&cookie)).await;
    assert_eq!(low.status(), StatusCode::BAD_REQUEST);
    let ok = send(&router, "POST", "/api/billing/checkout", json!({ "kind": "credits_custom", "amount_cents": 500 }), Some(&cookie)).await;
    assert_eq!(ok.status(), StatusCode::OK);
}

/// A paid custom top-up grants exactly what Stripe collected.
#[tokio::test]
async fn custom_credit_webhook_grants_amount_total() {
    use crate::stripe::fulfill_stripe_event;
    let Harness { state, .. } = harness();
    let org = state.store.create_org("webhook@example.com").await.unwrap();
    let event = json!({
        "id": "evt_custom_1",
        "type": "checkout.session.completed",
        "data": { "object": {
            "payment_status": "paid",
            "currency": "usd",
            "amount_total": 1234,
            "metadata": { "org_id": org.to_string(), "kind": "credits_custom", "amount_cents": "999999" }
        }}
    });
    fulfill_stripe_event(state.store.as_ref(), state.accounts.as_ref(), state.stripe.as_ref(), &event).await.unwrap();
    assert_eq!(state.store.credit_balance(org).await.unwrap(), 12_340_000);
}

/// Invoices come only from the org's own Stripe customer; none without one.
#[tokio::test]
async fn invoices_use_the_org_customer_only() {
    let Harness { state, mailer } = harness();
    let store = state.store.clone();
    let accounts = state.accounts.clone();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "inv@example.com", "Inv").await);
    let empty = body_json(send(&router, "GET", "/api/billing/invoices", json!(null), Some(&cookie)).await).await;
    assert_eq!(empty["invoices"], json!([]));

    let user = accounts.get_user_by_email("inv@example.com").await.unwrap().unwrap().org_id;
    store
        .upsert_subscription(faelith_core::store::OrgSubscription {
            org_id: user,
            stripe_customer_id: Some("cus_1".to_string()),
            stripe_subscription_id: None,
            plan: None,
            status: "none".to_string(),
            usage_based: false,
        })
        .await
        .unwrap();
    let listed = body_json(send(&router, "GET", "/api/billing/invoices", json!(null), Some(&cookie)).await).await;
    assert_eq!(listed["invoices"][0]["number"], "FAE-0001");
}

/// Seeds an active subscription (with Stripe ids) and an open refund window.
async fn subscribed_with_window(state: &crate::AppState, email: &str) -> uuid::Uuid {
    let org = state.accounts.get_user_by_email(email).await.unwrap().unwrap().org_id;
    state
        .store
        .upsert_subscription(faelith_core::store::OrgSubscription {
            org_id: org,
            stripe_customer_id: Some("cus_r".into()),
            stripe_subscription_id: Some("sub_r".into()),
            plan: Some(faelith_core::PlanTier::Starter),
            status: "active".into(),
            usage_based: false,
        })
        .await
        .unwrap();
    state
        .store
        .open_refund_window(org, chrono::Utc::now() + chrono::Duration::days(7), "BR")
        .await
        .unwrap();
    org
}

/// Inside the window: credits are blocked, the refund works once, revokes keys and
/// closes the window; the same card is then blocked from a second automatic refund.
#[tokio::test]
async fn refund_inside_window_is_full_once_and_blocks_credits() {
    let Harness { state, mailer } = harness();
    let shared = state.clone();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "ref@example.com", "Ref").await);
    let org = subscribed_with_window(&shared, "ref@example.com").await;
    send(&router, "POST", "/api/keys", json!({ "purpose": "code" }), Some(&cookie)).await;

    let billing = body_json(send(&router, "GET", "/api/billing", json!(null), Some(&cookie)).await).await;
    assert_eq!(billing["refund"]["available"], true);
    let credits = send(&router, "POST", "/api/billing/checkout", json!({ "kind": "credits", "pack": "10" }), Some(&cookie)).await;
    assert_eq!(credits.status(), StatusCode::CONFLICT);

    let reauth = json!({ "reauth": { "method": "password", "code": "correcthorse" } });
    let refunded = send(&router, "POST", "/api/billing/refund", reauth.clone(), Some(&cookie)).await;
    assert_eq!(refunded.status(), StatusCode::OK);
    assert!(shared.store.list_keys_for_org(org).await.unwrap().iter().all(|key| key.revoked));
    let again = send(&router, "POST", "/api/billing/refund", reauth, Some(&cookie)).await;
    assert_eq!(again.status(), StatusCode::CONFLICT, "window closed after refund");
    assert!(shared.store.refund_blocked(Some("fp_test"), "someone@else.com").await.unwrap());
}

/// Outside the window the refund is refused and cancel-at-period-end is the path.
#[tokio::test]
async fn cancel_without_window_is_period_end_only() {
    let Harness { state, mailer } = harness();
    let shared = state.clone();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "cancel@example.com", "C").await);
    let org = subscribed_with_window(&shared, "cancel@example.com").await;
    shared.store.mark_refunded(org).await.unwrap();
    let refund = send(&router, "POST", "/api/billing/refund", json!({}), Some(&cookie)).await;
    assert_eq!(refund.status(), StatusCode::CONFLICT);
    let cancel = send(&router, "POST", "/api/billing/cancel", json!({}), Some(&cookie)).await;
    assert_eq!(cancel.status(), StatusCode::OK);
}

/// Retention offer: hidden inside the refund window, offered afterwards to monthly plans,
/// accepted once, then hidden for the cooldown; yearly subscriptions never see it.
#[tokio::test]
async fn retention_offer_after_window_once_per_cooldown() {
    let Harness { state, mailer } = harness();
    let shared = state.clone();
    let router = app(state);
    let cookie = session_cookie(&signup_verified(&router, &mailer, "stay@example.com", "S").await);
    let org = subscribed_with_window(&shared, "stay@example.com").await;

    let inside = body_json(send(&router, "GET", "/api/billing/retention", json!({}), Some(&cookie)).await).await;
    assert_eq!(inside["eligible"], json!(false), "no offer inside the refund window");

    shared.store.mark_refunded(org).await.unwrap();
    let offered = body_json(send(&router, "GET", "/api/billing/retention", json!({}), Some(&cookie)).await).await;
    assert_eq!(offered["eligible"], json!(true));

    let accept = send(&router, "POST", "/api/billing/retention/accept", json!({}), Some(&cookie)).await;
    assert_eq!(accept.status(), StatusCode::OK);
    let offer = shared.store.latest_retention_offer(org).await.unwrap().unwrap();
    assert!(offer.starts_at > chrono::Utc::now(), "the discount applies from the next renewal");
    assert!(!faelith_core::intro_active(shared.store.as_ref(), org).await.unwrap());

    let again = send(&router, "POST", "/api/billing/retention/accept", json!({}), Some(&cookie)).await;
    assert_eq!(again.status(), StatusCode::CONFLICT, "cooldown blocks a second acceptance");

    let mut sub = shared.store.get_subscription(org).await.unwrap().unwrap();
    sub.stripe_subscription_id = Some("sub_year".into());
    shared.store.upsert_subscription(sub).await.unwrap();
    let past = faelith_core::store::RetentionOffer { accepted_at: chrono::Utc::now() - chrono::Duration::days(90), ..offer };
    shared.store.record_retention_offer(&past).await.unwrap();
    let yearly = body_json(send(&router, "GET", "/api/billing/retention", json!({}), Some(&cookie)).await).await;
    assert_eq!(yearly["eligible"], json!(false), "yearly plans are not offered");
}

/// Admin console: hidden (404) from non-admins, needs TOTP, every mutation needs a fresh
/// proof and lands in the audit log; key plaintext is returned once and never audited.
#[tokio::test]
async fn admin_console_requires_allowlist_totp_and_audits() {
    let Harness { state, mailer } = harness();
    let shared = state.clone();
    let router = app(state);
    let user = session_cookie(&signup_verified(&router, &mailer, "user@example.com", "U").await);
    let hidden = send(&router, "GET", "/api/admin/me", json!({}), Some(&user)).await;
    assert_eq!(hidden.status(), StatusCode::NOT_FOUND);

    let admin = session_cookie(&signup_verified(&router, &mailer, "admin@example.com", "A").await);
    let no_totp = send(&router, "GET", "/api/admin/me", json!({}), Some(&admin)).await;
    assert_eq!(no_totp.status(), StatusCode::FORBIDDEN);
    let totp = enable_totp(&router, &admin).await;
    let me = send(&router, "GET", "/api/admin/me", json!({}), Some(&admin)).await;
    assert_eq!(me.status(), StatusCode::OK);

    let found = body_json(send(&router, "GET", "/api/admin/orgs/search?q=user@example.com", json!({}), Some(&admin)).await).await;
    let org = found["results"][0]["org_id"].as_str().unwrap().to_string();

    let unproven = send(&router, "POST", &format!("/api/admin/orgs/{org}/keys"), json!({ "purpose": "api" }), Some(&admin)).await;
    assert_eq!(unproven.status(), StatusCode::FORBIDDEN, "mutations always need a fresh proof");
    // The enrollment code consumed the current step; use the next one.
    let code = totp.generate(unix_now() + 30).to_string();
    let created = send(
        &router,
        "POST",
        &format!("/api/admin/orgs/{org}/keys"),
        json!({ "purpose": "api", "reauth": { "method": "totp", "code": code } }),
        Some(&admin),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let created = body_json(created).await;
    assert!(created["plaintext"].as_str().unwrap().starts_with("sk-"));

    let detail = body_json(send(&router, "GET", &format!("/api/admin/orgs/{org}"), json!({}), Some(&admin)).await).await;
    assert_eq!(detail["account"]["email"], json!("user@example.com"));
    assert_eq!(detail["keys"].as_array().unwrap().len(), 1);

    let log = shared.audit.list(10).await.unwrap();
    assert_eq!(log[0].action, "keys.create");
    assert!(!log[0].detail.to_string().contains(created["plaintext"].as_str().unwrap()));
}

/// Tracker beacons: anonymous ids are dropped, bots are ignored, and the admin overview counts views.
#[tokio::test]
async fn tracker_beacons_feed_admin_overview() {
    let Harness { state, mailer } = harness();
    let shared = state.clone();
    let router = app(state);
    let beacon = |agent: &str, consent: bool| {
        axum::http::Request::builder()
            .method("POST")
            .uri("/api/t")
            .header(axum::http::header::USER_AGENT, agent.to_string())
            .header(axum::http::header::CONTENT_TYPE, "text/plain")
            .body(Body::from(json!({
                "pv": uuid::Uuid::new_v4(), "vid": uuid::Uuid::new_v4(), "sid": uuid::Uuid::new_v4(),
                "consent": consent, "path": "/lp/code/a/br?utm_source=meta", "device": "mobile",
                "utm": { "source": "meta", "campaign": "launch" }, "active_ms": 20_000, "max_scroll": 80,
                "attention": [1000, 2000], "clicks": [{ "x": 0.5, "y": 0.2, "l": "button: Assinar" }],
            }).to_string()))
            .unwrap()
    };
    let human = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
    for request in [beacon(human, false), beacon(human, true), beacon("Googlebot/2.1", true)] {
        let response = router.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
    let rows = shared
        .analytics
        .pageviews_between(chrono::Utc::now() - chrono::Duration::hours(1), chrono::Utc::now() + chrono::Duration::hours(1), 10)
        .await
        .unwrap();
    assert_eq!(rows.len(), 2, "the bot beacon is dropped");
    assert_eq!(rows.iter().filter(|row| row.visitor_id.is_some()).count(), 1, "only the consented view keeps its visitor id");

    let admin = session_cookie(&signup_verified(&router, &mailer, "admin@example.com", "A").await);
    enable_totp(&router, &admin).await;
    let overview = body_json(send(&router, "GET", "/api/admin/analytics/overview", json!({}), Some(&admin)).await).await;
    assert_eq!(overview["totals"]["views"], json!(2));
    assert_eq!(overview["pages"][0]["name"], json!("/lp/code/a/br"));
    assert_eq!(overview["utm_sources"][0]["name"], json!("meta"));
    let page = body_json(send(&router, "GET", "/api/admin/analytics/page?path=/lp/code/a/br", json!({}), Some(&admin)).await).await;
    assert_eq!(page["clicks"].as_array().unwrap().len(), 2);
    assert_eq!(page["targets"][0]["label"], json!("button: Assinar"));

    let subs = body_json(send(&router, "GET", "/api/admin/subscriptions", json!({}), Some(&admin)).await).await;
    assert_eq!(subs["live"], json!(2));
    assert_eq!(subs["checkout"]["by_plan"][0]["name"], json!("starter / monthly"));
}
