/**
 * @fileoverview Stripe Checkout, Customer Portal, and signed webhook fulfillment.
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
 * - Copies Checkout metadata onto subscription_data so Portal webhooks can resolve org_id
 * - Verifies Stripe-Signature on the raw body (HMAC-SHA256 of timestamp.payload)
 * - Fulfillment is webhook-only; success_url never grants credits
 * - First subscriptions from countries with a statutory withdrawal right open a 7/14-day
 *   refund window (billing address collected at Checkout); refunds use the latest charge
 * - Paid invoices are listed from Stripe for the org's own customer id only
 * - One-off credit checkouts create a post-payment invoice and a reusable customer
 * - Custom credit top-ups ($5 minimum) use inline price_data and are granted from the
 *   amount Stripe actually collected (amount_total), never from client input
 * - A failed event is forgotten (event id deleted) so Stripe's automatic retry applies it
 * - Credits and plans are granted only when the session is paid; delayed methods are
 *   fulfilled on checkout.session.async_payment_succeeded
 * - Subscription events older than the last applied one (Stripe `created`) are ignored
 * - charge.dispute.created suspends the org, revokes keys, cancels the plan, and removes
 *   the disputed credits; charge.refunded (dashboard refunds) mirrors the refund button
 *   for plan charges and removes the refunded amount for credit charges
 * - Subscription checkouts enable abandoned-cart recovery (Stripe emails a recovery link to
 *   customers who consented to promotions); the intro offer applies a 50 percent coupon once
 * - Intro offer checkouts record a one-month intro period for the org on fulfillment
 * - Checkout collects the billing address and, via "purchasing as a business", the company tax id
 *   (CNPJ, EU VAT...); the webhook stores the buyer profile (business or individual, country)
 * - Admin reports read Stripe's own processing fees from balance transactions
 * - Admin reports list every subscription and recent Checkout Sessions (paginated, capped)
 * - Retention offers read the subscription billing cycle and put a one-time 50 percent
 *   coupon on the next renewal (also clearing a pending cancel_at_period_end)
 * Primary docs: https://docs.stripe.com/webhooks
 * https://docs.stripe.com/payments/checkout/abandoned-carts
 * https://docs.stripe.com/disputes/how-disputes-work
 * https://docs.stripe.com/api/checkout/sessions/create
 */

use crate::accounts::AccountStore;
use crate::config::{CreditPack, WebConfig};
use async_trait::async_trait;
use faelith_core::store::{OrgSubscription, PlatformStore};
use faelith_core::PlanTier;
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};
use subtle::ConstantTimeEq;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// Stripe HTTP surface used by Checkout and Portal.
#[async_trait]
pub trait StripeClient: Send + Sync {
    /// Creates a Checkout Session and returns the hosted URL.
    async fn create_checkout(
        &self,
        price_id: &str,
        mode: &str,
        success_url: &str,
        cancel_url: &str,
        customer: Option<&str>,
        metadata: &[(&str, &str)],
        coupon: Option<&str>,
    ) -> Result<String, String>;
    /// Creates a one-off USD payment Checkout for an arbitrary amount (custom credit top-up).
    async fn create_amount_checkout(
        &self,
        amount_cents: u64,
        product_name: &str,
        success_url: &str,
        cancel_url: &str,
        customer: Option<&str>,
        metadata: &[(&str, &str)],
    ) -> Result<String, String>;
    /// Creates a Customer Portal session URL.
    async fn create_portal(&self, customer_id: &str, return_url: &str) -> Result<String, String>;
    /// Most recent successful, unrefunded charge of the customer (refund target).
    async fn latest_charge(&self, customer_id: &str) -> Result<Option<ChargeInfo>, String>;
    /// Refunds a charge in full.
    async fn refund_charge(&self, charge_id: &str) -> Result<(), String>;
    /// Stops renewal; the plan stays active until the paid period ends.
    async fn cancel_at_period_end(&self, subscription_id: &str) -> Result<(), String>;
    /// Lists the customer's paid invoices, newest first.
    async fn list_paid_invoices(&self, customer_id: &str, limit: u32) -> Result<Vec<InvoiceSummary>, String>;
    /// Cancels a subscription immediately (account deletion). Already-gone is success.
    async fn cancel_subscription(&self, subscription_id: &str) -> Result<(), String>;
    /// Charge with its PaymentIntent metadata (webhook dispute and refund handling).
    async fn charge_details(&self, charge_id: &str) -> Result<ChargeDetails, String>;
    /// Billing cycle of a subscription (interval and current period end).
    async fn subscription_billing(&self, subscription_id: &str) -> Result<SubscriptionBilling, String>;
    /// Applies a coupon to the next invoice and keeps the subscription renewing.
    async fn apply_retention_coupon(&self, subscription_id: &str, coupon: &str) -> Result<(), String>;
    /// Every subscription of the account, any status (admin report).
    async fn list_subscriptions(&self) -> Result<Vec<SubscriptionSummary>, String>;
    /// Checkout Sessions created at or after `created_since` (unix seconds; admin report).
    async fn list_checkout_sessions(&self, created_since: i64) -> Result<Vec<CheckoutSummary>, String>;
    /// Gross amount and Stripe fees of the payments settled in `[from, to)` (unix seconds; admin report).
    async fn payment_fees(&self, from: i64, to: i64) -> Result<FeeSummary, String>;
}

/// Payments and Stripe fees of a period, in the balance currency's minor unit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct FeeSummary {
    pub amount: i64,
    pub fee: i64,
}

impl FeeSummary {
    /// Effective fee as a fraction of the gross amount; None without payments.
    pub fn rate(self) -> Option<f64> {
        (self.amount > 0).then(|| self.fee as f64 / self.amount as f64)
    }
}

/// Pages fetched at most per admin listing (100 rows each).
const MAX_LIST_PAGES: usize = 50;

/// One subscription as needed by the admin subscriptions report.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscriptionSummary {
    /// Stripe subscription id (`sub_…`).
    pub id: String,
    /// Stripe customer id (`cus_…`), joins the buyer profile.
    pub customer: Option<String>,
    /// Stripe status: active, trialing, past_due, unpaid, canceled, incomplete, paused...
    pub status: String,
    pub price_id: Option<String>,
    /// `recurring.interval` of the first item ("month", "year").
    pub interval: Option<String>,
    /// List price of one unit in cents (before discounts).
    pub unit_amount: i64,
    pub quantity: i64,
    pub cancel_at_period_end: bool,
    pub created: i64,
    pub canceled_at: Option<i64>,
}

impl SubscriptionSummary {
    /// Maps a Stripe subscription object (first item carries the price).
    fn from_stripe(sub: &Value) -> Self {
        let item = sub.pointer("/items/data/0");
        let text = |value: Option<&Value>| value.and_then(Value::as_str).map(str::to_string);
        Self {
            id: text(sub.get("id")).unwrap_or_default(),
            customer: text(sub.get("customer")),
            status: text(sub.get("status")).unwrap_or_default(),
            price_id: text(item.and_then(|item| item.pointer("/price/id"))),
            interval: text(item.and_then(|item| item.pointer("/price/recurring/interval"))),
            unit_amount: item.and_then(|item| item.pointer("/price/unit_amount")).and_then(Value::as_i64).unwrap_or(0),
            quantity: item.and_then(|item| item.get("quantity")).and_then(Value::as_i64).unwrap_or(1),
            cancel_at_period_end: sub.get("cancel_at_period_end").and_then(Value::as_bool).unwrap_or(false),
            created: sub.get("created").and_then(Value::as_i64).unwrap_or(0),
            canceled_at: sub.get("canceled_at").and_then(Value::as_i64),
        }
    }
}

/// One Checkout Session as needed by the admin checkout funnel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CheckoutSummary {
    /// open, complete, or expired.
    pub status: String,
    /// subscription or payment.
    pub mode: String,
    pub plan: Option<String>,
    pub interval: Option<String>,
    pub offer: Option<String>,
    pub lp: Option<String>,
    pub created: i64,
}

impl CheckoutSummary {
    /// Maps a Stripe Checkout Session using the metadata our checkout endpoint sets.
    fn from_stripe(session: &Value) -> Self {
        let text = |pointer: &str| session.pointer(pointer).and_then(Value::as_str).map(str::to_string);
        Self {
            status: text("/status").unwrap_or_default(),
            mode: text("/mode").unwrap_or_default(),
            plan: text("/metadata/plan"),
            interval: text("/metadata/interval"),
            offer: text("/metadata/offer"),
            lp: text("/metadata/lp"),
            created: session.get("created").and_then(Value::as_i64).unwrap_or(0),
        }
    }
}

/// Billing cycle of a Stripe subscription as needed by the retention offer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscriptionBilling {
    /// `recurring.interval` of the first item price ("month", "year").
    pub interval: Option<String>,
    /// Unix seconds when the current period ends (the next renewal).
    pub current_period_end: Option<i64>,
}

impl SubscriptionBilling {
    /// Maps a Stripe subscription object.
    ///
    /// Since API version 2025-03-31 the period bounds live on each subscription item;
    /// older versions expose them on the subscription itself, so both are read.
    fn from_stripe(subscription: &Value) -> Self {
        let item = subscription.pointer("/items/data/0");
        Self {
            interval: item
                .and_then(|item| item.pointer("/price/recurring/interval"))
                .and_then(Value::as_str)
                .map(str::to_string),
            current_period_end: item
                .and_then(|item| item.get("current_period_end"))
                .and_then(Value::as_i64)
                .or_else(|| subscription.get("current_period_end").and_then(Value::as_i64)),
        }
    }
}

/// A charge as needed to reverse what it paid for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChargeDetails {
    pub customer: Option<String>,
    pub fingerprint: Option<String>,
    pub email: Option<String>,
    /// `metadata.kind` of the PaymentIntent ("credits", "credits_custom"); None for plans.
    pub kind: Option<String>,
    /// `metadata.org_id` of the PaymentIntent (set on credit checkouts).
    pub org_id: Option<Uuid>,
}

impl ChargeDetails {
    /// Maps a Stripe charge whose `payment_intent` is expanded.
    fn from_stripe(charge: &Value) -> Self {
        let text = |pointer: &str| charge.pointer(pointer).and_then(Value::as_str).map(str::to_string);
        Self {
            customer: text("/customer"),
            fingerprint: text("/payment_method_details/card/fingerprint"),
            email: text("/billing_details/email").or_else(|| text("/receipt_email")),
            kind: text("/payment_intent/metadata/kind"),
            org_id: text("/payment_intent/metadata/org_id").and_then(|raw| Uuid::parse_str(&raw).ok()),
        }
    }

    /// True when the charge bought wallet credits (not a plan).
    fn is_credits(&self) -> bool {
        self.kind.as_deref().is_some_and(|kind| kind.starts_with("credits"))
    }
}

/// The charge an automatic refund returns, with the data used to block repeat refunds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChargeInfo {
    pub id: String,
    /// Stripe card fingerprint (same card across customers).
    pub fingerprint: Option<String>,
}

/// One paid invoice as shown on the Billing page.
#[derive(Debug, Clone, serde::Serialize)]
pub struct InvoiceSummary {
    pub id: String,
    pub number: Option<String>,
    /// Unix seconds when the invoice was created.
    pub created: i64,
    /// Amount paid in the smallest currency unit (cents for USD).
    pub amount_paid: i64,
    pub currency: String,
    pub description: Option<String>,
    pub hosted_invoice_url: Option<String>,
    pub invoice_pdf: Option<String>,
}

impl InvoiceSummary {
    /// Maps one Stripe invoice object; returns None when required fields are missing.
    fn from_stripe(value: &Value) -> Option<Self> {
        let text = |key: &str| value.get(key).and_then(Value::as_str).map(str::to_string);
        let description = text("description").or_else(|| {
            value
                .pointer("/lines/data/0/description")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
        Some(Self {
            id: text("id")?,
            number: text("number"),
            created: value.get("created").and_then(Value::as_i64)?,
            amount_paid: value.get("amount_paid").and_then(Value::as_i64).unwrap_or(0),
            currency: text("currency").unwrap_or_else(|| "usd".to_string()),
            description,
            hosted_invoice_url: text("hosted_invoice_url"),
            invoice_pdf: text("invoice_pdf"),
        })
    }
}

/// Adds the payment-mode Checkout fields that produce an invoice and a reusable customer.
///
/// Docs: https://docs.stripe.com/payments/checkout/receipts#paid-invoices
/// Metadata is also copied onto the PaymentIntent so disputes and refunds of the charge
/// can tell a credit purchase from a plan payment.
fn payment_invoice_fields(form: &mut Vec<(String, String)>, has_customer: bool, metadata: &[(&str, &str)]) {
    form.push(("invoice_creation[enabled]".to_string(), "true".to_string()));
    form.push(("billing_address_collection".to_string(), "required".to_string()));
    buyer_identity_fields(form, has_customer);
    if !has_customer {
        form.push(("customer_creation".to_string(), "always".to_string()));
    }
    for (key, value) in metadata {
        form.push((format!("payment_intent_data[metadata][{key}]"), value.to_string()));
    }
}

/// Lets the buyer declare a business purchase and give the company tax id (CNPJ, EU VAT...).
///
/// With an existing customer, Stripe requires `customer_update[name]` (and the address for tax)
/// so the legal name and address typed in Checkout are saved on the customer.
/// Docs: https://docs.stripe.com/tax/checkout/tax-ids
fn buyer_identity_fields(form: &mut Vec<(String, String)>, has_customer: bool) {
    form.push(("tax_id_collection[enabled]".to_string(), "true".to_string()));
    // Individuals in Brazil need a CPF on the NFS-e; optional here because Checkout cannot condition it on
    // the country. Missing CPFs are requested afterwards (Billing page and email) before the note is issued.
    // Docs: https://docs.stripe.com/payments/checkout/custom-fields
    for (key, value) in [
        ("custom_fields[0][key]", "cpf"),
        ("custom_fields[0][label][type]", "custom"),
        ("custom_fields[0][label][custom]", "CPF (pessoa física no Brasil)"),
        ("custom_fields[0][type]", "text"),
        ("custom_fields[0][optional]", "true"),
        ("custom_fields[0][text][minimum_length]", "11"),
        ("custom_fields[0][text][maximum_length]", "14"),
    ] {
        form.push((key.to_string(), value.to_string()));
    }
    if has_customer {
        form.push(("customer_update[name]".to_string(), "auto".to_string()));
        form.push(("customer_update[address]".to_string(), "auto".to_string()));
    }
}

/// Live Stripe HTTPS client (form POST to api.stripe.com).
pub struct LiveStripe {
    http: reqwest::Client,
    secret: String,
}

impl LiveStripe {
    /// Builds a client authenticated with the secret key.
    pub fn new(http: reqwest::Client, secret: String) -> Self {
        Self { http, secret }
    }

    /// Follows `has_more` / `starting_after` pagination of a Stripe list endpoint.
    ///
    /// Stops after `MAX_LIST_PAGES` pages so an admin report can never pin a worker.
    /// Docs: https://docs.stripe.com/api/pagination
    async fn list_all(&self, url: &str, query: &[(&str, String)]) -> Result<Vec<Value>, String> {
        let mut rows = Vec::new();
        let mut after: Option<String> = None;
        for _ in 0..MAX_LIST_PAGES {
            let mut params: Vec<(&str, String)> = query.to_vec();
            params.push(("limit", "100".to_string()));
            if let Some(last) = &after {
                params.push(("starting_after", last.clone()));
            }
            let response = self
                .http
                .get(url)
                .basic_auth(&self.secret, None::<&str>)
                .query(&params)
                .send()
                .await
                .map_err(|err| err.to_string())?;
            if !response.status().is_success() {
                return Err(format!("stripe list failed with {}", response.status()));
            }
            let body: Value = response.json().await.map_err(|err| err.to_string())?;
            let page = body.get("data").and_then(Value::as_array).cloned().unwrap_or_default();
            after = page.last().and_then(|row| row.get("id")).and_then(Value::as_str).map(str::to_string);
            rows.extend(page);
            if !body.get("has_more").and_then(Value::as_bool).unwrap_or(false) || after.is_none() {
                return Ok(rows);
            }
        }
        tracing::warn!(url, "stripe list truncated at the page cap");
        Ok(rows)
    }
}

#[async_trait]
impl StripeClient for LiveStripe {
    async fn create_checkout(
        &self,
        price_id: &str,
        mode: &str,
        success_url: &str,
        cancel_url: &str,
        customer: Option<&str>,
        metadata: &[(&str, &str)],
        coupon: Option<&str>,
    ) -> Result<String, String> {
        let mut form = vec![
            ("mode".to_string(), mode.to_string()),
            ("success_url".to_string(), success_url.to_string()),
            ("cancel_url".to_string(), cancel_url.to_string()),
            ("line_items[0][price]".to_string(), price_id.to_string()),
            ("line_items[0][quantity]".to_string(), "1".to_string()),
        ];
        if let Some(customer) = customer {
            form.push(("customer".to_string(), customer.to_string()));
        }
        if mode == "payment" {
            payment_invoice_fields(&mut form, customer.is_some(), metadata);
        } else {
            // The billing country decides the statutory refund window.
            form.push(("billing_address_collection".to_string(), "required".to_string()));
            buyer_identity_fields(&mut form, customer.is_some());
            // Abandoned carts: Stripe keeps a recovery URL and can email it to customers
            // who opted in to promotional messages.
            form.push(("after_expiration[recovery][enabled]".to_string(), "true".to_string()));
            form.push(("consent_collection[promotions]".to_string(), "auto".to_string()));
        }
        if let Some(coupon) = coupon {
            form.push(("discounts[0][coupon]".to_string(), coupon.to_string()));
        }
        for (key, value) in metadata {
            form.push((format!("metadata[{key}]"), value.to_string()));
            if mode == "subscription" {
                form.push((format!("subscription_data[metadata][{key}]"), value.to_string()));
            }
        }
        if mode == "subscription" {
            if let Some((_, org_id)) = metadata.iter().find(|(key, _)| *key == "org_id") {
                form.push(("client_reference_id".to_string(), org_id.to_string()));
            }
        }
        let response = self
            .http
            .post("https://api.stripe.com/v1/checkout/sessions")
            .basic_auth(&self.secret, None::<&str>)
            .form(&form)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err("stripe checkout failed".to_string());
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        body.get("url")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "stripe checkout missing url".to_string())
    }

    /// Inline `price_data` line item so no Stripe Price has to exist per amount.
    ///
    /// Docs: https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-line_items-price_data
    async fn create_amount_checkout(
        &self,
        amount_cents: u64,
        product_name: &str,
        success_url: &str,
        cancel_url: &str,
        customer: Option<&str>,
        metadata: &[(&str, &str)],
    ) -> Result<String, String> {
        let mut form = vec![
            ("mode".to_string(), "payment".to_string()),
            ("success_url".to_string(), success_url.to_string()),
            ("cancel_url".to_string(), cancel_url.to_string()),
            ("line_items[0][quantity]".to_string(), "1".to_string()),
            ("line_items[0][price_data][currency]".to_string(), "usd".to_string()),
            ("line_items[0][price_data][unit_amount]".to_string(), amount_cents.to_string()),
            ("line_items[0][price_data][product_data][name]".to_string(), product_name.to_string()),
        ];
        if let Some(customer) = customer {
            form.push(("customer".to_string(), customer.to_string()));
        }
        payment_invoice_fields(&mut form, customer.is_some(), metadata);
        for (key, value) in metadata {
            form.push((format!("metadata[{key}]"), value.to_string()));
        }
        let response = self
            .http
            .post("https://api.stripe.com/v1/checkout/sessions")
            .basic_auth(&self.secret, None::<&str>)
            .form(&form)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err("stripe checkout failed".to_string());
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        body.get("url")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "stripe checkout missing url".to_string())
    }

    async fn create_portal(&self, customer_id: &str, return_url: &str) -> Result<String, String> {
        let form = [
            ("customer", customer_id),
            ("return_url", return_url),
        ];
        let response = self
            .http
            .post("https://api.stripe.com/v1/billing/portal/sessions")
            .basic_auth(&self.secret, None::<&str>)
            .form(&form)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err("stripe portal failed".to_string());
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        body.get("url")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "stripe portal missing url".to_string())
    }

    /// `GET /v1/charges?customer=…`: newest succeeded charge not yet refunded.
    ///
    /// Docs: https://docs.stripe.com/api/charges/list
    async fn latest_charge(&self, customer_id: &str) -> Result<Option<ChargeInfo>, String> {
        let response = self
            .http
            .get("https://api.stripe.com/v1/charges")
            .basic_auth(&self.secret, None::<&str>)
            .query(&[("customer", customer_id), ("limit", "10")])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!("stripe charges failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        Ok(body
            .get("data")
            .and_then(Value::as_array)
            .and_then(|rows| {
                rows.iter().find(|row| {
                    row.get("status").and_then(Value::as_str) == Some("succeeded")
                        && row.get("refunded").and_then(Value::as_bool) != Some(true)
                })
            })
            .and_then(|row| {
                Some(ChargeInfo {
                    id: row.get("id")?.as_str()?.to_string(),
                    fingerprint: row
                        .pointer("/payment_method_details/card/fingerprint")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                })
            }))
    }

    /// `POST /v1/refunds` for the full charge amount.
    ///
    /// Docs: https://docs.stripe.com/api/refunds/create
    async fn refund_charge(&self, charge_id: &str) -> Result<(), String> {
        let response = self
            .http
            .post("https://api.stripe.com/v1/refunds")
            .basic_auth(&self.secret, None::<&str>)
            .form(&[("charge", charge_id), ("reason", "requested_by_customer")])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("stripe refund failed with {}", response.status()))
        }
    }

    /// `POST /v1/subscriptions/{id}` with `cancel_at_period_end=true`.
    ///
    /// Docs: https://docs.stripe.com/api/subscriptions/update
    async fn cancel_at_period_end(&self, subscription_id: &str) -> Result<(), String> {
        let id: String = url::form_urlencoded::byte_serialize(subscription_id.as_bytes()).collect();
        let response = self
            .http
            .post(format!("https://api.stripe.com/v1/subscriptions/{id}"))
            .basic_auth(&self.secret, None::<&str>)
            .form(&[("cancel_at_period_end", "true")])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("stripe cancel failed with {}", response.status()))
        }
    }

    /// `GET /v1/invoices?customer=…&status=paid`.
    ///
    /// Docs: https://docs.stripe.com/api/invoices/list
    async fn list_paid_invoices(&self, customer_id: &str, limit: u32) -> Result<Vec<InvoiceSummary>, String> {
        let limit = limit.clamp(1, 100).to_string();
        let response = self
            .http
            .get("https://api.stripe.com/v1/invoices")
            .basic_auth(&self.secret, None::<&str>)
            .query(&[("customer", customer_id), ("status", "paid"), ("limit", limit.as_str())])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!("stripe invoices failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        Ok(body
            .get("data")
            .and_then(Value::as_array)
            .map(|rows| rows.iter().filter_map(InvoiceSummary::from_stripe).collect())
            .unwrap_or_default())
    }

    /// `DELETE /v1/subscriptions/{id}`; a 404 means it no longer exists.
    ///
    /// Docs: https://docs.stripe.com/api/subscriptions/cancel
    async fn cancel_subscription(&self, subscription_id: &str) -> Result<(), String> {
        let id: String = url::form_urlencoded::byte_serialize(subscription_id.as_bytes()).collect();
        let response = self
            .http
            .delete(format!("https://api.stripe.com/v1/subscriptions/{id}"))
            .basic_auth(&self.secret, None::<&str>)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
            Ok(())
        } else {
            Err(format!("stripe cancel failed with {}", response.status()))
        }
    }

    /// `GET /v1/charges/{id}?expand[]=payment_intent`.
    ///
    /// Docs: https://docs.stripe.com/api/charges/retrieve
    async fn charge_details(&self, charge_id: &str) -> Result<ChargeDetails, String> {
        let id: String = url::form_urlencoded::byte_serialize(charge_id.as_bytes()).collect();
        let response = self
            .http
            .get(format!("https://api.stripe.com/v1/charges/{id}"))
            .basic_auth(&self.secret, None::<&str>)
            .query(&[("expand[]", "payment_intent")])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!("stripe charge lookup failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        Ok(ChargeDetails::from_stripe(&body))
    }

    /// `GET /v1/subscriptions/{id}`.
    ///
    /// Docs: https://docs.stripe.com/api/subscriptions/retrieve
    async fn subscription_billing(&self, subscription_id: &str) -> Result<SubscriptionBilling, String> {
        let id: String = url::form_urlencoded::byte_serialize(subscription_id.as_bytes()).collect();
        let response = self
            .http
            .get(format!("https://api.stripe.com/v1/subscriptions/{id}"))
            .basic_auth(&self.secret, None::<&str>)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!("stripe subscription lookup failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|err| err.to_string())?;
        Ok(SubscriptionBilling::from_stripe(&body))
    }

    /// `POST /v1/subscriptions/{id}` with `discounts[0][coupon]` and `cancel_at_period_end=false`.
    ///
    /// The coupon must be `duration=once` so only the next invoice is discounted.
    /// Docs: https://docs.stripe.com/api/subscriptions/update
    async fn apply_retention_coupon(&self, subscription_id: &str, coupon: &str) -> Result<(), String> {
        let id: String = url::form_urlencoded::byte_serialize(subscription_id.as_bytes()).collect();
        let response = self
            .http
            .post(format!("https://api.stripe.com/v1/subscriptions/{id}"))
            .basic_auth(&self.secret, None::<&str>)
            .form(&[("discounts[0][coupon]", coupon), ("cancel_at_period_end", "false")])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("stripe retention coupon failed with {}", response.status()))
        }
    }

    /// `GET /v1/subscriptions?status=all` (the default list omits canceled ones).
    ///
    /// Docs: https://docs.stripe.com/api/subscriptions/list
    async fn list_subscriptions(&self) -> Result<Vec<SubscriptionSummary>, String> {
        let rows = self.list_all("https://api.stripe.com/v1/subscriptions", &[("status", "all".to_string())]).await?;
        Ok(rows.iter().map(SubscriptionSummary::from_stripe).collect())
    }

    /// `GET /v1/checkout/sessions?created[gte]=…`.
    ///
    /// Docs: https://docs.stripe.com/api/checkout/sessions/list
    async fn list_checkout_sessions(&self, created_since: i64) -> Result<Vec<CheckoutSummary>, String> {
        let rows = self
            .list_all("https://api.stripe.com/v1/checkout/sessions", &[("created[gte]", created_since.to_string())])
            .await?;
        Ok(rows.iter().map(CheckoutSummary::from_stripe).collect())
    }

    /// `GET /v1/balance_transactions?created[gte]=…&created[lt]=…`, summing charges and payments.
    ///
    /// Docs: https://docs.stripe.com/api/balance_transactions/list
    async fn payment_fees(&self, from: i64, to: i64) -> Result<FeeSummary, String> {
        let rows = self
            .list_all(
                "https://api.stripe.com/v1/balance_transactions",
                &[("created[gte]", from.to_string()), ("created[lt]", to.to_string())],
            )
            .await?;
        Ok(rows
            .iter()
            .filter(|row| matches!(row.get("type").and_then(Value::as_str), Some("charge" | "payment")))
            .fold(FeeSummary::default(), |sum, row| FeeSummary {
                amount: sum.amount + row.get("amount").and_then(Value::as_i64).unwrap_or(0),
                fee: sum.fee + row.get("fee").and_then(Value::as_i64).unwrap_or(0),
            }))
    }
}

/// Test double that never calls the network.
pub struct FakeStripe {
    pub checkout_url: String,
    pub portal_url: String,
}

#[async_trait]
impl StripeClient for FakeStripe {
    async fn create_checkout(
        &self,
        _price_id: &str,
        _mode: &str,
        _success_url: &str,
        _cancel_url: &str,
        _customer: Option<&str>,
        _metadata: &[(&str, &str)],
        _coupon: Option<&str>,
    ) -> Result<String, String> {
        Ok(self.checkout_url.clone())
    }

    async fn create_amount_checkout(
        &self,
        _amount_cents: u64,
        _product_name: &str,
        _success_url: &str,
        _cancel_url: &str,
        _customer: Option<&str>,
        _metadata: &[(&str, &str)],
    ) -> Result<String, String> {
        Ok(self.checkout_url.clone())
    }

    async fn create_portal(&self, _customer_id: &str, _return_url: &str) -> Result<String, String> {
        Ok(self.portal_url.clone())
    }

    async fn cancel_subscription(&self, _subscription_id: &str) -> Result<(), String> {
        Ok(())
    }

    async fn latest_charge(&self, _customer_id: &str) -> Result<Option<ChargeInfo>, String> {
        Ok(Some(ChargeInfo { id: "ch_test".to_string(), fingerprint: Some("fp_test".to_string()) }))
    }

    async fn refund_charge(&self, _charge_id: &str) -> Result<(), String> {
        Ok(())
    }

    /// Charges whose id contains "credits" are credit purchases of `org_id` metadata
    /// taken from the id suffix after the last '_' when it parses; others are plan charges.
    async fn charge_details(&self, charge_id: &str) -> Result<ChargeDetails, String> {
        let credits = charge_id.contains("credits");
        Ok(ChargeDetails {
            customer: Some("cus_test".to_string()),
            fingerprint: Some("fp_test".to_string()),
            email: Some("payer@example.com".to_string()),
            kind: credits.then(|| "credits".to_string()),
            org_id: charge_id.rsplit('_').next().and_then(|raw| Uuid::parse_str(raw).ok()),
        })
    }

    async fn cancel_at_period_end(&self, _subscription_id: &str) -> Result<(), String> {
        Ok(())
    }

    /// Subscriptions whose id contains "year" bill yearly; others monthly, renewing in 10 days.
    async fn subscription_billing(&self, subscription_id: &str) -> Result<SubscriptionBilling, String> {
        let interval = if subscription_id.contains("year") { "year" } else { "month" };
        Ok(SubscriptionBilling {
            interval: Some(interval.to_string()),
            current_period_end: Some(chrono::Utc::now().timestamp() + 10 * 86_400),
        })
    }

    async fn apply_retention_coupon(&self, _subscription_id: &str, _coupon: &str) -> Result<(), String> {
        Ok(())
    }

    /// Two active Starter subscriptions (monthly, and yearly scheduled to cancel) and one canceled Pro.
    async fn list_subscriptions(&self) -> Result<Vec<SubscriptionSummary>, String> {
        let now = chrono::Utc::now().timestamp();
        let sub = |status: &str, price: &str, interval: &str, amount: i64, cancel: bool, canceled_at: Option<i64>| SubscriptionSummary {
            id: format!("sub_{price}"),
            customer: Some(format!("cus_{price}")),
            status: status.to_string(),
            price_id: Some(price.to_string()),
            interval: Some(interval.to_string()),
            unit_amount: amount,
            quantity: 1,
            cancel_at_period_end: cancel,
            created: now - 86_400,
            canceled_at,
        };
        Ok(vec![
            sub("active", "price_starter", "month", 2_000, false, None),
            sub("active", "price_starter_yearly", "year", 19_200, true, None),
            sub("canceled", "price_pro", "month", 5_000, false, Some(now - 3_600)),
        ])
    }

    /// 4.5% effective fee on 100.00 of payments.
    async fn payment_fees(&self, _from: i64, _to: i64) -> Result<FeeSummary, String> {
        Ok(FeeSummary { amount: 10_000, fee: 450 })
    }

    /// One completed and one abandoned Starter checkout.
    async fn list_checkout_sessions(&self, created_since: i64) -> Result<Vec<CheckoutSummary>, String> {
        let session = |status: &str| CheckoutSummary {
            status: status.to_string(),
            mode: "subscription".to_string(),
            plan: Some("starter".to_string()),
            interval: Some("monthly".to_string()),
            offer: None,
            lp: Some("code-1-br".to_string()),
            created: created_since + 60,
        };
        Ok(vec![session("complete"), session("expired")])
    }

    async fn list_paid_invoices(&self, _customer_id: &str, _limit: u32) -> Result<Vec<InvoiceSummary>, String> {
        Ok(vec![InvoiceSummary {
            id: "in_test".to_string(),
            number: Some("FAE-0001".to_string()),
            created: 1_700_000_000,
            amount_paid: 2_000,
            currency: "usd".to_string(),
            description: Some("Faelith Starter".to_string()),
            hosted_invoice_url: Some("https://invoice.stripe.com/i/test".to_string()),
            invoice_pdf: None,
        }])
    }
}

/// Verifies `Stripe-Signature` against the raw body using the endpoint secret.
///
/// Official scheme: HMAC-SHA256(secret, "{t}.{payload}") compared to `v1`, with a
/// 300-second timestamp tolerance. Never skips verification.
pub fn verify_stripe_signature(
    secret: &str,
    signature_header: &str,
    payload: &[u8],
    now_unix: i64,
) -> Result<(), String> {
    let mut timestamp = None;
    let mut signatures = Vec::new();
    for part in signature_header.split(',') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("t=") {
            timestamp = Some(value);
        } else if let Some(value) = part.strip_prefix("v1=") {
            signatures.push(value);
        }
    }
    let timestamp = timestamp.ok_or_else(|| "missing stripe timestamp".to_string())?;
    let ts: i64 = timestamp
        .parse()
        .map_err(|_| "invalid stripe timestamp".to_string())?;
    if (now_unix - ts).abs() > 300 {
        return Err("stripe timestamp outside tolerance".to_string());
    }
    let mut signed = timestamp.as_bytes().to_vec();
    signed.push(b'.');
    signed.extend_from_slice(payload);
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| "invalid webhook secret")?;
    mac.update(&signed);
    let expected = hex::encode(mac.finalize().into_bytes());
    let matched = signatures.iter().any(|candidate| {
        candidate.as_bytes().ct_eq(expected.as_bytes()).into()
    });
    if matched {
        Ok(())
    } else {
        Err("stripe signature mismatch".to_string())
    }
}

/// Current unix seconds used by webhook verification.
pub fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Applies a verified Stripe event. Returns Ok(false) when the event was a replay.
///
/// The event id is claimed before processing so concurrent deliveries cannot both apply
/// it; when processing fails the claim is released, the handler answers 500, and Stripe's
/// retry processes the event again.
pub async fn fulfill_stripe_event(
    store: &dyn PlatformStore,
    accounts: &dyn AccountStore,
    stripe: &dyn StripeClient,
    event: &Value,
) -> Result<bool, String> {
    let event_id = event
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "missing event id".to_string())?;
    if !accounts.insert_stripe_event(event_id).await? {
        return Ok(false);
    }
    match apply_event(store, accounts, stripe, event).await {
        Ok(()) => Ok(true),
        Err(error) => {
            if let Err(release) = accounts.delete_stripe_event(event_id).await {
                tracing::error!(error = %release, event_id, "failed to release stripe event for retry");
            }
            Err(error)
        }
    }
}

/// Dispatches one event by type.
async fn apply_event(
    store: &dyn PlatformStore,
    accounts: &dyn AccountStore,
    stripe: &dyn StripeClient,
    event: &Value,
) -> Result<(), String> {
    let event_type = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("");
    let created = event.get("created").and_then(Value::as_i64).unwrap_or(0);
    let object = event
        .get("data")
        .and_then(|data| data.get("object"))
        .cloned()
        .unwrap_or(Value::Null);
    match event_type {
        "checkout.session.completed" | "checkout.session.async_payment_succeeded" => {
            fulfill_checkout(store, &object).await?;
            if let Some(profile) = billing_profile(&object) {
                // Reporting data only: a failed write never fails the fulfillment.
                if let Err(error) = accounts.upsert_billing_profile(&profile).await {
                    tracing::warn!(error = %error, "billing profile write failed");
                }
            }
            Ok(())
        }
        "customer.subscription.updated" | "customer.subscription.created" => {
            if subscription_event_is_current(store, &object, created).await? {
                fulfill_subscription(store, &object).await?;
            }
            Ok(())
        }
        "customer.subscription.deleted" => {
            // Deletion is terminal: applied even if a stale update arrives after it.
            subscription_event_is_current(store, &object, created).await?;
            fulfill_subscription_deleted(store, &object).await
        }
        "charge.dispute.created" => fulfill_dispute(store, stripe, &object).await,
        "charge.refunded" => fulfill_external_refund(store, stripe, &object, event).await,
        _ => Ok(()),
    }
}

/// Advances the subscription's event clock; false when a newer event was already applied.
async fn subscription_event_is_current(store: &dyn PlatformStore, sub: &Value, created: i64) -> Result<bool, String> {
    let Some(subscription_id) = sub.get("id").and_then(Value::as_str) else {
        return Ok(true);
    };
    store
        .advance_subscription_event(subscription_id, created)
        .await
        .map_err(|_| "subscription event clock failed".to_string())
}

/// Micros per US cent (1 USD = 1_000_000 micros).
const MICROS_PER_CENT: i64 = 10_000;

/// Organization a charge belongs to: PaymentIntent metadata, then the stored customer.
async fn charge_org(store: &dyn PlatformStore, details: &ChargeDetails) -> Result<Option<Uuid>, String> {
    if details.org_id.is_some() {
        return Ok(details.org_id);
    }
    Ok(store
        .find_subscription_by_stripe(None, details.customer.as_deref())
        .await
        .map_err(|_| "lookup subscription failed".to_string())?
        .map(|row| row.org_id))
}

/// Ends a plan the way the refund button does: cancel now, revoke keys, mark refunded,
/// block the card and email from future refunds, and set status canceled.
async fn end_subscription(
    store: &dyn PlatformStore,
    stripe: &dyn StripeClient,
    org_id: Uuid,
    details: &ChargeDetails,
) -> Result<(), String> {
    let email = details.email.as_deref().map(crate::auth::normalize_email).unwrap_or_default();
    store
        .add_refund_block(details.fingerprint.as_deref(), &email)
        .await
        .map_err(|_| "refund block failed".to_string())?;
    let _ = store.mark_refunded(org_id).await;
    revoke_org_keys(store, org_id).await?;
    let Some(sub) = store
        .get_subscription(org_id)
        .await
        .map_err(|_| "load subscription failed".to_string())?
    else {
        return Ok(());
    };
    if let Some(subscription_id) = sub.stripe_subscription_id.as_deref() {
        stripe.cancel_subscription(subscription_id).await?;
    }
    store
        .upsert_subscription(OrgSubscription { status: "canceled".to_string(), usage_based: false, ..sub })
        .await
        .map_err(|_| "upsert subscription failed".to_string())
}

/// Revokes every live key of the organization.
async fn revoke_org_keys(store: &dyn PlatformStore, org_id: Uuid) -> Result<(), String> {
    let keys = store
        .list_keys_for_org(org_id)
        .await
        .map_err(|_| "list keys failed".to_string())?;
    for key in keys.iter().filter(|key| !key.revoked) {
        store
            .revoke_key(&key.prefix)
            .await
            .map_err(|_| "revoke key failed".to_string())?;
    }
    Ok(())
}

/// Chargeback: suspend the org, revoke keys, end the plan, and remove the disputed credits.
async fn fulfill_dispute(store: &dyn PlatformStore, stripe: &dyn StripeClient, dispute: &Value) -> Result<(), String> {
    let charge_id = dispute
        .get("charge")
        .and_then(Value::as_str)
        .ok_or_else(|| "dispute missing charge".to_string())?;
    let details = stripe.charge_details(charge_id).await?;
    let Some(org_id) = charge_org(store, &details).await? else {
        tracing::warn!(charge_id, "dispute for a charge with no known organization");
        return Ok(());
    };
    store
        .suspend_org(org_id, "chargeback")
        .await
        .map_err(|_| "suspend org failed".to_string())?;
    if details.is_credits() {
        let cents = dispute.get("amount").and_then(Value::as_i64).unwrap_or(0);
        store
            .deduct_credits(org_id, cents.saturating_mul(MICROS_PER_CENT))
            .await
            .map_err(|_| "deduct credits failed".to_string())?;
        revoke_org_keys(store, org_id).await
    } else {
        end_subscription(store, stripe, org_id, &details).await
    }
}

/// Refund made outside the refund button (e.g. the Stripe Dashboard).
///
/// Plan charge refunded in full: same effects as the refund button. Credit charge: the
/// newly refunded amount (`amount_refunded` minus its previous value) leaves the wallet.
async fn fulfill_external_refund(
    store: &dyn PlatformStore,
    stripe: &dyn StripeClient,
    charge: &Value,
    event: &Value,
) -> Result<(), String> {
    let charge_id = charge
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "refund missing charge id".to_string())?;
    let details = stripe.charge_details(charge_id).await?;
    let Some(org_id) = charge_org(store, &details).await? else {
        tracing::warn!(charge_id, "refund for a charge with no known organization");
        return Ok(());
    };
    if details.is_credits() {
        let refunded = charge.get("amount_refunded").and_then(Value::as_i64).unwrap_or(0);
        let previous = event
            .pointer("/data/previous_attributes/amount_refunded")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let cents = (refunded - previous).max(0);
        store
            .deduct_credits(org_id, cents.saturating_mul(MICROS_PER_CENT))
            .await
            .map_err(|_| "deduct credits failed".to_string())?;
        return Ok(());
    }
    if charge.get("refunded").and_then(Value::as_bool) != Some(true) {
        tracing::warn!(charge_id, "partial refund of a plan charge; plan left unchanged");
        return Ok(());
    }
    end_subscription(store, stripe, org_id, &details).await
}

/// Smallest custom top-up, in US cents ($5).
pub const MIN_CUSTOM_CREDIT_CENTS: u64 = 500;
/// Largest custom top-up, in US cents ($10,000); bounds typos and fraud exposure.
pub const MAX_CUSTOM_CREDIT_CENTS: u64 = 1_000_000;

/// Wallet micros for a paid custom top-up, taken from what Stripe collected.
///
/// Requires `payment_status == "paid"` and USD, and grants `amount_total`
/// (cents) rather than any client-supplied value, so a tampered request can
/// never credit more than was charged.
fn custom_credit_micros(session: &Value) -> Result<i64, String> {
    if session.get("payment_status").and_then(Value::as_str) != Some("paid") {
        return Err("custom credit checkout is not paid".to_string());
    }
    if session.get("currency").and_then(Value::as_str) != Some("usd") {
        return Err("custom credit checkout is not in usd".to_string());
    }
    let cents = session
        .get("amount_total")
        .and_then(Value::as_u64)
        .ok_or_else(|| "custom credit checkout missing amount_total".to_string())?;
    if cents < MIN_CUSTOM_CREDIT_CENTS {
        return Err("custom credit amount below minimum".to_string());
    }
    i64::try_from(cents.saturating_mul(10_000)).map_err(|_| "custom credit amount overflow".to_string())
}

/// Stores the Checkout customer on the org when it has none yet (credit-only buyers).
async fn remember_customer(store: &dyn PlatformStore, org_id: Uuid, customer: Option<&str>) -> Result<(), String> {
    let Some(customer) = customer else {
        return Ok(());
    };
    let existing = store
        .get_subscription(org_id)
        .await
        .map_err(|_| "load subscription failed".to_string())?;
    if existing.as_ref().is_some_and(|row| row.stripe_customer_id.is_some()) {
        return Ok(());
    }
    let record = match existing {
        Some(row) => OrgSubscription { stripe_customer_id: Some(customer.to_string()), ..row },
        None => OrgSubscription {
            org_id,
            stripe_customer_id: Some(customer.to_string()),
            stripe_subscription_id: None,
            plan: None,
            status: "none".to_string(),
            usage_based: false,
        },
    };
    store
        .upsert_subscription(record)
        .await
        .map_err(|_| "store customer failed".to_string())
}

/// Opens the refund window when the buyer's country grants a statutory withdrawal right.
/// Only the organization's first subscription opens one (the store never reopens it).
async fn open_statutory_window(store: &dyn PlatformStore, org_id: Uuid, session: &Value) -> Result<(), String> {
    let country = session
        .pointer("/customer_details/address/country")
        .and_then(Value::as_str);
    let Some(days) = faelith_core::refund::window_days_for_country(country) else {
        return Ok(());
    };
    store
        .open_refund_window(org_id, chrono::Utc::now() + chrono::Duration::days(days), country.unwrap_or(""))
        .await
        .map(|_| ())
        .map_err(|_| "open refund window failed".to_string())
}

/// Records the one-month intro period (halved limits, usage at provider cost) for the org.
/// The Stripe coupon (duration once) discounts the first invoice; renewal is full price.
async fn start_intro_month(store: &dyn PlatformStore, org_id: Uuid, session: &Value) -> Result<(), String> {
    let email = session
        .pointer("/customer_details/email")
        .and_then(Value::as_str)
        .map(crate::auth::normalize_email)
        .unwrap_or_default();
    let until = chrono::Utc::now()
        .checked_add_months(chrono::Months::new(1))
        .ok_or_else(|| "intro period overflow".to_string())?;
    store
        .start_intro_offer(org_id, &email, until)
        .await
        .map(|_| ())
        .map_err(|_| "start intro offer failed".to_string())
}

/// Grants credits or activates a plan from Checkout Session metadata.
///
/// Delayed payment methods complete the session unpaid; nothing is granted until
/// Buyer profile from a Checkout Session: business when a company tax id was given (a Brazilian
/// CPF identifies a person, so it stays `individual`), plus the billing country.
fn billing_profile(session: &Value) -> Option<crate::accounts::BillingProfile> {
    let customer = session.get("customer").and_then(Value::as_str)?.to_string();
    let tax_id_type = session
        .pointer("/customer_details/tax_ids/0/type")
        .and_then(Value::as_str)
        .map(str::to_string);
    let kind = match tax_id_type.as_deref() {
        Some(kind) if kind != "br_cpf" => "business",
        _ => "individual",
    };
    Some(crate::accounts::BillingProfile {
        stripe_customer_id: customer,
        org_id: session
            .pointer("/metadata/org_id")
            .and_then(Value::as_str)
            .and_then(|raw| Uuid::parse_str(raw).ok()),
        kind: kind.to_string(),
        tax_id_type,
        country: session.pointer("/customer_details/address/country").and_then(Value::as_str).map(str::to_string),
        updated_at: chrono::Utc::now(),
    })
}

/// `checkout.session.async_payment_succeeded` delivers it with `payment_status == "paid"`.
async fn fulfill_checkout(store: &dyn PlatformStore, session: &Value) -> Result<(), String> {
    let payment_status = session.get("payment_status").and_then(Value::as_str);
    if !matches!(payment_status, Some("paid") | Some("no_payment_required")) {
        return Ok(());
    }
    let metadata = session.get("metadata").cloned().unwrap_or(Value::Null);
    let org_id = metadata
        .get("org_id")
        .and_then(Value::as_str)
        .and_then(|raw| Uuid::parse_str(raw).ok())
        .ok_or_else(|| "checkout missing org_id".to_string())?;
    let kind = metadata
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("subscription");
    let customer = session
        .get("customer")
        .and_then(Value::as_str)
        .map(str::to_string);
    let subscription_id = session
        .get("subscription")
        .and_then(Value::as_str)
        .map(str::to_string);
    if kind.starts_with("credits") {
        remember_customer(store, org_id, customer.as_deref()).await?;
    }
    match kind {
        "credits" => {
            let pack = metadata
                .get("pack")
                .and_then(Value::as_str)
                .and_then(CreditPack::parse)
                .ok_or_else(|| "checkout missing pack".to_string())?;
            store
                .grant_credits(org_id, pack.micros())
                .await
                .map_err(|_| "grant credits failed".to_string())?;
            Ok(())
        }
        "credits_custom" => {
            let micros = custom_credit_micros(session)?;
            store
                .grant_credits(org_id, micros)
                .await
                .map_err(|_| "grant credits failed".to_string())?;
            Ok(())
        }
        _ => {
            let plan = metadata
                .get("plan")
                .and_then(Value::as_str)
                .and_then(PlanTier::parse);
            let existing = store
                .get_subscription(org_id)
                .await
                .map_err(|_| "load subscription failed".to_string())?;
            let usage_based = existing
                .as_ref()
                .map(|row| row.usage_based)
                .unwrap_or(false);
            store
                .upsert_subscription(OrgSubscription {
                    org_id,
                    stripe_customer_id: customer.or_else(|| {
                        existing.and_then(|row| row.stripe_customer_id)
                    }),
                    stripe_subscription_id: subscription_id,
                    plan,
                    status: "active".to_string(),
                    usage_based,
                })
                .await
                .map_err(|_| "upsert subscription failed".to_string())?;
            open_statutory_window(store, org_id, session).await?;
            if metadata.get("offer").and_then(Value::as_str) == Some("intro") {
                start_intro_month(store, org_id, session).await?;
            }
            Ok(())
        }
    }
}

/// Updates plan status from a Stripe Subscription object.
async fn fulfill_subscription(store: &dyn PlatformStore, sub: &Value) -> Result<(), String> {
    let Some(org_id) = resolve_subscription_org(store, sub).await? else {
        return Ok(());
    };
    let metadata = sub.get("metadata").cloned().unwrap_or(Value::Null);
    let status = sub
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("active")
        .to_string();
    let customer = sub
        .get("customer")
        .and_then(Value::as_str)
        .map(str::to_string);
    let subscription_id = sub.get("id").and_then(Value::as_str).map(str::to_string);
    let existing = store
        .get_subscription(org_id)
        .await
        .map_err(|_| "load subscription failed".to_string())?;
    let plan = metadata
        .get("plan")
        .and_then(Value::as_str)
        .and_then(PlanTier::parse)
        .or_else(|| existing.as_ref().and_then(|row| row.plan));
    let usage_based = existing.as_ref().map(|row| row.usage_based).unwrap_or(false);
    store
        .upsert_subscription(OrgSubscription {
            org_id,
            stripe_customer_id: customer.or_else(|| {
                existing.and_then(|row| row.stripe_customer_id)
            }),
            stripe_subscription_id: subscription_id,
            plan,
            status,
            usage_based,
        })
        .await
        .map_err(|_| "upsert subscription failed".to_string())?;
    Ok(())
}

/// Marks a subscription canceled without dropping the customer id.
async fn fulfill_subscription_deleted(
    store: &dyn PlatformStore,
    sub: &Value,
) -> Result<(), String> {
    let Some(org_id) = resolve_subscription_org(store, sub).await? else {
        return Ok(());
    };
    let existing = store
        .get_subscription(org_id)
        .await
        .map_err(|_| "load subscription failed".to_string())?;
    store
        .upsert_subscription(OrgSubscription {
            org_id,
            stripe_customer_id: existing.as_ref().and_then(|row| row.stripe_customer_id.clone()),
            stripe_subscription_id: existing
                .as_ref()
                .and_then(|row| row.stripe_subscription_id.clone()),
            plan: existing.as_ref().and_then(|row| row.plan),
            status: "canceled".to_string(),
            usage_based: existing.as_ref().map(|row| row.usage_based).unwrap_or(false),
        })
        .await
        .map_err(|_| "upsert subscription failed".to_string())?;
    Ok(())
}

/// Resolves org_id from Subscription metadata, then Stripe ids stored at Checkout.
async fn resolve_subscription_org(
    store: &dyn PlatformStore,
    sub: &Value,
) -> Result<Option<Uuid>, String> {
    if let Some(id) = sub
        .get("metadata")
        .and_then(|metadata| metadata.get("org_id"))
        .and_then(Value::as_str)
        .and_then(|raw| Uuid::parse_str(raw).ok())
    {
        return Ok(Some(id));
    }
    let subscription_id = sub.get("id").and_then(Value::as_str);
    let customer_id = sub.get("customer").and_then(Value::as_str);
    Ok(store
        .find_subscription_by_stripe(subscription_id, customer_id)
        .await
        .map_err(|_| "lookup subscription failed".to_string())?
        .map(|row| row.org_id))
}

/// Builds success/cancel URLs on the public origin.
/// Checkout return URLs on the SPA page that started the purchase (`/app/billing`, `/app/spending`).
pub fn checkout_urls(config: &WebConfig, page: &str) -> (String, String) {
    (
        format!("{}{page}?checkout=success", config.public_origin),
        format!("{}{page}?checkout=cancel", config.public_origin),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::accounts::MemoryAccounts;
    use faelith_core::store::MemoryStore;
    use serde_json::json;

    /// Network-free Stripe client.
    fn fake() -> FakeStripe {
        FakeStripe { checkout_url: String::new(), portal_url: String::new() }
    }

    /// Memory org with a Stripe customer, one live key, and 50 USD of credits.
    async fn funded_org(store: &MemoryStore) -> Uuid {
        let org = store.create_org("billing").await.unwrap();
        store
            .upsert_subscription(OrgSubscription {
                org_id: org,
                stripe_customer_id: Some("cus_test".to_string()),
                stripe_subscription_id: Some("sub_1".to_string()),
                plan: Some(PlanTier::Starter),
                status: "active".to_string(),
                usage_based: false,
            })
            .await
            .unwrap();
        store.grant_credits(org, 50_000_000).await.unwrap();
        org
    }

    /// A paid intro checkout starts the one-month intro period.
    #[tokio::test]
    async fn intro_checkout_starts_intro_month() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = store.create_org("intro").await.unwrap();
        let event = json!({"id": "evt_intro", "type": "checkout.session.completed", "data": {"object": {
            "payment_status": "paid", "customer": "cus_i", "subscription": "sub_i",
            "customer_details": {"email": "New@Example.com"},
            "metadata": {"org_id": org.to_string(), "kind": "subscription", "plan": "starter", "offer": "intro"}}}});
        fulfill_stripe_event(&store, &accounts, &fake(), &event).await.unwrap();
        assert!(faelith_core::intro_active(&store, org).await.unwrap());
        assert!(store.intro_offer_claimed(Uuid::new_v4(), "new@example.com").await.unwrap());
    }

    /// A failed event is released so Stripe's retry is processed, not dropped as a replay.
    #[tokio::test]
    async fn failed_event_is_retried() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let bad = json!({"id": "evt_retry", "type": "checkout.session.completed",
            "data": {"object": {"payment_status": "paid", "metadata": {}}}});
        assert!(fulfill_stripe_event(&store, &accounts, &fake(), &bad).await.is_err());
        assert!(accounts.insert_stripe_event("evt_retry").await.unwrap(), "event id must be released");
    }

    /// Unpaid (delayed) sessions grant nothing; the async success event grants once paid.
    #[tokio::test]
    async fn delayed_payment_grants_only_when_paid() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = store.create_org("async").await.unwrap();
        let session = |status: &str| json!({"payment_status": status, "customer": "cus_a",
            "metadata": {"org_id": org.to_string(), "kind": "credits", "pack": "10"}});
        let pending = json!({"id": "evt_a", "type": "checkout.session.completed", "data": {"object": session("unpaid")}});
        fulfill_stripe_event(&store, &accounts, &fake(), &pending).await.unwrap();
        assert_eq!(store.credit_balance(org).await.unwrap(), 0);
        let paid = json!({"id": "evt_b", "type": "checkout.session.async_payment_succeeded", "data": {"object": session("paid")}});
        fulfill_stripe_event(&store, &accounts, &fake(), &paid).await.unwrap();
        assert!(store.credit_balance(org).await.unwrap() > 0);
    }

    /// An older subscription event delivered late does not overwrite a newer status.
    #[tokio::test]
    async fn stale_subscription_event_is_ignored() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = funded_org(&store).await;
        let event = |id: &str, created: i64, status: &str| json!({"id": id, "type": "customer.subscription.updated",
            "created": created, "data": {"object": {"id": "sub_1", "customer": "cus_test", "status": status,
            "metadata": {"org_id": org.to_string()}}}});
        fulfill_stripe_event(&store, &accounts, &fake(), &event("evt_new", 200, "past_due")).await.unwrap();
        fulfill_stripe_event(&store, &accounts, &fake(), &event("evt_old", 100, "active")).await.unwrap();
        assert_eq!(store.get_subscription(org).await.unwrap().unwrap().status, "past_due");
    }

    /// A chargeback suspends the org, revokes keys, and ends the plan.
    #[tokio::test]
    async fn dispute_suspends_and_cancels() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = funded_org(&store).await;
        let event = json!({"id": "evt_d", "type": "charge.dispute.created",
            "data": {"object": {"charge": "ch_plan", "amount": 2000}}});
        fulfill_stripe_event(&store, &accounts, &fake(), &event).await.unwrap();
        assert!(store.is_org_suspended(org).await.unwrap());
        assert_eq!(store.get_subscription(org).await.unwrap().unwrap().status, "canceled");
    }

    /// A disputed credit purchase removes that amount from the wallet.
    #[tokio::test]
    async fn credit_dispute_removes_credits() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = funded_org(&store).await;
        let event = json!({"id": "evt_dc", "type": "charge.dispute.created",
            "data": {"object": {"charge": format!("ch_credits_{org}"), "amount": 2000}}});
        fulfill_stripe_event(&store, &accounts, &fake(), &event).await.unwrap();
        assert!(store.is_org_suspended(org).await.unwrap());
        assert_eq!(store.credit_balance(org).await.unwrap(), 30_000_000);
    }

    /// A dashboard refund of a plan charge has the refund button's effects.
    #[tokio::test]
    async fn dashboard_refund_ends_plan() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = funded_org(&store).await;
        let event = json!({"id": "evt_r", "type": "charge.refunded",
            "data": {"object": {"id": "ch_plan", "refunded": true, "amount_refunded": 2000}}});
        fulfill_stripe_event(&store, &accounts, &fake(), &event).await.unwrap();
        assert_eq!(store.get_subscription(org).await.unwrap().unwrap().status, "canceled");
        assert!(store.refund_blocked(Some("fp_test"), "someone@else.com").await.unwrap());
        assert!(!store.is_org_suspended(org).await.unwrap());
    }

    /// A partial dashboard refund of credits removes only the newly refunded delta.
    #[tokio::test]
    async fn credit_refund_removes_delta() {
        let store = MemoryStore::new();
        let accounts = MemoryAccounts::new();
        let org = funded_org(&store).await;
        let event = json!({"id": "evt_rc", "type": "charge.refunded",
            "data": {"object": {"id": format!("ch_credits_{org}"), "refunded": false, "amount_refunded": 1500},
                     "previous_attributes": {"amount_refunded": 500}}});
        fulfill_stripe_event(&store, &accounts, &fake(), &event).await.unwrap();
        assert_eq!(store.credit_balance(org).await.unwrap(), 40_000_000);
    }

    /// Portal cancel without Subscription metadata still marks the org canceled.
    #[tokio::test]
    async fn subscription_deleted_resolves_org_without_metadata() {
        let store = MemoryStore::new();
        let org = store.create_org("portal").await.unwrap();
        store
            .upsert_subscription(OrgSubscription {
                org_id: org,
                stripe_customer_id: Some("cus_1".to_string()),
                stripe_subscription_id: Some("sub_1".to_string()),
                plan: Some(PlanTier::Starter),
                status: "active".to_string(),
                usage_based: false,
            })
            .await
            .unwrap();
        let accounts = MemoryAccounts::new();
        let event = json!({
            "id": "evt_del",
            "type": "customer.subscription.deleted",
            "data": {"object": {
                "id": "sub_1",
                "customer": "cus_1",
                "metadata": {}
            }}
        });
        fulfill_stripe_event(&store, &accounts, &fake(), &event).await.unwrap();
        let row = store.get_subscription(org).await.unwrap().unwrap();
        assert_eq!(row.status, "canceled");
        assert_eq!(row.plan, Some(PlanTier::Starter));
    }

    /// A company tax id marks a business buyer; a CPF or no tax id marks an individual.
    #[test]
    fn billing_profile_kinds() {
        let session = |tax: Value| json!({
            "customer": "cus_1",
            "metadata": {"org_id": "00000000-0000-0000-0000-000000000001"},
            "customer_details": {"address": {"country": "BR"}, "tax_ids": tax},
        });
        let business = billing_profile(&session(json!([{"type": "br_cnpj", "value": "00.000.000/0001-00"}]))).unwrap();
        assert_eq!((business.kind.as_str(), business.tax_id_type.as_deref()), ("business", Some("br_cnpj")));
        assert_eq!(business.country.as_deref(), Some("BR"));
        assert_eq!(billing_profile(&session(json!([{"type": "br_cpf", "value": "000.000.000-00"}]))).unwrap().kind, "individual");
        assert_eq!(billing_profile(&session(json!([]))).unwrap().kind, "individual");
        assert!(billing_profile(&json!({"customer_details": {}})).is_none());
    }
}
