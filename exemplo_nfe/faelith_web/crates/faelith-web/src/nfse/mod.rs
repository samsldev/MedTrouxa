/**
 * @fileoverview NFS-e Nacional emitter: module wiring, Stripe webhook hooks, background worker, and buyer emails.
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
 * - Webhook hooks run before the billing fulfillment and are idempotent, so a failure returns 500 and Stripe
 *   redelivers the whole event without double effects
 * - The worker claims due documents every 30 seconds while the emitter is enabled (NFSE_ENABLED=1);
 *   documents are enqueued even when it is disabled, so the backlog is issued once it is turned on
 * - Buyers get an email when a note is issued and when a CPF / CNPJ is still missing
 */

pub mod client;
pub mod config;
pub mod dps;
pub mod ptax;
pub mod routes;
pub mod service;
pub mod sign;
pub mod store;

use crate::mailer::OutgoingEmail;
use crate::AppState;
use serde_json::Value;
use service::{document_from_invoice, identity_from_checkout, on_reversal, save_identity, Notice, NfseService};
use std::sync::Arc;
use std::time::Duration;

/// Worker polling interval.
const WORKER_INTERVAL: Duration = Duration::from_secs(30);
/// Documents processed per tick.
const WORKER_BATCH: i64 = 20;

/// Applies the NFS-e side effects of a verified Stripe event (enqueue, identity, reversals).
pub async fn on_stripe_event(state: &AppState, event: &Value) -> Result<(), String> {
    let object = event.pointer("/data/object").cloned().unwrap_or(Value::Null);
    let store = state.nfse.as_ref();
    match event.get("type").and_then(Value::as_str).unwrap_or_default() {
        "invoice.paid" => {
            let series = state.nfse_service.as_ref().map(|service| service.config.series).unwrap_or(1);
            if let Some(doc) = document_from_invoice(&object, series) {
                store.enqueue(&doc).await?;
            }
            Ok(())
        }
        "checkout.session.completed" | "checkout.session.async_payment_succeeded" => {
            if let Some(identity) = identity_from_checkout(&object) {
                save_identity(store, &identity).await?;
            }
            Ok(())
        }
        "charge.refunded" => {
            let Some(payment_intent) = object.get("payment_intent").and_then(Value::as_str) else { return Ok(()) };
            let full = object.get("refunded").and_then(Value::as_bool).unwrap_or(false);
            on_reversal(store, payment_intent, full, "Reembolso ao cliente (direito de arrependimento ou estorno)").await
        }
        "charge.dispute.created" => {
            let Some(payment_intent) = object.get("payment_intent").and_then(Value::as_str) else { return Ok(()) };
            on_reversal(store, payment_intent, true, "Contestação do pagamento pelo titular do cartão (chargeback)").await
        }
        _ => Ok(()),
    }
}

/// Starts the background worker (only called when the emitter is configured).
pub fn spawn_worker(state: AppState, service: Arc<NfseService>) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(WORKER_INTERVAL);
        loop {
            ticker.tick().await;
            let due = match state.nfse.claim_due(chrono::Utc::now(), WORKER_BATCH).await {
                Ok(due) => due,
                Err(error) => {
                    tracing::error!(error = %error, "nfse claim failed");
                    continue;
                }
            };
            for doc in due {
                let id = doc.id;
                match service.process(state.nfse.as_ref(), doc).await {
                    Ok(notice) => send_notice(&state, notice),
                    Err(error) => tracing::error!(error = %error, %id, "nfse processing failed"),
                }
            }
        }
    });
}

/// Emails the buyer about an issued note or missing tax id (best effort).
fn send_notice(state: &AppState, notice: Notice) {
    let origin = state.config.public_origin.clone();
    let email = match notice {
        Notice::None => return,
        Notice::Issued { email, number } => OutgoingEmail {
            to: email,
            subject: format!("Faelith: nota fiscal (NFS-e) nº {number} emitida"),
            text: format!(
                "Sua nota fiscal de serviço eletrônica nº {number} foi emitida.\nBaixe o PDF e o XML em {origin}/app/billing\n\nYour Brazilian service invoice (NFS-e) no. {number} was issued: {origin}/app/billing\n"
            ),
            html: format!(
                "<p>Sua nota fiscal de serviço eletrônica nº <strong>{number}</strong> foi emitida.</p><p><a href=\"{origin}/app/billing\">Baixar PDF e XML</a></p><p style=\"color:#777\">Your Brazilian service invoice (NFS-e) no. {number} was issued.</p>"
            ),
        },
        Notice::NeedsTaxId { email } => OutgoingEmail {
            to: email,
            subject: "Faelith: informe seu CPF para emitirmos a nota fiscal".to_string(),
            text: format!(
                "Recebemos seu pagamento. Para emitir a nota fiscal (NFS-e), informe seu CPF (ou o CNPJ da empresa) em {origin}/app/billing\n"
            ),
            html: format!(
                "<p>Recebemos seu pagamento. Para emitir a nota fiscal (NFS-e), informe seu <strong>CPF</strong> (ou o CNPJ da empresa) em <a href=\"{origin}/app/billing\">Cobrança e faturas</a>.</p>"
            ),
        },
    };
    let mailer = state.mailer.clone();
    tokio::spawn(async move {
        if let Err(error) = mailer.send(email).await {
            tracing::warn!(error = %error, "nfse notice email failed");
        }
    });
}
