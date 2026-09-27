/**
 * @fileoverview Admin subscriptions report straight from Stripe: live subscriptions per plan and interval, MRR, churn, checkout funnel.
 * @author Samuel S. L.
 * @version 1.4.0
 * @since 2026-09-26
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
 * - Reads every subscription (any status) and the Checkout Sessions of the period on each request (admin only)
 * - Plans are resolved by reverse-mapping configured Price IDs (STRIPE_PRICE_*); unknown prices keep their id
 * - MRR uses list prices (yearly / 12); coupons (intro, retention) are not deducted
 * - Refund windows (local store): open now by plan / interval, by window length (7d, 14d...), by country,
 *   plus windows opened and refunded in the period and the refund rate
 * - Real profit = revenue - provider cost - payment fees - tax on revenue - tax on the remaining profit;
 *   payment fees use the effective rate measured in Stripe (configured fallback); tax rates are
 *   configurable (ADMIN_TAX_REVENUE_PCT / ADMIN_TAX_PROFIT_PCT defaults, overridable per request):
 *   subscriptions per plan / interval on a monthly basis (MRR vs included usage cost scaled to 30 days),
 *   pure API usage and subscriber overage (prepaid credits) on the period's actual usage
 * - Buyer mix of live subscriptions: business vs individual (Checkout tax id) and billing country
 * - Checkout funnel groups subscription sessions by plan and interval, by landing page tag, and intro offer use
 */

use crate::admin::require_admin;
use crate::analytics::{resolve_range, RangeQuery};
use crate::config::WebConfig;
use crate::routes::err;
use crate::stripe::{CheckoutSummary, SubscriptionSummary};
use crate::AppState;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use faelith_core::refund::RefundWindow;
use faelith_core::store::UsageCostRow;
use faelith_core::plans::ChargeSource;
use faelith_core::{KeyPurpose, PlanTier};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};

/// Statuses that still represent a customer relationship.
const LIVE: [&str; 3] = ["active", "trialing", "past_due"];
/// Statuses whose price counts towards MRR (trials pay nothing yet).
const PAYING: [&str; 2] = ["active", "past_due"];

/// Resolves `(plan, interval)` labels for a subscription from the configured Price IDs.
fn plan_of(prices: &HashMap<String, String>, sub: &SubscriptionSummary) -> (String, String) {
    let interval = match sub.interval.as_deref() {
        Some("year") => "yearly",
        _ => "monthly",
    };
    let Some(price) = sub.price_id.as_deref() else {
        return ("unknown".to_string(), interval.to_string());
    };
    let plan = prices
        .iter()
        .find(|(_, id)| id.as_str() == price)
        .map(|(key, _)| key.split(':').next().unwrap_or(key).to_string())
        .unwrap_or_else(|| price.to_string());
    (plan, interval.to_string())
}

/// Monthly recurring revenue of one subscription in cents (yearly prices spread over 12 months).
fn monthly_cents(sub: &SubscriptionSummary) -> i64 {
    let total = sub.unit_amount.saturating_mul(sub.quantity.max(1));
    if sub.interval.as_deref() == Some("year") {
        total / 12
    } else {
        total
    }
}

/// Per-plan counters for live subscriptions.
#[derive(Default)]
struct PlanRow {
    monthly: u64,
    yearly: u64,
    cancel_scheduled: u64,
    mrr_cents: i64,
}

/// Checkout funnel counters for one group.
#[derive(Default)]
struct Funnel {
    started: u64,
    completed: u64,
    open: u64,
}

impl Funnel {
    /// Adds one Checkout Session.
    fn add(&mut self, session: &CheckoutSummary) {
        self.started += 1;
        match session.status.as_str() {
            "complete" => self.completed += 1,
            "open" => self.open += 1,
            _ => {}
        }
    }

    /// JSON row with the conversion rate (completed / started, one decimal).
    fn to_json(&self, name: &str) -> Value {
        let rate = if self.started == 0 { 0.0 } else { (self.completed as f64 * 1000.0 / self.started as f64).round() / 10.0 };
        json!({ "name": name, "started": self.started, "completed": self.completed, "open": self.open, "conversion": rate })
    }
}

/// Groups sessions with `key` and returns rows sorted by sessions started.
fn funnel_rows(sessions: &[&CheckoutSummary], key: impl Fn(&CheckoutSummary) -> Option<String>) -> Vec<Value> {
    let mut groups: HashMap<String, Funnel> = HashMap::new();
    for session in sessions {
        if let Some(name) = key(session) {
            groups.entry(name).or_default().add(session);
        }
    }
    let mut rows: Vec<(String, Funnel)> = groups.into_iter().collect();
    rows.sort_by(|a, b| b.1.started.cmp(&a.1.started).then_with(|| a.0.cmp(&b.0)));
    rows.iter().map(|(name, funnel)| funnel.to_json(name)).collect()
}

/// Tax rates applied by the profit report, as fractions (0.06 = 6%).
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct TaxRates {
    /// Charged on revenue (Simples DAS, Presumido PIS/COFINS/ISS/IRPJ/CSLL, Real PIS/COFINS/ISS).
    pub(crate) revenue: f64,
    /// Charged on profit after revenue tax and provider cost (Lucro Real IRPJ + CSLL).
    pub(crate) profit: f64,
    /// Payment processing fees (Stripe), as a fraction of revenue.
    pub(crate) payment_fee: f64,
}

/// Optional per-request overrides, in percent.
#[derive(Debug, Default, serde::Deserialize)]
pub struct TaxQuery {
    revenue_tax: Option<f64>,
    profit_tax: Option<f64>,
    payment_fee: Option<f64>,
}

impl TaxRates {
    /// Request overrides (clamped to 0..=100) over the defaults; the payment fee default is the rate
    /// measured in Stripe when there were payments, else the configured fallback.
    fn resolve(config: &WebConfig, query: &TaxQuery, measured_fee: Option<f64>) -> (Self, &'static str) {
        let pct = |value: Option<f64>, default: f64| value.filter(|v| v.is_finite()).unwrap_or(default).clamp(0.0, 100.0) / 100.0;
        let (fee_default, source) = match (query.payment_fee, measured_fee) {
            (Some(_), _) => (config.payment_fee_pct, "override"),
            (None, Some(rate)) => (rate * 100.0, "stripe"),
            (None, None) => (config.payment_fee_pct, "config"),
        };
        let rates = Self {
            revenue: pct(query.revenue_tax, config.tax_revenue_pct),
            profit: pct(query.profit_tax, config.tax_profit_pct),
            payment_fee: pct(query.payment_fee, fee_default),
        };
        (rates, source)
    }
}
/// Days in the monthly normalization of subscription costs.
const MONTH_DAYS: f64 = 30.0;

/// Micros (1e-6 USD) to cents.
fn cents(micros: i64) -> i64 {
    micros / 10_000
}

/// Profit line: revenue - provider cost - payment fees - tax on revenue - tax on the positive remainder.
fn profit_line(revenue_cents: i64, cost_cents: i64, rates: TaxRates) -> Value {
    let fee = (revenue_cents as f64 * rates.payment_fee).round() as i64;
    let revenue_tax = (revenue_cents as f64 * rates.revenue).round() as i64;
    let before_profit_tax = revenue_cents - cost_cents - fee - revenue_tax;
    let profit_tax = (before_profit_tax.max(0) as f64 * rates.profit).round() as i64;
    let profit = before_profit_tax - profit_tax;
    let margin = if revenue_cents > 0 { (profit as f64 * 1000.0 / revenue_cents as f64).round() / 10.0 } else { 0.0 };
    json!({
        "revenue_cents": revenue_cents,
        "cost_cents": cost_cents,
        "fee_cents": fee,
        "revenue_tax_cents": revenue_tax,
        "profit_tax_cents": profit_tax,
        "tax_cents": revenue_tax + profit_tax,
        "profit_cents": profit,
        "margin": margin,
    })
}

/// Current `(plan, interval)` of an organization with a live subscription, used to attribute usage cost.
pub(crate) type OrgPlans = HashMap<uuid::Uuid, (String, String)>;

/// Resolves the plan and interval of every organization that consumed included allowance.
async fn org_plans(state: &AppState, subs: &[SubscriptionSummary], usage: &[UsageCostRow]) -> OrgPlans {
    let intervals: HashMap<&str, &str> = subs
        .iter()
        .map(|sub| (sub.id.as_str(), if sub.interval.as_deref() == Some("year") { "yearly" } else { "monthly" }))
        .collect();
    let mut plans = OrgPlans::new();
    for row in usage.iter().filter(|row| row.charge_source == ChargeSource::IncludedPlan) {
        if plans.contains_key(&row.org_id) {
            continue;
        }
        let sub = state.store.get_subscription(row.org_id).await.ok().flatten();
        let plan = sub.as_ref().and_then(|s| s.active_plan()).map(PlanTier::as_str);
        let interval = sub
            .as_ref()
            .and_then(|s| s.stripe_subscription_id.as_deref())
            .and_then(|id| intervals.get(id).copied())
            .unwrap_or("monthly");
        let key = match plan {
            Some(plan) => (plan.to_string(), interval.to_string()),
            None => ("no active plan".to_string(), "-".to_string()),
        };
        plans.insert(row.org_id, key);
    }
    plans
}

/// Real profit section.
///
/// Subscriptions: monthly basis per plan / interval — MRR (list price, yearly / 12) against the
/// provider cost of included usage in the period scaled to 30 days. Usage paid with prepaid
/// credits is split into pure API (`api` keys) and subscriber overage (Code / Chat); both use the
/// period's actual list-price revenue and provider cost. The same tax rates apply everywhere.
fn profit_json(config: &WebConfig, subs: &[SubscriptionSummary], usage: &[UsageCostRow], plans: &OrgPlans, period_days: f64, rates: TaxRates) -> Value {
    let scale = if period_days > 0.0 { MONTH_DAYS / period_days } else { 0.0 };
    let mut groups: BTreeMap<String, (u64, i64, i64)> = BTreeMap::new();
    for sub in subs.iter().filter(|sub| PAYING.contains(&sub.status.as_str())) {
        let (plan, interval) = plan_of(&config.stripe_prices, sub);
        let entry = groups.entry(format!("{plan} / {interval}")).or_default();
        entry.0 += 1;
        entry.1 += monthly_cents(sub);
    }
    let (mut api_revenue, mut api_cost, mut api_requests, mut api_orgs) = (0_i64, 0_i64, 0_u64, std::collections::HashSet::new());
    let (mut overage_revenue, mut overage_cost, mut overage_requests) = (0_i64, 0_i64, 0_u64);
    for row in usage {
        match (row.charge_source, row.surface) {
            (ChargeSource::IncludedPlan, _) => {
                let (plan, interval) = plans.get(&row.org_id).cloned().unwrap_or_else(|| ("no active plan".into(), "-".into()));
                groups.entry(format!("{plan} / {interval}")).or_default().2 += cents(row.cost_micros);
            }
            (ChargeSource::PrepaidCredits, KeyPurpose::Api) => {
                api_revenue += cents(row.revenue_micros);
                api_cost += cents(row.cost_micros);
                api_requests += row.requests;
                api_orgs.insert(row.org_id);
            }
            (ChargeSource::PrepaidCredits, _) => {
                overage_revenue += cents(row.revenue_micros);
                overage_cost += cents(row.cost_micros);
                overage_requests += row.requests;
            }
        }
    }
    let (mut total_count, mut total_mrr, mut total_cost) = (0_u64, 0_i64, 0_i64);
    let rows: Vec<Value> = groups
        .iter()
        .map(|(name, (count, mrr, period_cost))| {
            let monthly_cost = (*period_cost as f64 * scale).round() as i64;
            total_count += count;
            total_mrr += mrr;
            total_cost += monthly_cost;
            let mut line = profit_line(*mrr, monthly_cost, rates);
            line["name"] = json!(name);
            line["subscriptions"] = json!(count);
            line["profit_per_sub_cents"] = json!(line["profit_cents"].as_i64().unwrap_or(0).checked_div(*count as i64).unwrap_or(0));
            line
        })
        .collect();
    let mut total = profit_line(total_mrr, total_cost, rates);
    total["subscriptions"] = json!(total_count);
    total["annual_profit_cents"] = json!(total["profit_cents"].as_i64().unwrap_or(0) * 12);
    let mut api = profit_line(api_revenue, api_cost, rates);
    api["requests"] = json!(api_requests);
    api["orgs"] = json!(api_orgs.len());
    let mut overage = profit_line(overage_revenue, overage_cost, rates);
    overage["requests"] = json!(overage_requests);
    json!({
        "tax": {
            "revenue_pct": rates.revenue * 100.0,
            "profit_pct": rates.profit * 100.0,
            "payment_fee_pct": (rates.payment_fee * 10_000.0).round() / 100.0,
        },
        "period_days": (period_days * 100.0).round() / 100.0,
        "subscriptions": { "rows": rows, "total": total },
        "api": api,
        "overage": overage,
    })
}

/// Live subscriptions by buyer kind (business / individual / unknown) with MRR, and by billing country.
fn customers_json(subs: &[SubscriptionSummary], profiles: &[crate::accounts::BillingProfile]) -> Value {
    let by_customer: HashMap<&str, &crate::accounts::BillingProfile> =
        profiles.iter().map(|profile| (profile.stripe_customer_id.as_str(), profile)).collect();
    let mut kinds: BTreeMap<String, (u64, i64)> = BTreeMap::new();
    let mut countries: BTreeMap<String, u64> = BTreeMap::new();
    let mut tax_ids: BTreeMap<String, u64> = BTreeMap::new();
    for sub in subs.iter().filter(|sub| LIVE.contains(&sub.status.as_str())) {
        let profile = sub.customer.as_deref().and_then(|id| by_customer.get(id));
        let kind = profile.map(|p| p.kind.clone()).unwrap_or_else(|| "unknown".to_string());
        let entry = kinds.entry(kind).or_default();
        entry.0 += 1;
        if PAYING.contains(&sub.status.as_str()) {
            entry.1 += monthly_cents(sub);
        }
        *countries.entry(profile.and_then(|p| p.country.clone()).unwrap_or_else(|| "unknown".to_string())).or_default() += 1;
        if let Some(kind) = profile.and_then(|p| p.tax_id_type.clone()) {
            *tax_ids.entry(kind).or_default() += 1;
        }
    }
    json!({
        "by_kind": kinds.iter().map(|(kind, (count, mrr))| json!({ "name": kind, "count": count, "mrr_cents": mrr })).collect::<Vec<Value>>(),
        "by_country": count_rows(countries),
        "by_tax_id": count_rows(tax_ids),
    })
}

/// Open windows closing within this horizon are flagged as "closing soon".
const CLOSING_SOON: i64 = 48;

/// A refund window with the plan and interval of the organization's current subscription.
pub(crate) struct WindowRow {
    pub(crate) window: RefundWindow,
    pub(crate) plan: String,
    pub(crate) interval: String,
}

/// Window length label from its bounds, rounded to whole days ("7d", "14d").
fn window_kind(window: &RefundWindow) -> String {
    let days = ((window.closes_at - window.opened_at).num_hours() as f64 / 24.0).round() as i64;
    format!("{days}d")
}

/// Per window-length counters.
#[derive(Default)]
struct WindowStats {
    open: u64,
    closing_soon: u64,
    opened: u64,
    refunded: u64,
}

/// Share with one decimal (0 when the base is empty).
fn rate(part: u64, base: u64) -> f64 {
    if base == 0 { 0.0 } else { (part as f64 * 1000.0 / base as f64).round() / 10.0 }
}

/// Sorted `{ name, count }` rows from a counter map.
fn count_rows(map: BTreeMap<String, u64>) -> Vec<Value> {
    let mut rows: Vec<(String, u64)> = map.into_iter().collect();
    rows.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    rows.into_iter().map(|(name, count)| json!({ "name": name, "count": count })).collect()
}

/// Refund window section: open now (by plan, by length, by length and plan, by country) and the period's refunds.
fn refund_json(rows: &[WindowRow], now: DateTime<Utc>, from: DateTime<Utc>, to: DateTime<Utc>) -> Value {
    let in_range = |at: DateTime<Utc>| at >= from && at < to;
    let mut kinds: BTreeMap<String, WindowStats> = BTreeMap::new();
    let (mut by_plan, mut by_kind_plan, mut by_country) = (BTreeMap::new(), BTreeMap::new(), BTreeMap::new());
    let (mut open, mut opened, mut refunded) = (0_u64, 0_u64, 0_u64);
    for row in rows {
        let kind = window_kind(&row.window);
        let plan = format!("{} / {}", row.plan, row.interval);
        let stats = kinds.entry(kind.clone()).or_default();
        if in_range(row.window.opened_at) {
            opened += 1;
            stats.opened += 1;
        }
        if row.window.refunded_at.is_some_and(in_range) {
            refunded += 1;
            stats.refunded += 1;
        }
        if row.window.is_open(now) {
            open += 1;
            stats.open += 1;
            if row.window.closes_at - now <= Duration::hours(CLOSING_SOON) {
                stats.closing_soon += 1;
            }
            *by_plan.entry(plan.clone()).or_insert(0_u64) += 1;
            *by_kind_plan.entry(format!("{kind} · {plan}")).or_insert(0_u64) += 1;
            *by_country.entry(row.window.country.clone()).or_insert(0_u64) += 1;
        }
    }
    json!({
        "open": open,
        "opened_in_range": opened,
        "refunded_in_range": refunded,
        "refund_rate": rate(refunded, opened),
        "by_kind": kinds.iter().map(|(kind, stats)| json!({
            "name": kind,
            "open": stats.open,
            "closing_soon": stats.closing_soon,
            "opened": stats.opened,
            "refunded": stats.refunded,
            "refund_rate": rate(stats.refunded, stats.opened),
        })).collect::<Vec<Value>>(),
        "by_plan": count_rows(by_plan),
        "by_kind_plan": count_rows(by_kind_plan),
        "by_country": count_rows(by_country),
    })
}

/// Joins refund windows with the org's plan (local) and interval (Stripe subscription).
async fn window_rows(state: &AppState, subs: &[SubscriptionSummary], since: DateTime<Utc>) -> Result<Vec<WindowRow>, String> {
    let windows = state.store.list_refund_windows_since(since).await.map_err(|error| error.to_string())?;
    let intervals: HashMap<&str, &str> = subs
        .iter()
        .map(|sub| (sub.id.as_str(), if sub.interval.as_deref() == Some("year") { "yearly" } else { "monthly" }))
        .collect();
    let mut rows = Vec::with_capacity(windows.len());
    for window in windows {
        let sub = state.store.get_subscription(window.org_id).await.ok().flatten();
        let plan = sub.as_ref().and_then(|row| row.plan).map(PlanTier::as_str).unwrap_or("none").to_string();
        let interval = sub
            .as_ref()
            .and_then(|row| row.stripe_subscription_id.as_deref())
            .and_then(|id| intervals.get(id).copied())
            .unwrap_or("unknown")
            .to_string();
        rows.push(WindowRow { window, plan, interval });
    }
    Ok(rows)
}

/// Builds the whole report from Stripe rows; pure so it is unit-testable.
fn report_json(config: &WebConfig, subs: &[SubscriptionSummary], sessions: &[CheckoutSummary], from: DateTime<Utc>, to: DateTime<Utc>) -> Value {
    let (from_ts, to_ts) = (from.timestamp(), to.timestamp());
    let in_range = |ts: i64| ts >= from_ts && ts < to_ts;
    let mut statuses: BTreeMap<String, u64> = BTreeMap::new();
    let mut plans: BTreeMap<String, PlanRow> = BTreeMap::new();
    let (mut live, mut monthly, mut yearly, mut scheduled, mut mrr) = (0_u64, 0_u64, 0_u64, 0_u64, 0_i64);
    let (mut new_in_range, mut canceled_in_range) = (0_u64, 0_u64);
    for sub in subs {
        *statuses.entry(sub.status.clone()).or_default() += 1;
        if in_range(sub.created) {
            new_in_range += 1;
        }
        if sub.canceled_at.is_some_and(in_range) {
            canceled_in_range += 1;
        }
        if !LIVE.contains(&sub.status.as_str()) {
            continue;
        }
        let (plan, interval) = plan_of(&config.stripe_prices, sub);
        let row = plans.entry(plan).or_default();
        live += 1;
        if interval == "yearly" {
            yearly += 1;
            row.yearly += 1;
        } else {
            monthly += 1;
            row.monthly += 1;
        }
        if sub.cancel_at_period_end {
            scheduled += 1;
            row.cancel_scheduled += 1;
        }
        if PAYING.contains(&sub.status.as_str()) {
            let cents = monthly_cents(sub);
            mrr += cents;
            row.mrr_cents += cents;
        }
    }
    let subscription_sessions: Vec<&CheckoutSummary> =
        sessions.iter().filter(|session| session.mode == "subscription" && in_range(session.created)).collect();
    json!({
        "from": from.to_rfc3339(),
        "to": to.to_rfc3339(),
        "live": live,
        "monthly": monthly,
        "yearly": yearly,
        "cancel_scheduled": scheduled,
        "mrr_cents": mrr,
        "arr_cents": mrr * 12,
        "new_in_range": new_in_range,
        "canceled_in_range": canceled_in_range,
        "statuses": statuses,
        "plans": plans.iter().map(|(plan, row)| json!({
            "plan": plan,
            "monthly": row.monthly,
            "yearly": row.yearly,
            "total": row.monthly + row.yearly,
            "cancel_scheduled": row.cancel_scheduled,
            "mrr_cents": row.mrr_cents,
        })).collect::<Vec<Value>>(),
        "checkout": {
            "totals": funnel_rows(&subscription_sessions, |_| Some("total".to_string())).into_iter().next(),
            "by_plan": funnel_rows(&subscription_sessions, |s| Some(format!(
                "{} / {}",
                s.plan.as_deref().unwrap_or("unknown"),
                s.interval.as_deref().unwrap_or("monthly"),
            ))),
            "by_landing": funnel_rows(&subscription_sessions, |s| s.lp.clone()),
            "by_offer": funnel_rows(&subscription_sessions, |s| Some(s.offer.clone().unwrap_or_else(|| "none".to_string()))),
        },
    })
}

/// GET /api/admin/subscriptions — live Stripe subscription mix and the checkout funnel of the period.
pub async fn subscriptions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
    Query(tax): Query<TaxQuery>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let (from, to) = match resolve_range(&query, Utc::now()) {
        Ok(range) => range,
        Err(response) => return response,
    };
    let (subs, sessions) = tokio::join!(state.stripe.list_subscriptions(), state.stripe.list_checkout_sessions(from.timestamp()));
    match (subs, sessions) {
        (Ok(subs), Ok(sessions)) => {
            let now = Utc::now();
            // Open windows opened at most ~2 weeks ago; 30 days of margin covers any window length.
            let since = from.min(now - Duration::days(30));
            let windows = match window_rows(&state, &subs, since).await {
                Ok(rows) => rows,
                Err(error) => {
                    tracing::error!(error = %error, "refund window report failed");
                    return err(StatusCode::INTERNAL_SERVER_ERROR, "refund window query failed");
                }
            };
            let usage = match state.store.usage_costs_between(from, to).await {
                Ok(rows) => rows,
                Err(error) => {
                    tracing::error!(error = ?error, "usage cost report failed");
                    return err(StatusCode::INTERNAL_SERVER_ERROR, "usage cost query failed");
                }
            };
            let plans = org_plans(&state, &subs, &usage).await;
            let measured_fee = match state.stripe.payment_fees(from.timestamp(), to.timestamp()).await {
                Ok(fees) => fees.rate(),
                Err(error) => {
                    tracing::warn!(error = %error, "stripe fee lookup failed; using the configured fee");
                    None
                }
            };
            let (rates, fee_source) = TaxRates::resolve(&state.config, &tax, measured_fee);
            let profiles = state.accounts.list_billing_profiles().await.unwrap_or_else(|error| {
                tracing::warn!(error = %error, "billing profile lookup failed");
                Vec::new()
            });
            let period_days = (to - from).num_seconds() as f64 / 86_400.0;
            let mut body = report_json(&state.config, &subs, &sessions, from, to);
            body["refund"] = refund_json(&windows, now, from, to);
            body["profit"] = profit_json(&state.config, &subs, &usage, &plans, period_days, rates);
            body["profit"]["tax"]["payment_fee_source"] = json!(fee_source);
            body["customers"] = customers_json(&subs, &profiles);
            Json(body).into_response()
        }
        (Err(error), _) | (_, Err(error)) => {
            tracing::error!(error = %error, "stripe admin report failed");
            err(StatusCode::BAD_GATEWAY, "could not reach the payment provider; try again")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    /// Builds a subscription row.
    fn sub(status: &str, price: &str, interval: &str, amount: i64, cancel: bool) -> SubscriptionSummary {
        SubscriptionSummary {
            id: format!("sub_{price}"),
            customer: None,
            status: status.into(),
            price_id: Some(price.into()),
            interval: Some(interval.into()),
            unit_amount: amount,
            quantity: 1,
            cancel_at_period_end: cancel,
            created: Utc::now().timestamp(),
            canceled_at: None,
        }
    }

    /// Plans come from configured prices, yearly MRR is spread, trials and canceled are excluded from MRR.
    #[test]
    fn report_counts_plans_intervals_and_mrr() {
        let config = WebConfig::test_config();
        let subs = vec![
            sub("active", "price_starter", "month", 2_000, false),
            sub("active", "price_starter_yearly", "year", 24_000, true),
            sub("trialing", "price_starter", "month", 2_000, false),
            sub("canceled", "price_starter", "month", 2_000, false),
            sub("active", "price_legacy", "month", 900, false),
        ];
        let now = Utc::now();
        let report = report_json(&config, &subs, &[], now - Duration::days(1), now + Duration::days(1));
        assert_eq!(report["live"], json!(4));
        assert_eq!(report["yearly"], json!(1));
        assert_eq!(report["cancel_scheduled"], json!(1));
        assert_eq!(report["mrr_cents"], json!(2_000 + 2_000 + 900));
        let starter = report["plans"].as_array().unwrap().iter().find(|row| row["plan"] == "starter").unwrap().clone();
        assert_eq!((starter["monthly"].clone(), starter["yearly"].clone()), (json!(2), json!(1)));
        assert!(report["plans"].as_array().unwrap().iter().any(|row| row["plan"] == "price_legacy"));
    }

    /// Open windows are split by plan / interval and by length; refunds in the period give the rate.
    #[test]
    fn refund_windows_by_plan_and_length() {
        let now = Utc::now();
        let window = |opened_days_ago: i64, length: i64, refunded: bool, country: &str| RefundWindow {
            org_id: uuid::Uuid::new_v4(),
            opened_at: now - Duration::days(opened_days_ago),
            closes_at: now - Duration::days(opened_days_ago) + Duration::days(length),
            country: country.into(),
            refunded_at: refunded.then_some(now - Duration::hours(1)),
        };
        let row = |window: RefundWindow, plan: &str, interval: &str| WindowRow { window, plan: plan.into(), interval: interval.into() };
        let rows = vec![
            row(window(1, 7, false, "BR"), "starter", "monthly"),
            row(window(6, 7, false, "BR"), "pro", "yearly"),
            row(window(2, 14, false, "PT"), "starter", "monthly"),
            row(window(3, 14, true, "DE"), "starter", "monthly"),
            row(window(20, 14, false, "PT"), "pro", "monthly"),
        ];
        let report = refund_json(&rows, now, now - Duration::days(7), now + Duration::days(1));
        assert_eq!(report["open"], json!(3));
        assert_eq!(report["by_plan"][0], json!({ "name": "starter / monthly", "count": 2 }));
        let seven = report["by_kind"].as_array().unwrap().iter().find(|k| k["name"] == "7d").unwrap().clone();
        assert_eq!((seven["open"].clone(), seven["closing_soon"].clone()), (json!(2), json!(1)));
        let fourteen = report["by_kind"].as_array().unwrap().iter().find(|k| k["name"] == "14d").unwrap().clone();
        assert_eq!((fourteen["opened"].clone(), fourteen["refunded"].clone(), fourteen["refund_rate"].clone()), (json!(2), json!(1), json!(50.0)));
        assert_eq!(report["refund_rate"], json!(25.0));
    }

    /// Profit = revenue - provider cost - 30% tax; subscription cost is scaled to 30 days,
    /// credits usage splits into pure API and overage.
    #[test]
    fn profit_by_plan_and_api() {
        let config = WebConfig::test_config();
        let org = uuid::Uuid::new_v4();
        let api_org = uuid::Uuid::new_v4();
        let subs = vec![sub("active", "price_starter", "month", 2_000, false), sub("active", "price_starter", "month", 2_000, false)];
        let usage = vec![
            UsageCostRow { org_id: org, surface: KeyPurpose::Code, charge_source: ChargeSource::IncludedPlan, requests: 10, revenue_micros: 0, cost_micros: 1_500_000 },
            UsageCostRow { org_id: api_org, surface: KeyPurpose::Api, charge_source: ChargeSource::PrepaidCredits, requests: 4, revenue_micros: 10_000_000, cost_micros: 2_000_000 },
            UsageCostRow { org_id: org, surface: KeyPurpose::Chat, charge_source: ChargeSource::PrepaidCredits, requests: 1, revenue_micros: 1_000_000, cost_micros: 100_000 },
        ];
        let plans = OrgPlans::from([(org, ("starter".to_string(), "monthly".to_string()))]);
        let report = profit_json(&config, &subs, &usage, &plans, 15.0, TaxRates { revenue: 0.30, profit: 0.0, payment_fee: 0.0 });
        let starter = report["subscriptions"]["rows"][0].clone();
        assert_eq!(starter["name"], json!("starter / monthly"));
        // Revenue 4000c, cost 150c over 15 days -> 300c per month, tax 1200c, profit 2500c.
        assert_eq!((starter["revenue_cents"].clone(), starter["cost_cents"].clone()), (json!(4_000), json!(300)));
        assert_eq!((starter["tax_cents"].clone(), starter["profit_cents"].clone()), (json!(1_200), json!(2_500)));
        assert_eq!(starter["profit_per_sub_cents"], json!(1_250));
        // API: 1000c revenue, 200c cost, 300c tax -> 500c profit.
        assert_eq!(report["api"]["profit_cents"], json!(500));
        assert_eq!(report["overage"]["revenue_cents"], json!(100));
    }

    /// Profit tax applies only to the positive remainder after revenue tax and provider cost.
    #[test]
    fn profit_tax_on_remainder() {
        let real = TaxRates { revenue: 0.12, profit: 0.34, payment_fee: 0.0 };
        let line = profit_line(10_000, 2_500, real);
        // 10000 - 2500 - 1200 = 6300; 34% of 6300 = 2142; profit 4158.
        assert_eq!((line["revenue_tax_cents"].clone(), line["profit_tax_cents"].clone()), (json!(1_200), json!(2_142)));
        assert_eq!(line["profit_cents"], json!(4_158));
        let loss = profit_line(1_000, 2_000, real);
        assert_eq!(loss["profit_tax_cents"], json!(0));
        let config = WebConfig::test_config();
        let (defaults, source) = TaxRates::resolve(&config, &TaxQuery::default(), None);
        assert_eq!((defaults, source), (TaxRates { revenue: 0.06, profit: 0.0, payment_fee: 0.05 }, "config"));
        let (measured, source) = TaxRates::resolve(&config, &TaxQuery::default(), Some(0.045));
        assert_eq!(source, "stripe");
        assert!((measured.payment_fee - 0.045).abs() < 1e-9);
        let (over, _) = TaxRates::resolve(&config, &TaxQuery { revenue_tax: Some(150.0), profit_tax: Some(34.0), payment_fee: Some(3.0) }, Some(0.045));
        assert_eq!(over, TaxRates { revenue: 1.0, profit: 0.34, payment_fee: 0.03 });
        // Fees come off before the profit tax base: 10000 - 2500 - 500 fee - 1200 = 5800.
        let with_fee = profit_line(10_000, 2_500, TaxRates { revenue: 0.12, profit: 0.0, payment_fee: 0.05 });
        assert_eq!((with_fee["fee_cents"].clone(), with_fee["profit_cents"].clone()), (json!(500), json!(5_800)));
    }

    /// The funnel converts completed over started sessions per plan and interval.
    #[test]
    fn checkout_funnel_conversion() {
        let config = WebConfig::test_config();
        let now = Utc::now();
        let session = |status: &str| CheckoutSummary {
            status: status.into(),
            mode: "subscription".into(),
            plan: Some("pro".into()),
            interval: Some("yearly".into()),
            offer: None,
            lp: None,
            created: now.timestamp(),
        };
        let sessions = vec![session("complete"), session("expired"), session("expired"), session("complete")];
        let report = report_json(&config, &[], &sessions, now - Duration::days(1), now + Duration::days(1));
        assert_eq!(report["checkout"]["by_plan"][0]["name"], json!("pro / yearly"));
        assert_eq!(report["checkout"]["by_plan"][0]["conversion"], json!(50.0));
    }
}
