/**
 * @fileoverview Persistence of NFS-e documents, DPS numbering, and buyers' fiscal identities (Memory and Postgres).
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
 * - One document per paid Stripe invoice (unique invoice id), so webhook redelivery never duplicates a note
 * - DPS numbers come from an atomic per-series counter and are assigned once, at the first submission
 * - Due work is claimed with a lease (next_attempt_at pushed forward, SKIP LOCKED in Postgres)
 * - Issued XML is kept indefinitely (legal retention of at least 5 years); rows are never deleted
 * - Fiscal identities hold the CPF / CNPJ / foreign tax id needed to issue notes for a Stripe customer
 */

use async_trait::async_trait;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

/// Lifecycle states of a document.
pub mod status {
    /// Waiting to be issued (or retried).
    pub const QUEUED: &str = "queued";
    /// Missing buyer data (CPF / CNPJ); resumes when the customer completes it.
    pub const PENDING_DATA: &str = "pending_data";
    pub const ISSUED: &str = "issued";
    /// Rejected by the national system; needs an admin decision.
    pub const REJECTED: &str = "rejected";
    pub const CANCEL_QUEUED: &str = "cancel_queued";
    pub const CANCELED: &str = "canceled";
    pub const CANCEL_FAILED: &str = "cancel_failed";
    /// Refunded before it was issued: no note will be issued.
    pub const VOIDED: &str = "voided";
    /// Partial refund of an issued note: needs a manual substitution.
    pub const NEEDS_REVIEW: &str = "needs_review";
}

/// One NFS-e (or the attempt to issue one) for a paid Stripe invoice.
#[derive(Debug, Clone, PartialEq)]
pub struct NfseDocument {
    pub id: Uuid,
    pub stripe_invoice_id: String,
    pub payment_intent: Option<String>,
    pub org_id: Option<Uuid>,
    pub stripe_customer_id: Option<String>,
    pub status: String,
    pub attempts: i32,
    pub next_attempt_at: DateTime<Utc>,
    pub last_error: Option<String>,
    pub series: i32,
    pub number: Option<i64>,
    pub dps_id: Option<String>,
    pub access_key: Option<String>,
    pub nfse_number: Option<String>,
    pub amount_usd_cents: i64,
    pub amount_brl_cents: Option<i64>,
    pub ptax_rate: Option<f64>,
    pub ptax_date: Option<NaiveDate>,
    pub paid_at: DateTime<Utc>,
    /// Buyer snapshot from the invoice: name, email, country, address, tax ids.
    pub buyer: Value,
    pub description: String,
    pub dps_xml: Option<String>,
    pub nfse_xml: Option<String>,
    pub cancel_reason: Option<String>,
    pub cancel_xml: Option<String>,
    pub created_at: DateTime<Utc>,
    pub issued_at: Option<DateTime<Utc>>,
    pub canceled_at: Option<DateTime<Utc>>,
}

/// Fiscal identification of a Stripe customer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FiscalIdentity {
    pub stripe_customer_id: String,
    pub org_id: Option<Uuid>,
    /// `cpf`, `cnpj`, or `nif`.
    pub doc_type: String,
    pub doc_number: String,
    pub updated_at: DateTime<Utc>,
}

/// Lease given to a claimed document before it becomes claimable again.
pub const CLAIM_LEASE_MINUTES: i64 = 10;

/// Storage for the NFS-e module.
#[async_trait]
pub trait NfseStore: Send + Sync {
    /// Inserts a new document; false when the invoice already has one.
    async fn enqueue(&self, doc: &NfseDocument) -> Result<bool, String>;
    /// Claims up to `limit` due documents (queued or cancel_queued), leasing them.
    async fn claim_due(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<NfseDocument>, String>;
    /// Replaces a document.
    async fn save(&self, doc: &NfseDocument) -> Result<(), String>;
    async fn get(&self, id: Uuid) -> Result<Option<NfseDocument>, String>;
    async fn find_by_payment_intent(&self, payment_intent: &str) -> Result<Option<NfseDocument>, String>;
    /// Newest first; optional status and organization filters.
    async fn list(&self, status: Option<&str>, org_id: Option<Uuid>, limit: i64) -> Result<Vec<NfseDocument>, String>;
    /// Documents of a customer waiting for fiscal data.
    async fn pending_data_for_customer(&self, customer: &str) -> Result<Vec<NfseDocument>, String>;
    /// Next DPS number of a series (1, 2, 3...), atomically.
    async fn allocate_number(&self, series: i32) -> Result<i64, String>;
    async fn upsert_identity(&self, identity: &FiscalIdentity) -> Result<(), String>;
    async fn get_identity(&self, customer: &str) -> Result<Option<FiscalIdentity>, String>;
}

/// Process-local store for tests and development.
#[derive(Default)]
pub struct MemoryNfse {
    inner: Mutex<MemoryInner>,
}

#[derive(Default)]
struct MemoryInner {
    docs: HashMap<Uuid, NfseDocument>,
    series: HashMap<i32, i64>,
    identities: HashMap<String, FiscalIdentity>,
}

impl MemoryNfse {
    /// Creates an empty store.
    pub fn new() -> Self {
        Self::default()
    }
}

/// Lock helper with a uniform error.
fn lock(inner: &Mutex<MemoryInner>) -> Result<std::sync::MutexGuard<'_, MemoryInner>, String> {
    inner.lock().map_err(|_| "nfse lock poisoned".to_string())
}

#[async_trait]
impl NfseStore for MemoryNfse {
    async fn enqueue(&self, doc: &NfseDocument) -> Result<bool, String> {
        let mut inner = lock(&self.inner)?;
        if inner.docs.values().any(|d| d.stripe_invoice_id == doc.stripe_invoice_id) {
            return Ok(false);
        }
        inner.docs.insert(doc.id, doc.clone());
        Ok(true)
    }

    async fn claim_due(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<NfseDocument>, String> {
        let mut inner = lock(&self.inner)?;
        let mut due: Vec<Uuid> = inner
            .docs
            .values()
            .filter(|d| (d.status == status::QUEUED || d.status == status::CANCEL_QUEUED) && d.next_attempt_at <= now)
            .map(|d| d.id)
            .collect();
        due.truncate(usize::try_from(limit).unwrap_or(0));
        let mut claimed = Vec::with_capacity(due.len());
        for id in due {
            if let Some(doc) = inner.docs.get_mut(&id) {
                doc.next_attempt_at = now + Duration::minutes(CLAIM_LEASE_MINUTES);
                claimed.push(doc.clone());
            }
        }
        Ok(claimed)
    }

    async fn save(&self, doc: &NfseDocument) -> Result<(), String> {
        lock(&self.inner)?.docs.insert(doc.id, doc.clone());
        Ok(())
    }

    async fn get(&self, id: Uuid) -> Result<Option<NfseDocument>, String> {
        Ok(lock(&self.inner)?.docs.get(&id).cloned())
    }

    async fn find_by_payment_intent(&self, payment_intent: &str) -> Result<Option<NfseDocument>, String> {
        Ok(lock(&self.inner)?.docs.values().find(|d| d.payment_intent.as_deref() == Some(payment_intent)).cloned())
    }

    async fn list(&self, status: Option<&str>, org_id: Option<Uuid>, limit: i64) -> Result<Vec<NfseDocument>, String> {
        let inner = lock(&self.inner)?;
        let mut rows: Vec<NfseDocument> = inner
            .docs
            .values()
            .filter(|d| status.is_none_or(|s| d.status == s) && org_id.is_none_or(|org| d.org_id == Some(org)))
            .cloned()
            .collect();
        rows.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        rows.truncate(usize::try_from(limit).unwrap_or(0));
        Ok(rows)
    }

    async fn pending_data_for_customer(&self, customer: &str) -> Result<Vec<NfseDocument>, String> {
        Ok(lock(&self.inner)?
            .docs
            .values()
            .filter(|d| d.status == status::PENDING_DATA && d.stripe_customer_id.as_deref() == Some(customer))
            .cloned()
            .collect())
    }

    async fn allocate_number(&self, series: i32) -> Result<i64, String> {
        let mut inner = lock(&self.inner)?;
        let next = inner.series.entry(series).or_insert(0);
        *next += 1;
        Ok(*next)
    }

    async fn upsert_identity(&self, identity: &FiscalIdentity) -> Result<(), String> {
        lock(&self.inner)?.identities.insert(identity.stripe_customer_id.clone(), identity.clone());
        Ok(())
    }

    async fn get_identity(&self, customer: &str) -> Result<Option<FiscalIdentity>, String> {
        Ok(lock(&self.inner)?.identities.get(customer).cloned())
    }
}

/// Postgres store sharing the primary pool (migration 034_nfse.sql).
pub struct PostgresNfse {
    pool: PgPool,
}

impl PostgresNfse {
    /// Wraps the primary pool (migrations already ran in PostgresStore::connect).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Columns in `map_doc` order.
const DOC_COLUMNS: &str = "id, stripe_invoice_id, payment_intent, org_id, stripe_customer_id, status, attempts, \
     next_attempt_at, last_error, series, number, dps_id, access_key, nfse_number, amount_usd_cents, amount_brl_cents, \
     ptax_rate, ptax_date, paid_at, buyer, description, dps_xml, nfse_xml, cancel_reason, cancel_xml, created_at, \
     issued_at, canceled_at";

/// Maps an `nfse_documents` row.
fn map_doc(row: &sqlx::postgres::PgRow) -> NfseDocument {
    NfseDocument {
        id: row.get("id"),
        stripe_invoice_id: row.get("stripe_invoice_id"),
        payment_intent: row.get("payment_intent"),
        org_id: row.get("org_id"),
        stripe_customer_id: row.get("stripe_customer_id"),
        status: row.get("status"),
        attempts: row.get("attempts"),
        next_attempt_at: row.get("next_attempt_at"),
        last_error: row.get("last_error"),
        series: row.get("series"),
        number: row.get("number"),
        dps_id: row.get("dps_id"),
        access_key: row.get("access_key"),
        nfse_number: row.get("nfse_number"),
        amount_usd_cents: row.get("amount_usd_cents"),
        amount_brl_cents: row.get("amount_brl_cents"),
        ptax_rate: row.get("ptax_rate"),
        ptax_date: row.get("ptax_date"),
        paid_at: row.get("paid_at"),
        buyer: row.get("buyer"),
        description: row.get("description"),
        dps_xml: row.get("dps_xml"),
        nfse_xml: row.get("nfse_xml"),
        cancel_reason: row.get("cancel_reason"),
        cancel_xml: row.get("cancel_xml"),
        created_at: row.get("created_at"),
        issued_at: row.get("issued_at"),
        canceled_at: row.get("canceled_at"),
    }
}

/// Binds every column of a document in `DOC_COLUMNS` order.
fn bind_doc<'q>(
    query: sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments>,
    doc: &'q NfseDocument,
) -> sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments> {
    query
        .bind(doc.id)
        .bind(&doc.stripe_invoice_id)
        .bind(doc.payment_intent.as_deref())
        .bind(doc.org_id)
        .bind(doc.stripe_customer_id.as_deref())
        .bind(&doc.status)
        .bind(doc.attempts)
        .bind(doc.next_attempt_at)
        .bind(doc.last_error.as_deref())
        .bind(doc.series)
        .bind(doc.number)
        .bind(doc.dps_id.as_deref())
        .bind(doc.access_key.as_deref())
        .bind(doc.nfse_number.as_deref())
        .bind(doc.amount_usd_cents)
        .bind(doc.amount_brl_cents)
        .bind(doc.ptax_rate)
        .bind(doc.ptax_date)
        .bind(doc.paid_at)
        .bind(&doc.buyer)
        .bind(&doc.description)
        .bind(doc.dps_xml.as_deref())
        .bind(doc.nfse_xml.as_deref())
        .bind(doc.cancel_reason.as_deref())
        .bind(doc.cancel_xml.as_deref())
        .bind(doc.created_at)
        .bind(doc.issued_at)
        .bind(doc.canceled_at)
}

/// `$1, $2, ... $28` placeholders for every column.
fn placeholders() -> String {
    (1..=28).map(|i| format!("${i}")).collect::<Vec<_>>().join(", ")
}

#[async_trait]
impl NfseStore for PostgresNfse {
    async fn enqueue(&self, doc: &NfseDocument) -> Result<bool, String> {
        let sql = format!(
            "INSERT INTO nfse_documents ({DOC_COLUMNS}) VALUES ({}) ON CONFLICT (stripe_invoice_id) DO NOTHING",
            placeholders()
        );
        let result = bind_doc(sqlx::query(&sql), doc).execute(&self.pool).await.map_err(|err| err.to_string())?;
        Ok(result.rows_affected() > 0)
    }

    async fn claim_due(&self, now: DateTime<Utc>, limit: i64) -> Result<Vec<NfseDocument>, String> {
        let sql = format!(
            "UPDATE nfse_documents SET next_attempt_at = $1 + ($3 || ' minutes')::interval
             WHERE id IN (
                 SELECT id FROM nfse_documents
                 WHERE status IN ('queued', 'cancel_queued') AND next_attempt_at <= $1
                 ORDER BY next_attempt_at LIMIT $2 FOR UPDATE SKIP LOCKED)
             RETURNING {DOC_COLUMNS}"
        );
        let rows = sqlx::query(&sql)
            .bind(now)
            .bind(limit)
            .bind(CLAIM_LEASE_MINUTES.to_string())
            .fetch_all(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_doc).collect())
    }

    async fn save(&self, doc: &NfseDocument) -> Result<(), String> {
        let sql = format!("INSERT INTO nfse_documents ({DOC_COLUMNS}) VALUES ({}) ON CONFLICT (id) DO UPDATE SET {}", placeholders(), {
            DOC_COLUMNS
                .split(',')
                .map(str::trim)
                .filter(|column| *column != "id")
                .map(|column| format!("{column} = EXCLUDED.{column}"))
                .collect::<Vec<_>>()
                .join(", ")
        });
        bind_doc(sqlx::query(&sql), doc).execute(&self.pool).await.map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get(&self, id: Uuid) -> Result<Option<NfseDocument>, String> {
        let row = sqlx::query(&format!("SELECT {DOC_COLUMNS} FROM nfse_documents WHERE id = $1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.as_ref().map(map_doc))
    }

    async fn find_by_payment_intent(&self, payment_intent: &str) -> Result<Option<NfseDocument>, String> {
        let row = sqlx::query(&format!("SELECT {DOC_COLUMNS} FROM nfse_documents WHERE payment_intent = $1 LIMIT 1"))
            .bind(payment_intent)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.as_ref().map(map_doc))
    }

    async fn list(&self, status: Option<&str>, org_id: Option<Uuid>, limit: i64) -> Result<Vec<NfseDocument>, String> {
        let rows = sqlx::query(&format!(
            "SELECT {DOC_COLUMNS} FROM nfse_documents
             WHERE ($1::text IS NULL OR status = $1) AND ($2::uuid IS NULL OR org_id = $2)
             ORDER BY created_at DESC LIMIT $3"
        ))
        .bind(status)
        .bind(org_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_doc).collect())
    }

    async fn pending_data_for_customer(&self, customer: &str) -> Result<Vec<NfseDocument>, String> {
        let rows = sqlx::query(&format!(
            "SELECT {DOC_COLUMNS} FROM nfse_documents WHERE status = 'pending_data' AND stripe_customer_id = $1"
        ))
        .bind(customer)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_doc).collect())
    }

    async fn allocate_number(&self, series: i32) -> Result<i64, String> {
        let row = sqlx::query(
            "INSERT INTO nfse_series (series, last_number) VALUES ($1, 1)
             ON CONFLICT (series) DO UPDATE SET last_number = nfse_series.last_number + 1
             RETURNING last_number",
        )
        .bind(series)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.get("last_number"))
    }

    async fn upsert_identity(&self, identity: &FiscalIdentity) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO fiscal_identities (stripe_customer_id, org_id, doc_type, doc_number, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (stripe_customer_id) DO UPDATE SET
                 org_id = COALESCE(EXCLUDED.org_id, fiscal_identities.org_id),
                 doc_type = EXCLUDED.doc_type, doc_number = EXCLUDED.doc_number, updated_at = EXCLUDED.updated_at",
        )
        .bind(&identity.stripe_customer_id)
        .bind(identity.org_id)
        .bind(&identity.doc_type)
        .bind(&identity.doc_number)
        .bind(identity.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get_identity(&self, customer: &str) -> Result<Option<FiscalIdentity>, String> {
        let row = sqlx::query("SELECT stripe_customer_id, org_id, doc_type, doc_number, updated_at FROM fiscal_identities WHERE stripe_customer_id = $1")
            .bind(customer)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(|row| FiscalIdentity {
            stripe_customer_id: row.get("stripe_customer_id"),
            org_id: row.get("org_id"),
            doc_type: row.get("doc_type"),
            doc_number: row.get("doc_number"),
            updated_at: row.get("updated_at"),
        }))
    }
}
