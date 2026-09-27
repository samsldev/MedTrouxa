/**
 * @fileoverview NFS-e lifecycle: enqueue from Stripe webhooks, issue through the national system, cancel on refunds.
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
 * - invoice.paid -> one queued document per invoice (idempotent); checkout completion stores the buyer's CPF /
 *   CNPJ / foreign tax id and resumes documents waiting for it
 * - Issuing: resolve buyer (domestic needs CPF or CNPJ, foreign is an export), convert USD with PTAX once,
 *   assign the DPS number once, recover by DPS id after an unknown outcome, sign, submit
 * - Full refunds and chargebacks cancel issued notes (event e101101) or void unissued ones; partial refunds are
 *   flagged for manual substitution
 * - Transient failures back off exponentially (1 min doubling, capped at 6 h); rejections stop for review
 */

use crate::nfse::client::{nfse_number, NfseGateway, Submission};
use crate::nfse::config::NfseConfig;
use crate::nfse::dps::{digits, valid_cnpj, valid_cpf, Buyer, BuyerId, CancelRequest, Dps, ForeignAddress};
use crate::nfse::ptax::{rate_for_payment, usd_to_brl_cents, ExchangeRates};
use crate::nfse::sign::SigningIdentity;
use crate::nfse::store::{status, FiscalIdentity, NfseDocument, NfseStore};
use chrono::{DateTime, Duration, FixedOffset, Utc};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

/// Brasilia time (no daylight saving since 2019).
pub fn brasilia() -> FixedOffset {
    FixedOffset::west_opt(3 * 3600).expect("valid offset")
}

/// Cancellation attempts before a document is left for manual handling.
const MAX_CANCEL_ATTEMPTS: i32 = 5;

/// What the worker should tell the buyer after processing a document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Notice {
    None,
    /// The note was issued (email with the number).
    Issued { email: String, number: String },
    /// The buyer must provide a CPF or CNPJ (sent once per document).
    NeedsTaxId { email: String },
}

/// Issues and cancels notes; shared by the worker and the admin endpoints.
pub struct NfseService {
    pub config: NfseConfig,
    identity: SigningIdentity,
    gateway: Arc<dyn NfseGateway>,
    rates: Arc<dyn ExchangeRates>,
}

/// Text field of a JSON value by pointer.
fn text(value: &Value, pointer: &str) -> Option<String> {
    value.pointer(pointer).and_then(Value::as_str).map(str::to_string).filter(|s| !s.is_empty())
}

/// Builds the queued document for a paid Stripe invoice; None when nothing was charged.
pub fn document_from_invoice(invoice: &Value, series: i32) -> Option<NfseDocument> {
    let invoice_id = text(invoice, "/id")?;
    let amount = invoice.get("amount_paid").and_then(Value::as_i64).unwrap_or(0);
    if amount <= 0 {
        return None;
    }
    let currency = text(invoice, "/currency").unwrap_or_else(|| "usd".into()).to_ascii_lowercase();
    let paid = invoice
        .pointer("/status_transitions/paid_at")
        .and_then(Value::as_i64)
        .or_else(|| invoice.get("created").and_then(Value::as_i64))
        .and_then(|secs| DateTime::from_timestamp(secs, 0))
        .unwrap_or_else(Utc::now);
    let payment_intent = text(invoice, "/payment_intent").or_else(|| text(invoice, "/payments/data/0/payment/payment_intent"));
    let org_id = [
        "/metadata/org_id",
        "/subscription_details/metadata/org_id",
        "/parent/subscription_details/metadata/org_id",
        "/lines/data/0/metadata/org_id",
    ]
    .iter()
    .find_map(|pointer| text(invoice, pointer))
    .and_then(|raw| Uuid::parse_str(&raw).ok());
    let lines: Vec<String> = invoice
        .pointer("/lines/data")
        .and_then(Value::as_array)
        .map(|lines| lines.iter().filter_map(|line| text(line, "/description")).collect())
        .unwrap_or_default();
    let now = Utc::now();
    Some(NfseDocument {
        id: Uuid::new_v4(),
        stripe_invoice_id: invoice_id,
        payment_intent,
        org_id,
        stripe_customer_id: text(invoice, "/customer"),
        status: status::QUEUED.to_string(),
        attempts: 0,
        next_attempt_at: now,
        last_error: None,
        series,
        number: None,
        dps_id: None,
        access_key: None,
        nfse_number: None,
        amount_usd_cents: if currency == "usd" { amount } else { 0 },
        amount_brl_cents: (currency == "brl").then_some(amount),
        ptax_rate: None,
        ptax_date: None,
        paid_at: paid,
        buyer: json!({
            "name": text(invoice, "/customer_name"),
            "email": text(invoice, "/customer_email"),
            "address": invoice.get("customer_address").cloned().unwrap_or(Value::Null),
            "tax_ids": invoice.get("customer_tax_ids").cloned().unwrap_or(Value::Null),
            "currency": currency,
        }),
        description: lines.join("; "),
        dps_xml: None,
        nfse_xml: None,
        cancel_reason: None,
        cancel_xml: None,
        created_at: now,
        issued_at: None,
        canceled_at: None,
    })
}

/// Fiscal identity typed at Checkout: CNPJ / foreign tax id (tax id collection) or CPF (custom field).
pub fn identity_from_checkout(session: &Value) -> Option<FiscalIdentity> {
    let customer = text(session, "/customer")?;
    let org_id = text(session, "/metadata/org_id").and_then(|raw| Uuid::parse_str(&raw).ok());
    let tax_type = text(session, "/customer_details/tax_ids/0/type");
    let tax_value = text(session, "/customer_details/tax_ids/0/value");
    let cpf = session
        .get("custom_fields")
        .and_then(Value::as_array)
        .and_then(|fields| fields.iter().find(|f| f.get("key").and_then(Value::as_str) == Some("cpf")))
        .and_then(|field| text(field, "/text/value"))
        .map(|raw| digits(&raw))
        .filter(|cpf| valid_cpf(cpf));
    let (doc_type, doc_number) = match (tax_type.as_deref(), tax_value, cpf) {
        (Some("br_cnpj"), Some(value), _) if valid_cnpj(&value) => ("cnpj", digits(&value)),
        (Some("br_cpf"), Some(value), _) if valid_cpf(&value) => ("cpf", digits(&value)),
        (Some(kind), Some(value), _) if !kind.starts_with("br_") => ("nif", value),
        (_, _, Some(cpf)) => ("cpf", cpf),
        _ => return None,
    };
    Some(FiscalIdentity { stripe_customer_id: customer, org_id, doc_type: doc_type.to_string(), doc_number, updated_at: Utc::now() })
}

/// Resolves the buyer; Err(reason) when a domestic buyer has no valid CPF or CNPJ yet.
pub fn resolve_buyer(doc: &NfseDocument, identity: Option<&FiscalIdentity>) -> Result<Buyer, String> {
    let b = &doc.buyer;
    let country = text(b, "/address/country").map(|c| c.to_ascii_uppercase()).ok_or_else(|| "billing country missing".to_string())?;
    let name = text(b, "/name").or_else(|| text(b, "/email")).unwrap_or_else(|| "Consumidor".into());
    let email = text(b, "/email");
    let tax_ids: Vec<(String, String)> = b
        .get("tax_ids")
        .and_then(Value::as_array)
        .map(|ids| ids.iter().filter_map(|id| Some((text(id, "/type")?, text(id, "/value")?))).collect())
        .unwrap_or_default();
    let find = |kind: &str| tax_ids.iter().find(|(t, _)| t == kind).map(|(_, v)| v.clone());
    let id = if country == "BR" {
        if let Some(cnpj) = find("br_cnpj").filter(|v| valid_cnpj(v)) {
            BuyerId::Cnpj(digits(&cnpj))
        } else if let Some(cpf) = find("br_cpf").filter(|v| valid_cpf(v)) {
            BuyerId::Cpf(digits(&cpf))
        } else {
            match identity {
                Some(i) if i.doc_type == "cnpj" && valid_cnpj(&i.doc_number) => BuyerId::Cnpj(i.doc_number.clone()),
                Some(i) if i.doc_type == "cpf" && valid_cpf(&i.doc_number) => BuyerId::Cpf(i.doc_number.clone()),
                _ => return Err("CPF or CNPJ required for a buyer in Brazil".to_string()),
            }
        }
    } else if let Some((_, value)) = tax_ids.iter().find(|(t, _)| !t.starts_with("br_")) {
        BuyerId::Nif(value.clone())
    } else if let Some(i) = identity.filter(|i| i.doc_type == "nif") {
        BuyerId::Nif(i.doc_number.clone())
    } else {
        // Foreign consumer without a tax id: "2 - Nao exigencia do NIF" (to be confirmed by the accountant).
        BuyerId::NoNif("2")
    };
    let foreign_address = (country != "BR").then(|| ForeignAddress {
        country: country.clone(),
        postal_code: text(b, "/address/postal_code").unwrap_or_default(),
        city: text(b, "/address/city").unwrap_or_default(),
        state: text(b, "/address/state").unwrap_or_default(),
        street: text(b, "/address/line1").unwrap_or_default(),
        number: String::new(),
        district: text(b, "/address/line2").unwrap_or_default(),
    });
    Ok(Buyer { id, name, email, country, foreign_address })
}

/// Next retry time: 1 minute doubling per attempt, capped at 6 hours.
fn backoff(attempts: i32, now: DateTime<Utc>) -> DateTime<Utc> {
    let minutes = 1_i64 << attempts.clamp(0, 9);
    now + Duration::minutes(minutes.min(360))
}

impl NfseService {
    /// Wires the configuration, signing identity, national gateway, and PTAX source.
    pub fn new(config: NfseConfig, identity: SigningIdentity, gateway: Arc<dyn NfseGateway>, rates: Arc<dyn ExchangeRates>) -> Self {
        Self { config, identity, gateway, rates }
    }

    /// Certificate subject and expiry (admin status).
    pub fn certificate(&self) -> (String, i64) {
        (self.identity.subject.clone(), self.identity.not_after)
    }

    /// DANFSe PDF of an issued note.
    pub async fn danfse(&self, access_key: &str) -> Result<Vec<u8>, String> {
        self.gateway.danfse(access_key).await
    }

    /// Processes one claimed document and persists the result.
    pub async fn process(&self, store: &dyn NfseStore, mut doc: NfseDocument) -> Result<Notice, String> {
        let now = Utc::now();
        let notice = match doc.status.as_str() {
            status::QUEUED => self.issue(store, &mut doc, now).await?,
            status::CANCEL_QUEUED => {
                self.cancel(&mut doc, now).await;
                Notice::None
            }
            _ => Notice::None,
        };
        store.save(&doc).await?;
        Ok(notice)
    }

    /// Issue path; `doc` is updated in place (the caller saves it).
    async fn issue(&self, store: &dyn NfseStore, doc: &mut NfseDocument, now: DateTime<Utc>) -> Result<Notice, String> {
        let identity = match doc.stripe_customer_id.as_deref() {
            Some(customer) => store.get_identity(customer).await?,
            None => None,
        };
        let buyer = match resolve_buyer(doc, identity.as_ref()) {
            Ok(buyer) => buyer,
            Err(reason) => {
                let first_time = doc.status != status::PENDING_DATA;
                doc.status = status::PENDING_DATA.to_string();
                doc.last_error = Some(reason);
                return Ok(match text(&doc.buyer, "/email").filter(|_| first_time) {
                    Some(email) => Notice::NeedsTaxId { email },
                    None => Notice::None,
                });
            }
        };
        if doc.amount_brl_cents.is_none() {
            let paid_on = doc.paid_at.with_timezone(&brasilia()).date_naive();
            match rate_for_payment(self.rates.as_ref(), paid_on).await {
                Ok((day, rate)) => {
                    doc.ptax_rate = Some(rate);
                    doc.ptax_date = Some(day);
                    doc.amount_brl_cents = Some(usd_to_brl_cents(doc.amount_usd_cents, rate));
                }
                Err(error) => return Ok(self.retry_later(doc, format!("PTAX unavailable: {error}"), now)),
            }
        }
        if doc.number.is_none() {
            let number = store.allocate_number(doc.series).await?;
            doc.number = Some(number);
            // Persist the number before the first submission so a crash can never reuse or skip it.
            store.save(doc).await?;
        }
        let dps = self.render(doc, buyer, now);
        doc.dps_id = Some(dps.id());
        if doc.attempts > 0 {
            if let Ok(Some(key)) = self.gateway.find_by_dps(&dps.id()).await {
                return self.recover(doc, key, now).await;
            }
        }
        let signed = dps.document(&self.identity.signature_for(&dps.id(), &dps.canonical_inf()));
        doc.dps_xml = Some(signed.clone());
        doc.attempts += 1;
        match self.gateway.submit_dps(&signed).await {
            Submission::Issued { access_key, nfse_xml } => Ok(self.mark_issued(doc, access_key, nfse_xml, now)),
            Submission::Rejected(error) => {
                doc.status = status::REJECTED.to_string();
                doc.last_error = Some(error);
                Ok(Notice::None)
            }
            Submission::Unavailable(error) => Ok(self.retry_later(doc, error, now)),
        }
    }

    /// Builds the DPS for a document with a resolved buyer.
    fn render(&self, doc: &NfseDocument, buyer: Buyer, now: DateTime<Utc>) -> Dps {
        let mut description = self.config.description_prefix.clone();
        if !doc.description.is_empty() {
            description.push_str(" - ");
            description.push_str(&doc.description);
        }
        description.push_str(&format!(" - Fatura {}", doc.stripe_invoice_id));
        if let (Some(rate), Some(day)) = (doc.ptax_rate, doc.ptax_date) {
            description.push_str(&format!(
                " - Valor cobrado USD {}, convertido pela PTAX de venda de {} (R$ {rate:.4})",
                crate::nfse::dps::money(doc.amount_usd_cents),
                day.format("%d/%m/%Y")
            ));
        }
        Dps {
            environment: self.config.environment,
            app_version: self.config.app_version.clone(),
            series: u32::try_from(doc.series).unwrap_or(1),
            number: u64::try_from(doc.number.unwrap_or(1)).unwrap_or(1),
            issued_at: now.with_timezone(&brasilia()),
            competence: doc.paid_at.with_timezone(&brasilia()).date_naive(),
            seller: self.config.seller.clone(),
            buyer,
            service: self.config.service.clone(),
            description,
            value_brl_cents: doc.amount_brl_cents.unwrap_or(0),
            value_usd_cents: doc.amount_usd_cents,
            ibs_cbs: self.config.ibs_cbs.clone(),
        }
    }

    /// A DPS that already produced a note (unknown outcome before): fetch and store it.
    async fn recover(&self, doc: &mut NfseDocument, key: String, now: DateTime<Utc>) -> Result<Notice, String> {
        match self.gateway.fetch_nfse(&key).await {
            Ok(xml) => Ok(self.mark_issued(doc, key, xml, now)),
            Err(error) => Ok(self.retry_later(doc, format!("recovery fetch failed: {error}"), now)),
        }
    }

    /// Stores an authorized note.
    fn mark_issued(&self, doc: &mut NfseDocument, key: String, xml: String, now: DateTime<Utc>) -> Notice {
        doc.status = status::ISSUED.to_string();
        doc.nfse_number = nfse_number(&xml);
        doc.access_key = Some(key);
        doc.nfse_xml = Some(xml);
        doc.issued_at = Some(now);
        doc.last_error = None;
        match (text(&doc.buyer, "/email"), doc.nfse_number.clone()) {
            (Some(email), Some(number)) => Notice::Issued { email, number },
            _ => Notice::None,
        }
    }

    /// Keeps the document queued with exponential backoff.
    fn retry_later(&self, doc: &mut NfseDocument, error: String, now: DateTime<Utc>) -> Notice {
        doc.status = status::QUEUED.to_string();
        doc.last_error = Some(error);
        doc.next_attempt_at = backoff(doc.attempts, now);
        Notice::None
    }

    /// Cancellation path (event e101101).
    async fn cancel(&self, doc: &mut NfseDocument, now: DateTime<Utc>) {
        let Some(key) = doc.access_key.clone() else {
            doc.status = status::VOIDED.to_string();
            return;
        };
        let request = CancelRequest {
            environment: self.config.environment,
            app_version: self.config.app_version.clone(),
            requested_at: now.with_timezone(&brasilia()),
            seller_cnpj: self.config.seller.cnpj.clone(),
            access_key: key.clone(),
            reason_code: "9",
            reason: doc.cancel_reason.clone().unwrap_or_else(|| "Cancelamento solicitado pelo prestador".into()),
        };
        let signed = request.document(&self.identity.signature_for(&request.id(), &request.canonical_inf()));
        doc.cancel_xml = Some(signed.clone());
        doc.attempts += 1;
        match self.gateway.submit_event(&key, &signed).await {
            Ok(()) => {
                doc.status = status::CANCELED.to_string();
                doc.canceled_at = Some(now);
                doc.last_error = None;
            }
            Err(error) if doc.attempts >= MAX_CANCEL_ATTEMPTS => {
                doc.status = status::CANCEL_FAILED.to_string();
                doc.last_error = Some(error);
            }
            Err(error) => {
                doc.last_error = Some(error);
                doc.next_attempt_at = backoff(doc.attempts, now);
            }
        }
    }
}

/// Reacts to a refund or chargeback of the payment behind a document.
///
/// Full reversal: issued notes are queued for cancellation, unissued ones are voided.
/// Partial refund of an issued note: flagged for manual substitution.
pub async fn on_reversal(store: &dyn NfseStore, payment_intent: &str, full: bool, reason: &str) -> Result<(), String> {
    let Some(mut doc) = store.find_by_payment_intent(payment_intent).await? else {
        return Ok(());
    };
    let issued = doc.status == status::ISSUED;
    let next = match (issued, full) {
        (true, true) => status::CANCEL_QUEUED,
        (true, false) => status::NEEDS_REVIEW,
        (false, true) if [status::QUEUED, status::PENDING_DATA, status::REJECTED].contains(&doc.status.as_str()) => status::VOIDED,
        (false, false) if doc.status != status::VOIDED && doc.status != status::CANCELED => status::NEEDS_REVIEW,
        _ => return Ok(()),
    };
    doc.status = next.to_string();
    doc.cancel_reason = Some(reason.to_string());
    doc.attempts = 0;
    doc.next_attempt_at = Utc::now();
    store.save(&doc).await
}

/// Stores a fiscal identity and puts the customer's documents waiting for it back in the queue.
pub async fn save_identity(store: &dyn NfseStore, identity: &FiscalIdentity) -> Result<usize, String> {
    store.upsert_identity(identity).await?;
    let pending = store.pending_data_for_customer(&identity.stripe_customer_id).await?;
    let count = pending.len();
    for mut doc in pending {
        doc.status = status::QUEUED.to_string();
        doc.next_attempt_at = Utc::now();
        doc.last_error = None;
        store.save(&doc).await?;
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nfse::dps::{Environment, Seller, ServiceCode};
    use crate::nfse::store::MemoryNfse;
    use async_trait::async_trait;
    use chrono::NaiveDate;
    use std::sync::Mutex;

    /// Fixed PTAX of 5.00 every day.
    struct FixedRate;

    #[async_trait]
    impl ExchangeRates for FixedRate {
        async fn ptax_sell(&self, _day: NaiveDate) -> Result<Option<f64>, String> {
            Ok(Some(5.0))
        }
    }

    /// Scripted gateway recording what it received.
    #[derive(Default)]
    struct FakeGateway {
        outcomes: Mutex<Vec<Submission>>,
        submitted: Mutex<Vec<String>>,
        events: Mutex<Vec<String>>,
        known_dps: Mutex<Option<String>>,
    }

    #[async_trait]
    impl NfseGateway for FakeGateway {
        async fn submit_dps(&self, signed_xml: &str) -> Submission {
            self.submitted.lock().unwrap().push(signed_xml.to_string());
            self.outcomes.lock().unwrap().remove(0)
        }
        async fn find_by_dps(&self, _dps_id: &str) -> Result<Option<String>, String> {
            Ok(self.known_dps.lock().unwrap().clone())
        }
        async fn fetch_nfse(&self, _key: &str) -> Result<String, String> {
            Ok("<NFSe><nNFSe>77</nNFSe></NFSe>".into())
        }
        async fn submit_event(&self, _key: &str, signed_xml: &str) -> Result<(), String> {
            self.events.lock().unwrap().push(signed_xml.to_string());
            Ok(())
        }
        async fn danfse(&self, _key: &str) -> Result<Vec<u8>, String> {
            Ok(b"%PDF".to_vec())
        }
    }

    /// Service with a throwaway 1024-bit key (tests only).
    fn service(gateway: Arc<FakeGateway>) -> NfseService {
        let key = rsa::RsaPrivateKey::new(&mut rand::thread_rng(), 1024).unwrap();
        let config = NfseConfig {
            environment: Environment::Homologation,
            seller: Seller {
                cnpj: "11222333000181".into(),
                municipal_registration: None,
                city_code: "3170206".into(),
                simples_option: "3".into(),
                simples_regime: Some("1".into()),
                special_regime: "0".into(),
            },
            series: 1,
            service: ServiceCode { national: "010301".into(), nbs: "123456789".into() },
            description_prefix: "Serviço".into(),
            app_version: "Faelith_1.0".into(),
            ibs_cbs: None,
            cert_pem: String::new(),
            key_pem: String::new(),
            ca_bundle_pem: None,
        };
        NfseService::new(config, SigningIdentity::from_parts(key, vec![1]), gateway, Arc::new(FixedRate))
    }

    /// A paid USD invoice for a customer in `country`.
    fn invoice(id: &str, country: &str, tax_ids: Value) -> Value {
        json!({
            "id": id, "customer": "cus_1", "amount_paid": 2000, "currency": "usd", "payment_intent": format!("pi_{id}"),
            "status_transitions": {"paid_at": 1_790_000_000}, "customer_name": "Ana", "customer_email": "ana@example.com",
            "customer_address": {"country": country, "city": "Lisboa", "postal_code": "1000-001", "line1": "Rua A", "state": "Lisboa"},
            "customer_tax_ids": tax_ids, "lines": {"data": [{"description": "Faelith Pro"}]},
            "subscription_details": {"metadata": {"org_id": "00000000-0000-0000-0000-000000000009"}},
        })
    }

    /// Domestic buyer without CPF waits for data, then issues after the CPF is saved; webhook redelivery is ignored.
    #[tokio::test]
    async fn domestic_flow_waits_for_cpf_then_issues() {
        let store = MemoryNfse::new();
        let gateway = Arc::new(FakeGateway::default());
        gateway.outcomes.lock().unwrap().push(Submission::Issued { access_key: "1".repeat(50), nfse_xml: "<NFSe><nNFSe>5</nNFSe></NFSe>".into() });
        let service = service(gateway.clone());
        let doc = document_from_invoice(&invoice("in_1", "BR", json!([])), 1).unwrap();
        assert!(store.enqueue(&doc).await.unwrap());
        assert!(!store.enqueue(&document_from_invoice(&invoice("in_1", "BR", json!([])), 1).unwrap()).await.unwrap());

        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        let notice = service.process(&store, claimed[0].clone()).await.unwrap();
        assert_eq!(notice, Notice::NeedsTaxId { email: "ana@example.com".into() });
        assert_eq!(store.get(doc.id).await.unwrap().unwrap().status, status::PENDING_DATA);

        let identity = FiscalIdentity { stripe_customer_id: "cus_1".into(), org_id: None, doc_type: "cpf".into(), doc_number: "12345678909".into(), updated_at: Utc::now() };
        assert_eq!(save_identity(&store, &identity).await.unwrap(), 1);
        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        let notice = service.process(&store, claimed[0].clone()).await.unwrap();
        assert_eq!(notice, Notice::Issued { email: "ana@example.com".into(), number: "5".into() });
        let issued = store.get(doc.id).await.unwrap().unwrap();
        assert_eq!((issued.status.as_str(), issued.number, issued.amount_brl_cents), (status::ISSUED, Some(1), Some(10_000)));
        let sent = gateway.submitted.lock().unwrap()[0].clone();
        assert!(sent.contains("<CPF>12345678909</CPF>") && sent.contains("<Signature xmlns="));
    }

    /// Foreign buyer is an export; an unknown outcome is recovered by DPS id without resubmitting.
    #[tokio::test]
    async fn export_and_recovery() {
        let store = MemoryNfse::new();
        let gateway = Arc::new(FakeGateway::default());
        gateway.outcomes.lock().unwrap().push(Submission::Unavailable("timeout".into()));
        let service = service(gateway.clone());
        let doc = document_from_invoice(&invoice("in_2", "PT", json!([{"type": "eu_vat", "value": "PT123456789"}])), 1).unwrap();
        store.enqueue(&doc).await.unwrap();
        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        service.process(&store, claimed[0].clone()).await.unwrap();
        let queued = store.get(doc.id).await.unwrap().unwrap();
        assert_eq!((queued.status.as_str(), queued.attempts), (status::QUEUED, 1));
        assert!(gateway.submitted.lock().unwrap()[0].contains("<NIF>PT123456789</NIF>"));
        assert!(gateway.submitted.lock().unwrap()[0].contains("<tribISSQN>3</tribISSQN><cPaisResult>PT</cPaisResult>"));

        *gateway.known_dps.lock().unwrap() = Some("2".repeat(50));
        let mut again = queued.clone();
        again.next_attempt_at = Utc::now();
        store.save(&again).await.unwrap();
        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        service.process(&store, claimed[0].clone()).await.unwrap();
        let issued = store.get(doc.id).await.unwrap().unwrap();
        assert_eq!((issued.status.as_str(), issued.nfse_number.as_deref(), issued.number), (status::ISSUED, Some("77"), Some(1)));
        assert_eq!(gateway.submitted.lock().unwrap().len(), 1, "recovered, not resubmitted");
    }

    /// Full refund cancels an issued note with a signed e101101 event; unissued notes are voided.
    #[tokio::test]
    async fn refunds_cancel_or_void() {
        let store = MemoryNfse::new();
        let gateway = Arc::new(FakeGateway::default());
        gateway.outcomes.lock().unwrap().push(Submission::Issued { access_key: "3".repeat(50), nfse_xml: "<NFSe><nNFSe>9</nNFSe></NFSe>".into() });
        let service = service(gateway.clone());
        let doc = document_from_invoice(&invoice("in_3", "BR", json!([{"type": "br_cnpj", "value": "11.222.333/0001-81"}])), 1).unwrap();
        store.enqueue(&doc).await.unwrap();
        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        service.process(&store, claimed[0].clone()).await.unwrap();

        on_reversal(&store, "pi_in_3", true, "Reembolso integral no prazo de arrependimento").await.unwrap();
        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        service.process(&store, claimed[0].clone()).await.unwrap();
        assert_eq!(store.get(doc.id).await.unwrap().unwrap().status, status::CANCELED);
        assert!(gateway.events.lock().unwrap()[0].contains("<e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>9</cMotivo>"));

        let other = document_from_invoice(&invoice("in_4", "BR", json!([])), 1).unwrap();
        store.enqueue(&other).await.unwrap();
        on_reversal(&store, "pi_in_4", true, "Contestação de pagamento").await.unwrap();
        assert_eq!(store.get(other.id).await.unwrap().unwrap().status, status::VOIDED);
    }

    /// CPF typed in the Checkout custom field becomes the fiscal identity; invalid CPFs are ignored.
    #[test]
    fn checkout_identity() {
        let session = |cpf: &str| json!({"customer": "cus_9", "custom_fields": [{"key": "cpf", "text": {"value": cpf}}], "customer_details": {"tax_ids": []}});
        assert_eq!(identity_from_checkout(&session("123.456.789-09")).unwrap().doc_number, "12345678909");
        assert!(identity_from_checkout(&session("111.111.111-11")).is_none());
    }

    /// PTAX quoted by the test (real value of a given day).
    struct Rate(f64);

    #[async_trait]
    impl ExchangeRates for Rate {
        async fn ptax_sell(&self, _day: NaiveDate) -> Result<Option<f64>, String> {
            Ok(Some(self.0))
        }
    }

    /// Writes the signed DPS of a Starter monthly payment for manual inspection (no network).
    ///
    /// Run: NFSE_TEST_CERT=cert.pem NFSE_TEST_KEY=key.pem NFSE_TEST_OUT=dir cargo test -p faelith-web starter_sample -- --ignored
    #[tokio::test]
    #[ignore]
    async fn starter_sample() {
        let cert = std::fs::read_to_string(std::env::var("NFSE_TEST_CERT").unwrap()).unwrap();
        let key = std::fs::read_to_string(std::env::var("NFSE_TEST_KEY").unwrap()).unwrap();
        let out = std::path::PathBuf::from(std::env::var("NFSE_TEST_OUT").unwrap());
        let gateway = Arc::new(FakeGateway::default());
        gateway.outcomes.lock().unwrap().push(Submission::Issued { access_key: "3".repeat(50), nfse_xml: "<NFSe><nNFSe>1</nNFSe></NFSe>".into() });
        let mut service = service(gateway.clone());
        service.identity = SigningIdentity::from_pem(&cert, &key).unwrap();
        service.rates = Arc::new(Rate(5.1991));
        service.config.description_prefix = "Serviço de processamento de dados por inteligência artificial (plataforma Faelith, SaaS)".into();
        let store = MemoryNfse::new();
        let invoice = json!({
            "id": "in_1SAMPLEstarter", "customer": "cus_sample", "amount_paid": 2000, "currency": "usd",
            "payment_intent": "pi_sample", "status_transitions": {"paid_at": 1_790_430_000},
            "customer_name": "Maria Oliveira (exemplo)", "customer_email": "maria@example.com",
            "customer_address": {"country": "BR", "city": "São Paulo", "postal_code": "01310-100", "line1": "Av. Paulista, 1000", "state": "SP"},
            "customer_tax_ids": [], "lines": {"data": [{"description": "1 × Faelith Starter (mensal) - US$ 20,00"}]},
            "subscription_details": {"metadata": {"org_id": "00000000-0000-0000-0000-000000000001"}},
        });
        let doc = document_from_invoice(&invoice, 1).unwrap();
        store.enqueue(&doc).await.unwrap();
        let identity = FiscalIdentity { stripe_customer_id: "cus_sample".into(), org_id: None, doc_type: "cpf".into(), doc_number: "12345678909".into(), updated_at: Utc::now() };
        store.upsert_identity(&identity).await.unwrap();
        let claimed = store.claim_due(Utc::now(), 10).await.unwrap();
        service.process(&store, claimed[0].clone()).await.unwrap();
        let saved = store.get(doc.id).await.unwrap().unwrap();
        std::fs::write(out.join("dps_starter.xml"), saved.dps_xml.clone().unwrap()).unwrap();
        std::fs::write(
            out.join("dps_starter.json"),
            serde_json::to_string_pretty(&json!({
                "amount_usd_cents": saved.amount_usd_cents, "amount_brl_cents": saved.amount_brl_cents,
                "ptax_rate": saved.ptax_rate, "ptax_date": saved.ptax_date, "dps_id": saved.dps_id, "number": saved.number,
            }))
            .unwrap(),
        )
        .unwrap();
    }
}
