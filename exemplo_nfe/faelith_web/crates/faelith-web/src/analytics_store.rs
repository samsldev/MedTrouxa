/**
 * @fileoverview First-party marketing analytics storage: page views and click points (Memory and Postgres).
 * @author Samuel S. L.
 * @version 1.1.0
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
 * - Page views are upserted by repeated tracker beacons and merged monotonically (time, scroll, attention only grow)
 * - Identity columns (visitor, session) are written once by the first beacon and never overwritten
 * - Reads return raw rows; aggregation lives in `analytics.rs` so both backends share one implementation
 * - Memory backend mirrors Postgres semantics for Axum tests
 * - Primary docs: https://docs.rs/sqlx/latest/sqlx/
 */

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

/// Number of vertical bands (5 percent of the page height each) in the attention map.
pub const ATTENTION_BANDS: usize = 20;

/// Campaign parameters captured from the landing URL.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Utm {
    pub source: Option<String>,
    pub medium: Option<String>,
    pub campaign: Option<String>,
    pub content: Option<String>,
    pub term: Option<String>,
}

/// One page view as stored; `clicks` is the running click count.
#[derive(Debug, Clone, PartialEq)]
pub struct PageviewRecord {
    pub id: Uuid,
    /// Persistent visitor id; `None` without analytics consent.
    pub visitor_id: Option<Uuid>,
    /// Browser session id; `None` without analytics consent.
    pub session_id: Option<Uuid>,
    /// Signed-in website user (consented visitors only).
    pub user_id: Option<Uuid>,
    pub path: String,
    pub referrer: Option<String>,
    pub utm: Utm,
    pub lp: Option<String>,
    pub device: String,
    pub lang: Option<String>,
    pub viewport_w: i32,
    pub viewport_h: i32,
    pub doc_h: i32,
    pub started_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub active_ms: i64,
    pub max_scroll: i16,
    /// Cumulative visible milliseconds per band; always `ATTENTION_BANDS` long.
    pub attention: Vec<i64>,
    pub clicks: i32,
}

impl PageviewRecord {
    /// Merges a newer beacon into the stored row: identity stays, metrics only grow,
    /// and `incoming.clicks` is the number of new clicks in that beacon.
    fn merge(&mut self, incoming: &PageviewRecord) {
        self.user_id = self.user_id.or(incoming.user_id);
        self.last_seen_at = self.last_seen_at.max(incoming.last_seen_at);
        self.doc_h = self.doc_h.max(incoming.doc_h);
        self.max_scroll = self.max_scroll.max(incoming.max_scroll);
        if incoming.active_ms >= self.active_ms {
            self.active_ms = incoming.active_ms;
            self.attention = incoming.attention.clone();
        }
        self.clicks = self.clicks.saturating_add(incoming.clicks);
    }
}

/// One click point in page-relative coordinates (0..1 of width and of document height).
#[derive(Debug, Clone, PartialEq)]
pub struct ClickRecord {
    pub pageview_id: Uuid,
    pub path: String,
    pub device: String,
    pub x_pct: f32,
    pub y_pct: f32,
    /// Short description of the clicked element (tag, text, or href).
    pub label: String,
    pub at: DateTime<Utc>,
}

/// Storage for the marketing tracker.
#[async_trait]
pub trait AnalyticsStore: Send + Sync {
    /// Inserts a page view or merges a newer beacon into it (see `PageviewRecord::merge`).
    async fn upsert_pageview(&self, view: &PageviewRecord) -> Result<(), String>;
    /// Appends click points.
    async fn insert_clicks(&self, clicks: &[ClickRecord]) -> Result<(), String>;
    /// Page views started in `[from, to)`, newest first, at most `limit`.
    async fn pageviews_between(&self, from: DateTime<Utc>, to: DateTime<Utc>, limit: i64) -> Result<Vec<PageviewRecord>, String>;
    /// Click points of one path in `[from, to)`, optionally for one device class, newest first.
    async fn clicks_for_path(
        &self,
        path: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
        device: Option<&str>,
        limit: i64,
    ) -> Result<Vec<ClickRecord>, String>;
    /// Every page view of one consented visitor, newest first.
    async fn pageviews_for_visitor(&self, visitor_id: Uuid, limit: i64) -> Result<Vec<PageviewRecord>, String>;
    /// Click points of the given page views, oldest first.
    async fn clicks_for_pageviews(&self, ids: &[Uuid]) -> Result<Vec<ClickRecord>, String>;
    /// Click points in `[from, to)` whose label starts with `prefix` (tracked CTAs), newest first.
    async fn clicks_with_prefix(&self, prefix: &str, from: DateTime<Utc>, to: DateTime<Utc>, limit: i64) -> Result<Vec<ClickRecord>, String>;
}

/// Process-local analytics store for tests and development.
#[derive(Default)]
pub struct MemoryAnalytics {
    inner: Mutex<(HashMap<Uuid, PageviewRecord>, Vec<ClickRecord>)>,
}

impl MemoryAnalytics {
    /// Creates an empty store.
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl AnalyticsStore for MemoryAnalytics {
    async fn upsert_pageview(&self, view: &PageviewRecord) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        match inner.0.get_mut(&view.id) {
            Some(existing) => existing.merge(view),
            None => {
                inner.0.insert(view.id, view.clone());
            }
        }
        Ok(())
    }

    async fn insert_clicks(&self, clicks: &[ClickRecord]) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        inner.1.extend_from_slice(clicks);
        Ok(())
    }

    async fn pageviews_between(&self, from: DateTime<Utc>, to: DateTime<Utc>, limit: i64) -> Result<Vec<PageviewRecord>, String> {
        let inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        let mut rows: Vec<PageviewRecord> =
            inner.0.values().filter(|view| view.started_at >= from && view.started_at < to).cloned().collect();
        rows.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        rows.truncate(usize::try_from(limit).unwrap_or(0));
        Ok(rows)
    }

    async fn clicks_for_path(
        &self,
        path: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
        device: Option<&str>,
        limit: i64,
    ) -> Result<Vec<ClickRecord>, String> {
        let inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        let mut rows: Vec<ClickRecord> = inner
            .1
            .iter()
            .filter(|click| click.path == path && click.at >= from && click.at < to)
            .filter(|click| device.is_none_or(|device| click.device == device))
            .cloned()
            .collect();
        rows.sort_by(|a, b| b.at.cmp(&a.at));
        rows.truncate(usize::try_from(limit).unwrap_or(0));
        Ok(rows)
    }

    async fn pageviews_for_visitor(&self, visitor_id: Uuid, limit: i64) -> Result<Vec<PageviewRecord>, String> {
        let inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        let mut rows: Vec<PageviewRecord> =
            inner.0.values().filter(|view| view.visitor_id == Some(visitor_id)).cloned().collect();
        rows.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        rows.truncate(usize::try_from(limit).unwrap_or(0));
        Ok(rows)
    }

    async fn clicks_for_pageviews(&self, ids: &[Uuid]) -> Result<Vec<ClickRecord>, String> {
        let inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        let mut rows: Vec<ClickRecord> = inner.1.iter().filter(|click| ids.contains(&click.pageview_id)).cloned().collect();
        rows.sort_by(|a, b| a.at.cmp(&b.at));
        Ok(rows)
    }

    async fn clicks_with_prefix(&self, prefix: &str, from: DateTime<Utc>, to: DateTime<Utc>, limit: i64) -> Result<Vec<ClickRecord>, String> {
        let inner = self.inner.lock().map_err(|_| "analytics lock poisoned".to_string())?;
        let mut rows: Vec<ClickRecord> = inner
            .1
            .iter()
            .filter(|click| click.label.starts_with(prefix) && click.at >= from && click.at < to)
            .cloned()
            .collect();
        rows.sort_by(|a, b| b.at.cmp(&a.at));
        rows.truncate(usize::try_from(limit).unwrap_or(0));
        Ok(rows)
    }
}

/// Postgres analytics store sharing the primary pool (migration 032_analytics.sql).
pub struct PostgresAnalytics {
    pool: PgPool,
}

impl PostgresAnalytics {
    /// Wraps the primary pool (migrations already ran in PostgresStore::connect).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Columns read by every page-view query, in `map_pageview` order.
const PAGEVIEW_COLUMNS: &str = "id, visitor_id, session_id, user_id, path, referrer, utm_source, utm_medium, \
     utm_campaign, utm_content, utm_term, lp, device, lang, viewport_w, viewport_h, doc_h, started_at, \
     last_seen_at, active_ms, max_scroll, attention, clicks";

/// Maps an `analytics_pageviews` row onto the domain record.
fn map_pageview(row: &sqlx::postgres::PgRow) -> PageviewRecord {
    PageviewRecord {
        id: row.get("id"),
        visitor_id: row.get("visitor_id"),
        session_id: row.get("session_id"),
        user_id: row.get("user_id"),
        path: row.get("path"),
        referrer: row.get("referrer"),
        utm: Utm {
            source: row.get("utm_source"),
            medium: row.get("utm_medium"),
            campaign: row.get("utm_campaign"),
            content: row.get("utm_content"),
            term: row.get("utm_term"),
        },
        lp: row.get("lp"),
        device: row.get("device"),
        lang: row.get("lang"),
        viewport_w: row.get("viewport_w"),
        viewport_h: row.get("viewport_h"),
        doc_h: row.get("doc_h"),
        started_at: row.get("started_at"),
        last_seen_at: row.get("last_seen_at"),
        active_ms: row.get("active_ms"),
        max_scroll: row.get("max_scroll"),
        attention: row.get("attention"),
        clicks: row.get("clicks"),
    }
}

/// Maps an `analytics_clicks` row onto the domain record.
fn map_click(row: &sqlx::postgres::PgRow) -> ClickRecord {
    ClickRecord {
        pageview_id: row.get("pageview_id"),
        path: row.get("path"),
        device: row.get("device"),
        x_pct: row.get("x_pct"),
        y_pct: row.get("y_pct"),
        label: row.get("label"),
        at: row.get("at"),
    }
}

#[async_trait]
impl AnalyticsStore for PostgresAnalytics {
    /// Single statement: insert, or merge with the same rules as `PageviewRecord::merge`.
    async fn upsert_pageview(&self, view: &PageviewRecord) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO analytics_pageviews (id, visitor_id, session_id, user_id, path, referrer, utm_source,
                 utm_medium, utm_campaign, utm_content, utm_term, lp, device, lang, viewport_w, viewport_h, doc_h,
                 started_at, last_seen_at, active_ms, max_scroll, attention, clicks)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
             ON CONFLICT (id) DO UPDATE SET
                 user_id = COALESCE(analytics_pageviews.user_id, EXCLUDED.user_id),
                 last_seen_at = GREATEST(analytics_pageviews.last_seen_at, EXCLUDED.last_seen_at),
                 doc_h = GREATEST(analytics_pageviews.doc_h, EXCLUDED.doc_h),
                 max_scroll = GREATEST(analytics_pageviews.max_scroll, EXCLUDED.max_scroll),
                 attention = CASE WHEN EXCLUDED.active_ms >= analytics_pageviews.active_ms
                                  THEN EXCLUDED.attention ELSE analytics_pageviews.attention END,
                 active_ms = GREATEST(analytics_pageviews.active_ms, EXCLUDED.active_ms),
                 clicks = analytics_pageviews.clicks + EXCLUDED.clicks",
        )
        .bind(view.id)
        .bind(view.visitor_id)
        .bind(view.session_id)
        .bind(view.user_id)
        .bind(&view.path)
        .bind(view.referrer.as_deref())
        .bind(view.utm.source.as_deref())
        .bind(view.utm.medium.as_deref())
        .bind(view.utm.campaign.as_deref())
        .bind(view.utm.content.as_deref())
        .bind(view.utm.term.as_deref())
        .bind(view.lp.as_deref())
        .bind(&view.device)
        .bind(view.lang.as_deref())
        .bind(view.viewport_w)
        .bind(view.viewport_h)
        .bind(view.doc_h)
        .bind(view.started_at)
        .bind(view.last_seen_at)
        .bind(view.active_ms)
        .bind(view.max_scroll)
        .bind(&view.attention)
        .bind(view.clicks)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    /// One multi-row INSERT via UNNEST so a beacon costs a single round trip.
    async fn insert_clicks(&self, clicks: &[ClickRecord]) -> Result<(), String> {
        if clicks.is_empty() {
            return Ok(());
        }
        let ids: Vec<Uuid> = clicks.iter().map(|c| c.pageview_id).collect();
        let paths: Vec<String> = clicks.iter().map(|c| c.path.clone()).collect();
        let devices: Vec<String> = clicks.iter().map(|c| c.device.clone()).collect();
        let xs: Vec<f32> = clicks.iter().map(|c| c.x_pct).collect();
        let ys: Vec<f32> = clicks.iter().map(|c| c.y_pct).collect();
        let labels: Vec<String> = clicks.iter().map(|c| c.label.clone()).collect();
        let ats: Vec<DateTime<Utc>> = clicks.iter().map(|c| c.at).collect();
        sqlx::query(
            "INSERT INTO analytics_clicks (pageview_id, path, device, x_pct, y_pct, label, at)
             SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::real[], $5::real[], $6::text[], $7::timestamptz[])",
        )
        .bind(&ids)
        .bind(&paths)
        .bind(&devices)
        .bind(&xs)
        .bind(&ys)
        .bind(&labels)
        .bind(&ats)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn pageviews_between(&self, from: DateTime<Utc>, to: DateTime<Utc>, limit: i64) -> Result<Vec<PageviewRecord>, String> {
        let rows = sqlx::query(&format!(
            "SELECT {PAGEVIEW_COLUMNS} FROM analytics_pageviews
             WHERE started_at >= $1 AND started_at < $2 ORDER BY started_at DESC LIMIT $3"
        ))
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_pageview).collect())
    }

    async fn clicks_for_path(
        &self,
        path: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
        device: Option<&str>,
        limit: i64,
    ) -> Result<Vec<ClickRecord>, String> {
        let rows = sqlx::query(
            "SELECT pageview_id, path, device, x_pct, y_pct, label, at FROM analytics_clicks
             WHERE path = $1 AND at >= $2 AND at < $3 AND ($4::text IS NULL OR device = $4)
             ORDER BY at DESC LIMIT $5",
        )
        .bind(path)
        .bind(from)
        .bind(to)
        .bind(device)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_click).collect())
    }

    async fn pageviews_for_visitor(&self, visitor_id: Uuid, limit: i64) -> Result<Vec<PageviewRecord>, String> {
        let rows = sqlx::query(&format!(
            "SELECT {PAGEVIEW_COLUMNS} FROM analytics_pageviews
             WHERE visitor_id = $1 ORDER BY started_at DESC LIMIT $2"
        ))
        .bind(visitor_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_pageview).collect())
    }

    async fn clicks_for_pageviews(&self, ids: &[Uuid]) -> Result<Vec<ClickRecord>, String> {
        let rows = sqlx::query(
            "SELECT pageview_id, path, device, x_pct, y_pct, label, at FROM analytics_clicks
             WHERE pageview_id = ANY($1) ORDER BY at",
        )
        .bind(ids)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_click).collect())
    }

    /// `starts_with` avoids LIKE wildcards in the prefix being interpreted.
    async fn clicks_with_prefix(&self, prefix: &str, from: DateTime<Utc>, to: DateTime<Utc>, limit: i64) -> Result<Vec<ClickRecord>, String> {
        let rows = sqlx::query(
            "SELECT pageview_id, path, device, x_pct, y_pct, label, at FROM analytics_clicks
             WHERE starts_with(label, $1) AND at >= $2 AND at < $3 ORDER BY at DESC LIMIT $4",
        )
        .bind(prefix)
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_click).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a page view with the given metrics.
    fn view(active_ms: i64, max_scroll: i16, clicks: i32) -> PageviewRecord {
        let now = Utc::now();
        PageviewRecord {
            id: Uuid::nil(),
            visitor_id: None,
            session_id: None,
            user_id: None,
            path: "/lp".into(),
            referrer: None,
            utm: Utm::default(),
            lp: None,
            device: "desktop".into(),
            lang: None,
            viewport_w: 1280,
            viewport_h: 800,
            doc_h: 3000,
            started_at: now,
            last_seen_at: now,
            active_ms,
            max_scroll,
            attention: vec![active_ms; ATTENTION_BANDS],
            clicks,
        }
    }

    /// A late, stale beacon never lowers time, scroll, or attention; clicks accumulate.
    #[tokio::test]
    async fn merge_is_monotonic() {
        let store = MemoryAnalytics::new();
        store.upsert_pageview(&view(5_000, 60, 2)).await.unwrap();
        store.upsert_pageview(&view(3_000, 40, 1)).await.unwrap();
        let rows = store.pageviews_between(Utc::now() - chrono::Duration::hours(1), Utc::now() + chrono::Duration::hours(1), 10).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].active_ms, 5_000);
        assert_eq!(rows[0].max_scroll, 60);
        assert_eq!(rows[0].attention[0], 5_000);
        assert_eq!(rows[0].clicks, 3);
    }
}
