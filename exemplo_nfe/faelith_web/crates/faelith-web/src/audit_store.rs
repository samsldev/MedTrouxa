/**
 * @fileoverview Append-only audit log of website admin actions (Memory and Postgres).
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Every admin mutation records who did what to which organization and with which input
 * - Entries never carry secrets (API key plaintext is excluded by the callers)
 * - Rows are never updated or deleted by the application (migration 031_admin_audit.sql)
 */

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::sync::Mutex;
use uuid::Uuid;

/// One admin action.
#[derive(Debug, Clone, PartialEq)]
pub struct AuditEntry {
    pub admin_email: String,
    /// Stable action name, for example `keys.create` or `subscription.set`.
    pub action: String,
    pub target_org: Option<Uuid>,
    pub detail: Value,
    pub at: DateTime<Utc>,
}

/// Storage for the admin audit log.
#[async_trait]
pub trait AuditStore: Send + Sync {
    /// Appends one entry.
    async fn record(&self, entry: &AuditEntry) -> Result<(), String>;
    /// Newest entries first, at most `limit`.
    async fn list(&self, limit: i64) -> Result<Vec<AuditEntry>, String>;
}

/// Process-local audit log for tests and development.
#[derive(Default)]
pub struct MemoryAudit {
    entries: Mutex<Vec<AuditEntry>>,
}

impl MemoryAudit {
    /// Creates an empty log.
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl AuditStore for MemoryAudit {
    async fn record(&self, entry: &AuditEntry) -> Result<(), String> {
        self.entries.lock().map_err(|_| "audit lock poisoned".to_string())?.push(entry.clone());
        Ok(())
    }

    async fn list(&self, limit: i64) -> Result<Vec<AuditEntry>, String> {
        let entries = self.entries.lock().map_err(|_| "audit lock poisoned".to_string())?;
        Ok(entries.iter().rev().take(usize::try_from(limit).unwrap_or(0)).cloned().collect())
    }
}

/// Postgres audit log sharing the primary pool.
pub struct PostgresAudit {
    pool: PgPool,
}

impl PostgresAudit {
    /// Wraps the primary pool (migrations already ran in PostgresStore::connect).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AuditStore for PostgresAudit {
    async fn record(&self, entry: &AuditEntry) -> Result<(), String> {
        sqlx::query("INSERT INTO admin_audit (admin_email, action, target_org, detail, at) VALUES ($1, $2, $3, $4, $5)")
            .bind(&entry.admin_email)
            .bind(&entry.action)
            .bind(entry.target_org)
            .bind(&entry.detail)
            .bind(entry.at)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn list(&self, limit: i64) -> Result<Vec<AuditEntry>, String> {
        let rows = sqlx::query("SELECT admin_email, action, target_org, detail, at FROM admin_audit ORDER BY at DESC, id DESC LIMIT $1")
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows
            .iter()
            .map(|row| AuditEntry {
                admin_email: row.get("admin_email"),
                action: row.get("action"),
                target_org: row.get("target_org"),
                detail: row.get("detail"),
                at: row.get("at"),
            })
            .collect())
    }
}
