/**
 * @fileoverview First-party marketing tracker: beacon collection and admin reports (pages, heatmaps, visitors).
 * @author Samuel S. L.
 * @version 1.3.0
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
 * - POST /api/t accepts tracker beacons (sendBeacon, no CSRF token possible); inputs are clamped, bots and
 *   non-public paths are dropped, and the endpoint is rate-limited per client IP
 * - Without consent the beacon is stored anonymously: visitor, session, and user ids are discarded
 * - Admin reports aggregate raw rows in Rust so Memory and Postgres share one implementation
 * - No IP address or user agent string is persisted
 * - Periods are whole days (YYYY-MM-DD) or exact RFC 3339 instants (the 24h preset)
 * - Reports accept segment filters (device, UTM source, UTM campaign, landing variant); the overview
 *   also returns the previous period of equal length for comparison
 * - Subscribe CTAs are tagged `subscribe:<plan>:<interval>[:intro]`; the overview ranks that intent
 */

use crate::admin::require_admin;
use crate::analytics_store::{ClickRecord, PageviewRecord, Utm, ATTENTION_BANDS};
use crate::auth::{request_user_agent, ClientIp};
use crate::routes::{err, require_user};
use crate::AppState;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use uuid::Uuid;

/// Largest beacon accepted (bytes).
const MAX_BEACON_BYTES: usize = 16 * 1024;
/// Click points accepted per beacon.
const MAX_CLICKS_PER_BEACON: usize = 50;
/// Upper bound for active time on one page view (6 hours).
const MAX_ACTIVE_MS: i64 = 6 * 60 * 60 * 1000;
/// Beacons per client IP per window.
const BEACON_LIMIT: u32 = 900;
const BEACON_WINDOW: std::time::Duration = std::time::Duration::from_secs(10 * 60);
/// Label prefix of tracked subscribe CTAs.
const SUBSCRIBE_PREFIX: &str = "subscribe:";
/// Rows loaded per report (keeps an admin query bounded).
const REPORT_ROW_CAP: i64 = 200_000;
/// Click points returned for one heatmap.
const HEATMAP_CLICK_CAP: i64 = 5_000;
/// A view shorter than this with no click counts as a bounce.
const BOUNCE_ACTIVE_MS: i64 = 10_000;

/// Campaign parameters as sent by the tracker.
#[derive(Debug, Default, Deserialize)]
pub struct UtmBody {
    source: Option<String>,
    medium: Option<String>,
    campaign: Option<String>,
    content: Option<String>,
    term: Option<String>,
}

/// One click as sent by the tracker (`x`, `y` in 0..1 of page width and document height).
#[derive(Debug, Deserialize)]
pub struct ClickBody {
    x: f32,
    y: f32,
    #[serde(default)]
    l: String,
}

/// Tracker beacon: the current cumulative state of one page view plus new clicks.
#[derive(Debug, Deserialize)]
pub struct BeaconBody {
    pv: Uuid,
    vid: Option<Uuid>,
    sid: Option<Uuid>,
    #[serde(default)]
    consent: bool,
    path: String,
    #[serde(rename = "ref")]
    referrer: Option<String>,
    #[serde(default)]
    utm: UtmBody,
    lp: Option<String>,
    device: Option<String>,
    lang: Option<String>,
    #[serde(default)]
    vw: i32,
    #[serde(default)]
    vh: i32,
    #[serde(default)]
    dh: i32,
    #[serde(default)]
    active_ms: i64,
    #[serde(default)]
    max_scroll: i16,
    #[serde(default)]
    attention: Vec<i64>,
    #[serde(default)]
    clicks: Vec<ClickBody>,
}

/// Trims, drops empties, and caps a free-text field at `max` characters.
fn clean(raw: Option<String>, max: usize) -> Option<String> {
    raw.map(|value| value.trim().chars().take(max).collect::<String>()).filter(|value| !value.is_empty())
}

/// Normalizes a tracked path: no query or fragment, bounded length, public pages only.
fn clean_path(raw: &str) -> Option<String> {
    let path: String = raw.split(['?', '#']).next().unwrap_or("").chars().take(200).collect();
    let public = path.starts_with('/')
        && !["/app", "/api", "/auth", "/cli"].iter().any(|prefix| path == *prefix || path.starts_with(&format!("{prefix}/")));
    public.then_some(path)
}

/// Keeps only scheme, host, and path of a referrer (query strings may carry personal data).
fn clean_referrer(raw: Option<String>) -> Option<String> {
    let raw = clean(raw, 500)?;
    let parsed = url::Url::parse(&raw).ok()?;
    let host = parsed.host_str()?;
    Some(format!("{}://{}{}", parsed.scheme(), host, parsed.path()).chars().take(300).collect())
}

/// Device class; anything unknown is treated as desktop.
fn clean_device(raw: Option<String>) -> String {
    match raw.as_deref() {
        Some("mobile") => "mobile".to_string(),
        Some("tablet") => "tablet".to_string(),
        _ => "desktop".to_string(),
    }
}

/// True for crawlers and headless browsers, whose views would skew marketing numbers.
fn is_bot(user_agent: Option<&str>) -> bool {
    let Some(agent) = user_agent else { return true };
    let agent = agent.to_ascii_lowercase();
    ["bot", "crawl", "spider", "slurp", "headless", "lighthouse", "preview"].iter().any(|marker| agent.contains(marker))
}

/// Builds the stored rows from a validated beacon; `user_id` is already consent-gated.
fn beacon_rows(body: BeaconBody, path: String, user_id: Option<Uuid>, now: DateTime<Utc>) -> (PageviewRecord, Vec<ClickRecord>) {
    let device = clean_device(body.device);
    let active_ms = body.active_ms.clamp(0, MAX_ACTIVE_MS);
    let mut attention: Vec<i64> = body.attention.into_iter().take(ATTENTION_BANDS).map(|ms| ms.clamp(0, MAX_ACTIVE_MS)).collect();
    attention.resize(ATTENTION_BANDS, 0);
    let clicks: Vec<ClickRecord> = body
        .clicks
        .into_iter()
        .take(MAX_CLICKS_PER_BEACON)
        .filter(|click| click.x.is_finite() && click.y.is_finite())
        .map(|click| ClickRecord {
            pageview_id: body.pv,
            path: path.clone(),
            device: device.clone(),
            x_pct: click.x.clamp(0.0, 1.0),
            y_pct: click.y.clamp(0.0, 1.0),
            label: click.l.trim().chars().take(80).collect(),
            at: now,
        })
        .collect();
    let consent = body.consent;
    let view = PageviewRecord {
        id: body.pv,
        visitor_id: body.vid.filter(|_| consent),
        session_id: body.sid.filter(|_| consent),
        user_id,
        path,
        referrer: clean_referrer(body.referrer),
        utm: Utm {
            source: clean(body.utm.source, 100),
            medium: clean(body.utm.medium, 100),
            campaign: clean(body.utm.campaign, 100),
            content: clean(body.utm.content, 100),
            term: clean(body.utm.term, 100),
        },
        lp: clean(body.lp, 60),
        device,
        lang: clean(body.lang, 16),
        viewport_w: body.vw.clamp(0, 10_000),
        viewport_h: body.vh.clamp(0, 10_000),
        doc_h: body.dh.clamp(0, 200_000),
        started_at: now,
        last_seen_at: now,
        active_ms,
        max_scroll: body.max_scroll.clamp(0, 100),
        attention,
        clicks: i32::try_from(clicks.len()).unwrap_or(0),
    };
    (view, clicks)
}

/// POST /api/t — tracker beacon. Always 204 for accepted or silently dropped beacons.
pub async fn collect(State(state): State<AppState>, ip: ClientIp, headers: HeaderMap, body: Bytes) -> Response {
    if body.len() > MAX_BEACON_BYTES {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
    if is_bot(request_user_agent(&headers)) || !state.limiter.check("analytics", ip.as_str(), BEACON_LIMIT, BEACON_WINDOW).await {
        return StatusCode::NO_CONTENT.into_response();
    }
    let Ok(beacon) = serde_json::from_slice::<BeaconBody>(&body) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let Some(path) = clean_path(&beacon.path) else {
        return StatusCode::NO_CONTENT.into_response();
    };
    let user_id = if beacon.consent { require_user(&state, &headers).await.ok().map(|user| user.id) } else { None };
    let (view, clicks) = beacon_rows(beacon, path, user_id, Utc::now());
    if let Err(error) = state.analytics.upsert_pageview(&view).await {
        tracing::warn!(error = %error, "analytics pageview write failed");
        return StatusCode::NO_CONTENT.into_response();
    }
    if let Err(error) = state.analytics.insert_clicks(&clicks).await {
        tracing::warn!(error = %error, "analytics click write failed");
    }
    StatusCode::NO_CONTENT.into_response()
}

/// Report period: `from`/`to` as `YYYY-MM-DD` (inclusive days, UTC); defaults to the last 7 days.
#[derive(Debug, Default, Deserialize)]
pub struct RangeQuery {
    from: Option<String>,
    to: Option<String>,
    path: Option<String>,
    device: Option<String>,
    /// Segment filters (exact match); empty means all.
    source: Option<String>,
    campaign: Option<String>,
    lp: Option<String>,
}

impl RangeQuery {
    /// Normalized value of an optional filter (trimmed, empty treated as absent).
    fn filter(raw: &Option<String>) -> Option<&str> {
        raw.as_deref().map(str::trim).filter(|value| !value.is_empty())
    }

    /// Device filter, only when it is a known device class.
    fn device(&self) -> Option<&str> {
        Self::filter(&self.device).filter(|device| ["mobile", "tablet", "desktop"].contains(device))
    }

    /// True when any segment filter besides the device is set (clicks then need a page-view join).
    fn has_segment(&self) -> bool {
        Self::filter(&self.source).is_some() || Self::filter(&self.campaign).is_some() || Self::filter(&self.lp).is_some()
    }

    /// True when a page view belongs to the selected segment.
    fn matches(&self, view: &PageviewRecord) -> bool {
        let eq = |filter: Option<&str>, value: Option<&str>| filter.is_none_or(|wanted| value == Some(wanted));
        eq(self.device(), Some(view.device.as_str()))
            && eq(Self::filter(&self.source), view.utm.source.as_deref())
            && eq(Self::filter(&self.campaign), view.utm.campaign.as_deref())
            && eq(Self::filter(&self.lp), view.lp.as_deref())
    }
}

/// Keeps the clicks whose page view is in the segment (all clicks when no segment filter is set).
fn segment_clicks(query: &RangeQuery, clicks: Vec<ClickRecord>, views: &[PageviewRecord]) -> Vec<ClickRecord> {
    if !query.has_segment() && query.device().is_none() {
        return clicks;
    }
    let ids: HashSet<Uuid> = views.iter().map(|view| view.id).collect();
    clicks.into_iter().filter(|click| ids.contains(&click.pageview_id)).collect()
}

/// Resolves the `[from, to)` instants of a report; `to` covers the whole last day.
pub(crate) fn resolve_range(query: &RangeQuery, now: DateTime<Utc>) -> Result<(DateTime<Utc>, DateTime<Utc>), Response> {
    let start = parse_bound(&query.from, false)?;
    let end = parse_bound(&query.to, true)?.unwrap_or_else(|| {
        (now.date_naive() + Duration::days(1)).and_hms_opt(0, 0, 0).map(|naive| naive.and_utc()).unwrap_or(now)
    });
    let start = start.unwrap_or(end - Duration::days(7));
    if start >= end || end - start > Duration::days(367) {
        return Err(err(StatusCode::BAD_REQUEST, "the range must be at most one year and from must be before to"));
    }
    Ok((start, end))
}

/// Parses one bound: `YYYY-MM-DD` (day start, or the next day's start for `to`) or an RFC 3339 instant.
fn parse_bound(raw: &Option<String>, end_of_day: bool) -> Result<Option<DateTime<Utc>>, Response> {
    let Some(value) = raw.as_deref().map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if let Ok(instant) = DateTime::parse_from_rfc3339(value) {
        return Ok(Some(instant.with_timezone(&Utc)));
    }
    let day = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| err(StatusCode::BAD_REQUEST, "dates must be YYYY-MM-DD or RFC 3339"))?;
    let day = if end_of_day { day + Duration::days(1) } else { day };
    day.and_hms_opt(0, 0, 0).map(|naive| Some(naive.and_utc())).ok_or_else(|| err(StatusCode::BAD_REQUEST, "invalid date"))
}

/// Running totals for one group of page views (a page, a source, a device...).
#[derive(Debug, Default)]
struct Tally {
    views: u64,
    visitors: HashSet<Uuid>,
    sessions: HashSet<Uuid>,
    active_ms: i64,
    scroll_sum: i64,
    reach: [u64; 4],
    bounces: u64,
    clicks: i64,
    clicked_views: u64,
}

impl Tally {
    /// Adds one page view.
    fn add(&mut self, view: &PageviewRecord) {
        self.views += 1;
        self.visitors.extend(view.visitor_id);
        self.sessions.extend(view.session_id);
        self.active_ms += view.active_ms;
        self.scroll_sum += i64::from(view.max_scroll);
        for (slot, threshold) in [25, 50, 75, 100].iter().enumerate() {
            if view.max_scroll >= *threshold {
                self.reach[slot] += 1;
            }
        }
        if view.active_ms < BOUNCE_ACTIVE_MS && view.clicks == 0 {
            self.bounces += 1;
        }
        self.clicks += i64::from(view.clicks);
        if view.clicks > 0 {
            self.clicked_views += 1;
        }
    }

    /// Share of views as a percentage with one decimal.
    fn pct(&self, count: u64) -> f64 {
        if self.views == 0 {
            0.0
        } else {
            (count as f64 * 1000.0 / self.views as f64).round() / 10.0
        }
    }

    /// JSON summary; `name` labels the group.
    fn to_json(&self, name: &str) -> Value {
        let views = self.views.max(1) as i64;
        json!({
            "name": name,
            "views": self.views,
            "visitors": self.visitors.len(),
            "sessions": self.sessions.len(),
            "avg_active_ms": self.active_ms / views,
            "avg_scroll": self.scroll_sum / views,
            "reach": self.reach.iter().map(|count| self.pct(*count)).collect::<Vec<f64>>(),
            "bounce_rate": self.pct(self.bounces),
            "clicks": self.clicks,
            "click_rate": self.pct(self.clicked_views),
        })
    }
}

/// Groups page views by `key` and returns the top `limit` groups by views.
fn top_groups(views: &[PageviewRecord], limit: usize, key: impl Fn(&PageviewRecord) -> Option<String>) -> Vec<Value> {
    let mut groups: HashMap<String, Tally> = HashMap::new();
    for view in views {
        if let Some(name) = key(view) {
            groups.entry(name).or_default().add(view);
        }
    }
    let mut rows: Vec<(String, Tally)> = groups.into_iter().collect();
    rows.sort_by(|a, b| b.1.views.cmp(&a.1.views).then_with(|| a.0.cmp(&b.0)));
    rows.into_iter().take(limit).map(|(name, tally)| tally.to_json(&name)).collect()
}

/// Referrer host, or "(direct)" when the visit had none.
fn referrer_host(view: &PageviewRecord) -> String {
    view.referrer
        .as_deref()
        .and_then(|raw| url::Url::parse(raw).ok())
        .and_then(|url| url.host_str().map(|host| host.trim_start_matches("www.").to_string()))
        .unwrap_or_else(|| "(direct)".to_string())
}

/// Builds the overview report from raw page views.
fn overview_json(views: &[PageviewRecord], from: DateTime<Utc>, to: DateTime<Utc>) -> Value {
    let mut total = Tally::default();
    let mut anonymous = 0_u64;
    let mut days: BTreeMap<NaiveDate, (u64, HashSet<Uuid>)> = BTreeMap::new();
    let mut day = from.date_naive();
    while day < to.date_naive() {
        days.insert(day, (0, HashSet::new()));
        day += Duration::days(1);
    }
    for view in views {
        total.add(view);
        if view.visitor_id.is_none() {
            anonymous += 1;
        }
        let entry = days.entry(view.started_at.date_naive()).or_default();
        entry.0 += 1;
        entry.1.extend(view.visitor_id);
    }
    json!({
        "from": from.to_rfc3339(),
        "to": to.to_rfc3339(),
        "truncated": views.len() as i64 >= REPORT_ROW_CAP,
        "totals": total.to_json("total"),
        "anonymous_views": anonymous,
        "series": days.iter().map(|(day, (views, visitors))| json!({
            "day": day.to_string(), "views": views, "visitors": visitors.len(),
        })).collect::<Vec<Value>>(),
        "pages": top_groups(views, 100, |view| Some(view.path.clone())),
        "landing_pages": top_groups(views, 50, |view| view.lp.clone()),
        "referrers": top_groups(views, 20, |view| Some(referrer_host(view))),
        "utm_sources": top_groups(views, 20, |view| view.utm.source.clone()),
        "utm_campaigns": top_groups(views, 20, |view| view.utm.campaign.clone()),
        "utm_contents": top_groups(views, 20, |view| view.utm.content.clone()),
        "devices": top_groups(views, 5, |view| Some(view.device.clone())),
        "languages": top_groups(views, 10, |view| view.lang.clone()),
    })
}

/// Builds the per-page report: scroll reach per 10 percent, attention bands, click points, top targets.
fn page_json(path: &str, views: &[PageviewRecord], clicks: &[ClickRecord]) -> Value {
    let page: Vec<&PageviewRecord> = views.iter().filter(|view| view.path == path).collect();
    let mut tally = Tally::default();
    let mut reach = [0_u64; 11];
    let mut attention = [0_i64; ATTENTION_BANDS];
    let mut doc_h_sum = 0_i64;
    let mut doc_h_count = 0_i64;
    for view in &page {
        tally.add(view);
        for (step, slot) in reach.iter_mut().enumerate() {
            if i64::from(view.max_scroll) >= step as i64 * 10 {
                *slot += 1;
            }
        }
        for (band, ms) in attention.iter_mut().zip(&view.attention) {
            *band += ms;
        }
        if view.doc_h > 0 {
            doc_h_sum += i64::from(view.doc_h);
            doc_h_count += 1;
        }
    }
    let mut targets: HashMap<&str, u64> = HashMap::new();
    for click in clicks {
        *targets.entry(click.label.as_str()).or_default() += 1;
    }
    let mut targets: Vec<(&str, u64)> = targets.into_iter().collect();
    targets.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(b.0)));
    json!({
        "path": path,
        "summary": tally.to_json(path),
        "avg_doc_h": doc_h_sum.checked_div(doc_h_count).unwrap_or(0),
        "reach": reach.iter().map(|count| tally.pct(*count)).collect::<Vec<f64>>(),
        "attention_ms": attention.to_vec(),
        "clicks": clicks.iter().map(|click| [click.x_pct, click.y_pct]).collect::<Vec<[f32; 2]>>(),
        "targets": targets.into_iter().take(25).map(|(label, count)| json!({ "label": label, "clicks": count })).collect::<Vec<Value>>(),
    })
}

/// Per-visitor rollup for the visitors list (consented visitors only).
#[derive(Default)]
struct VisitorRollup {
    first_seen: Option<DateTime<Utc>>,
    last_seen: Option<DateTime<Utc>>,
    first_source: Option<String>,
    views: u64,
    sessions: HashSet<Uuid>,
    pages: HashSet<String>,
    active_ms: i64,
    clicks: i64,
    user_id: Option<Uuid>,
}

/// Loads the rows of a report period, capped at `REPORT_ROW_CAP`.
async fn load_views(state: &AppState, from: DateTime<Utc>, to: DateTime<Utc>) -> Result<Vec<PageviewRecord>, Response> {
    state.analytics.pageviews_between(from, to, REPORT_ROW_CAP).await.map_err(|error| {
        tracing::error!(error = %error, "analytics report query failed");
        err(StatusCode::INTERNAL_SERVER_ERROR, "analytics query failed")
    })
}

/// GET /api/admin/analytics/overview — totals, daily series, pages, sources, campaigns, devices.
pub async fn overview(State(state): State<AppState>, headers: HeaderMap, Query(query): Query<RangeQuery>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let (from, to) = match resolve_range(&query, Utc::now()) {
        Ok(range) => range,
        Err(response) => return response,
    };
    let views: Vec<PageviewRecord> = match load_views(&state, from, to).await {
        Ok(views) => views.into_iter().filter(|view| query.matches(view)).collect(),
        Err(response) => return response,
    };
    let previous_from = from - (to - from);
    let previous: Vec<PageviewRecord> = match load_views(&state, previous_from, from).await {
        Ok(views) => views.into_iter().filter(|view| query.matches(view)).collect(),
        Err(response) => return response,
    };
    let intents = state.analytics.clicks_with_prefix(SUBSCRIBE_PREFIX, from, to, REPORT_ROW_CAP).await.unwrap_or_else(|error| {
        tracing::warn!(error = %error, "analytics intent query failed");
        Vec::new()
    });
    let mut body = overview_json(&views, from, to);
    body["subscribe_intent"] = intent_json(&segment_clicks(&query, intents, &views));
    let mut previous_totals = Tally::default();
    previous.iter().for_each(|view| previous_totals.add(view));
    body["previous"] = json!({
        "from": previous_from.to_rfc3339(),
        "totals": previous_totals.to_json("previous"),
        "anonymous_views": previous.iter().filter(|view| view.visitor_id.is_none()).count(),
    });
    Json(body).into_response()
}

/// Ranks subscribe-CTA clicks by plan and interval, and by the page they happened on.
fn intent_json(clicks: &[ClickRecord]) -> Value {
    let rank = |key: &dyn Fn(&ClickRecord) -> String| -> Vec<Value> {
        let mut counts: HashMap<String, u64> = HashMap::new();
        for click in clicks {
            *counts.entry(key(click)).or_default() += 1;
        }
        let mut rows: Vec<(String, u64)> = counts.into_iter().collect();
        rows.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
        rows.into_iter().map(|(name, clicks)| json!({ "name": name, "clicks": clicks })).collect()
    };
    json!({
        "total": clicks.len(),
        "by_plan": rank(&|click| click.label.trim_start_matches(SUBSCRIBE_PREFIX).replace(':', " / ")),
        "by_page": rank(&|click| click.path.clone()),
    })
}

/// GET /api/admin/analytics/page?path=… — heatmap data for one page.
pub async fn page(State(state): State<AppState>, headers: HeaderMap, Query(query): Query<RangeQuery>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let (from, to) = match resolve_range(&query, Utc::now()) {
        Ok(range) => range,
        Err(response) => return response,
    };
    let Some(path) = query.path.as_deref().and_then(clean_path) else {
        return err(StatusCode::BAD_REQUEST, "path must be a public page path");
    };
    let device = query.device();
    let views = match load_views(&state, from, to).await {
        Ok(views) => views.into_iter().filter(|view| query.matches(view)).collect::<Vec<_>>(),
        Err(response) => return response,
    };
    let clicks = match state.analytics.clicks_for_path(&path, from, to, device, HEATMAP_CLICK_CAP).await {
        Ok(clicks) => clicks,
        Err(error) => {
            tracing::error!(error = %error, "analytics click query failed");
            return err(StatusCode::INTERNAL_SERVER_ERROR, "analytics query failed");
        }
    };
    let clicks = segment_clicks(&query, clicks, &views);
    Json(page_json(&path, &views, &clicks)).into_response()
}

/// GET /api/admin/analytics/visitors — consented visitors active in the period, most recent first.
pub async fn visitors(State(state): State<AppState>, headers: HeaderMap, Query(query): Query<RangeQuery>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let (from, to) = match resolve_range(&query, Utc::now()) {
        Ok(range) => range,
        Err(response) => return response,
    };
    let views: Vec<PageviewRecord> = match load_views(&state, from, to).await {
        Ok(views) => views.into_iter().filter(|view| query.matches(view)).collect(),
        Err(response) => return response,
    };
    let mut rollups: HashMap<Uuid, VisitorRollup> = HashMap::new();
    // Rows arrive newest first; walking them in reverse makes the first source the earliest one.
    for view in views.iter().rev() {
        let Some(visitor) = view.visitor_id else { continue };
        let rollup = rollups.entry(visitor).or_default();
        rollup.first_seen.get_or_insert(view.started_at);
        rollup.last_seen = Some(view.last_seen_at.max(rollup.last_seen.unwrap_or(view.last_seen_at)));
        if rollup.first_source.is_none() {
            rollup.first_source = Some(view.utm.source.clone().unwrap_or_else(|| referrer_host(view)));
        }
        rollup.views += 1;
        rollup.sessions.extend(view.session_id);
        rollup.pages.insert(view.path.clone());
        rollup.active_ms += view.active_ms;
        rollup.clicks += i64::from(view.clicks);
        rollup.user_id = rollup.user_id.or(view.user_id);
    }
    let mut rows: Vec<(Uuid, VisitorRollup)> = rollups.into_iter().collect();
    rows.sort_by(|a, b| b.1.last_seen.cmp(&a.1.last_seen));
    rows.truncate(300);
    let mut payload = Vec::with_capacity(rows.len());
    for (visitor, rollup) in rows {
        payload.push(json!({
            "visitor_id": visitor,
            "first_seen": rollup.first_seen.map(|at| at.to_rfc3339()),
            "last_seen": rollup.last_seen.map(|at| at.to_rfc3339()),
            "first_source": rollup.first_source,
            "views": rollup.views,
            "sessions": rollup.sessions.len(),
            "pages": rollup.pages.len(),
            "active_ms": rollup.active_ms,
            "clicks": rollup.clicks,
            "email": user_email(&state, rollup.user_id).await,
        }));
    }
    Json(json!({ "visitors": payload })).into_response()
}

/// Email of a signed-in website user, when known.
async fn user_email(state: &AppState, user_id: Option<Uuid>) -> Option<String> {
    state.accounts.get_user_by_id(user_id?).await.ok().flatten().map(|user| user.email)
}

/// GET /api/admin/analytics/visitors/{id} — full journey of one consented visitor.
pub async fn visitor(State(state): State<AppState>, headers: HeaderMap, Path(visitor_id): Path<Uuid>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let views = match state.analytics.pageviews_for_visitor(visitor_id, 2_000).await {
        Ok(views) => views,
        Err(error) => {
            tracing::error!(error = %error, "analytics visitor query failed");
            return err(StatusCode::INTERNAL_SERVER_ERROR, "analytics query failed");
        }
    };
    let ids: Vec<Uuid> = views.iter().map(|view| view.id).collect();
    let clicks = state.analytics.clicks_for_pageviews(&ids).await.unwrap_or_default();
    let user_id = views.iter().find_map(|view| view.user_id);
    Json(json!({
        "visitor_id": visitor_id,
        "email": user_email(&state, user_id).await,
        "pageviews": views.iter().map(|view| json!({
            "id": view.id,
            "path": view.path,
            "started_at": view.started_at.to_rfc3339(),
            "last_seen_at": view.last_seen_at.to_rfc3339(),
            "active_ms": view.active_ms,
            "max_scroll": view.max_scroll,
            "clicks": view.clicks,
            "device": view.device,
            "session_id": view.session_id,
            "referrer": view.referrer,
            "utm_source": view.utm.source,
            "utm_campaign": view.utm.campaign,
            "lp": view.lp,
        })).collect::<Vec<Value>>(),
        "clicks": clicks.iter().map(|click| json!({
            "pageview_id": click.pageview_id,
            "path": click.path,
            "label": click.label,
            "at": click.at.to_rfc3339(),
        })).collect::<Vec<Value>>(),
    }))
    .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Public pages only; query strings are stripped.
    #[test]
    fn paths_are_public_and_clean() {
        assert_eq!(clean_path("/lp/code/a/br?utm_source=x"), Some("/lp/code/a/br".to_string()));
        assert_eq!(clean_path("/app/billing"), None);
        assert_eq!(clean_path("/api/t"), None);
        assert_eq!(clean_path("/applications"), Some("/applications".to_string()));
        assert_eq!(clean_path("https://evil.example/"), None);
    }

    /// Referrer query strings are dropped.
    #[test]
    fn referrer_keeps_host_and_path() {
        assert_eq!(
            clean_referrer(Some("https://www.google.com/search?q=secret".into())),
            Some("https://www.google.com/search".to_string())
        );
        assert_eq!(clean_referrer(Some("not a url".into())), None);
    }

    /// Without consent the persistent ids are discarded even when sent.
    #[test]
    fn anonymous_beacon_drops_ids() {
        let body: BeaconBody = serde_json::from_value(json!({
            "pv": Uuid::new_v4(), "vid": Uuid::new_v4(), "sid": Uuid::new_v4(), "consent": false,
            "path": "/lp", "active_ms": 99_999_999_999_i64, "max_scroll": 250, "attention": [1, 2],
            "clicks": [{"x": 2.0, "y": -1.0, "l": "cta"}],
        }))
        .unwrap();
        let (view, clicks) = beacon_rows(body, "/lp".into(), None, Utc::now());
        assert!(view.visitor_id.is_none() && view.session_id.is_none());
        assert_eq!(view.active_ms, MAX_ACTIVE_MS);
        assert_eq!(view.max_scroll, 100);
        assert_eq!(view.attention.len(), ATTENTION_BANDS);
        assert_eq!((clicks[0].x_pct, clicks[0].y_pct), (1.0, 0.0));
    }

    /// Segment filters match exact values; empty filters and unknown devices are ignored.
    #[test]
    fn segment_filters() {
        let view = |source: Option<&str>, device: &str| PageviewRecord {
            id: Uuid::new_v4(),
            visitor_id: None,
            session_id: None,
            user_id: None,
            path: "/lp".into(),
            referrer: None,
            utm: Utm { source: source.map(str::to_string), ..Utm::default() },
            lp: Some("code-1-br".into()),
            device: device.into(),
            lang: None,
            viewport_w: 0,
            viewport_h: 0,
            doc_h: 0,
            started_at: Utc::now(),
            last_seen_at: Utc::now(),
            active_ms: 0,
            max_scroll: 0,
            attention: vec![0; ATTENTION_BANDS],
            clicks: 0,
        };
        let query = RangeQuery { source: Some("meta".into()), device: Some("mobile".into()), lp: Some(" ".into()), ..Default::default() };
        assert!(query.matches(&view(Some("meta"), "mobile")));
        assert!(!query.matches(&view(Some("google"), "mobile")));
        assert!(!query.matches(&view(None, "mobile")));
        assert!(!query.matches(&view(Some("meta"), "desktop")));
        let bogus = RangeQuery { device: Some("fridge".into()), ..Default::default() };
        assert!(bogus.matches(&view(None, "desktop")));
    }

    /// Ranges default to the last 7 days and reject inverted or overlong periods.
    #[test]
    fn range_rules() {
        let now = Utc::now();
        let (from, to) = resolve_range(&RangeQuery::default(), now).unwrap();
        assert_eq!(to - from, Duration::days(7));
        let inverted = RangeQuery { from: Some("2026-09-10".into()), to: Some("2026-09-01".into()), ..Default::default() };
        assert!(resolve_range(&inverted, now).is_err());
        let day = RangeQuery {
            from: Some("2026-09-25T12:00:00Z".into()),
            to: Some("2026-09-26T12:00:00Z".into()),
            ..Default::default()
        };
        let (from, to) = resolve_range(&day, now).unwrap();
        assert_eq!(to - from, Duration::hours(24));
    }
}
